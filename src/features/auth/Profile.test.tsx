// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter, useLocation, useNavigate, type Location } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { api } from '../../lib/api'
import * as authApi from './api'
import { endSession, privateSessionKey, profileQueryKey } from './sessionQueries'
import { registerSchema } from './schemas'
import { useSessionStore } from './sessionStore'

const token = 'profile.payload.signature'
const user = { id: '507f1f77bcf86cd799439011', username: 'neko', email: 'neko@example.com', role: 'user' } as const
const createdAt = '2026-01-11T12:00:00.000Z'
const { id, ...profileFields } = user
const profileResponse = { success: true, sessionId: token, data: { _id: id, ...profileFields, createdAt } }
const adapter = vi.fn<AxiosAdapter>()
const originalAdapter = api.defaults.adapter
let queryClient: QueryClient

type HandleRequest = (config: InternalAxiosRequestConfig) => unknown
const passwordResponse = { success: true, message: 'Contraseña actualizada correctamente' }
const profileUpdateResponse = { success: true, data: { ...user, username: 'neko_nuevo', avatarUrl: '/avatar.png' } }

function mockApi(getProfile: HandleRequest = () => profileResponse, writes?: { profile?: HandleRequest; password?: HandleRequest }) {
  adapter.mockImplementation(async config => {
    let data: unknown
    switch (config.url) {
      case '/auth/me':
        data = config.method === 'patch' ? await (writes?.profile ?? (() => profileUpdateResponse))(config) : await getProfile(config)
        break
      case '/auth/change-password': data = await (writes?.password ?? (() => passwordResponse))(config); break
      case '/auth/login': data = { success: true, data: { user, sessionId: token } }; break
      case '/auth/logout': data = { success: true, message: 'Sesión cerrada correctamente' }; break
      case '/animes': data = { success: true, data: [], pagination: { total: 0, page: 1, totalPages: 1 } }; break
      case '/animes/neko': data = { success: true, data: { title: 'Anime de prueba', slug: 'neko' } }; break
      default: throw new Error(`Solicitud inesperada: ${config.url}`)
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  })
}

function rejectRequest(config: InternalAxiosRequestConfig, status?: number): never {
  if (status === undefined) throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  const response = { config, status, data: { success: false }, headers: {}, statusText: '' }
  throw new AxiosError('Error HTTP', undefined, config, undefined, response)
}

function RouterProbe() {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <span data-testid="location">{pathname}{search}{hash}</span>
      <button type="button" onClick={() => { void navigate(-1) }}>Atrás</button>
    </>
  )
}

function renderApp(...entries: Array<string | Partial<Location>>) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={entries}>
        <RouterProbe />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: user.email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

function expectLocation(path: string) {
  expect(screen.getByTestId('location').textContent).toBe(path)
}

beforeEach(() => {
  useSessionStore.setState({ session: null, restoring: false, logoutSessionId: null })
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  adapter.mockReset()
  api.defaults.adapter = adapter
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  onlineManager.setOnline(true)
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('Ruta privada del perfil', () => {
  it('pide login, recupera la ruta completa y vuelve al catálogo con Atrás', async () => {
    mockApi()
    renderApp('/', '/profile?origen=catalogo#datos')

    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy()
    expectLocation('/login')
    expect(adapter).not.toHaveBeenCalled()
    submitLogin()

    expect(await screen.findByRole('heading', { name: user.username })).toBeTruthy()
    expectLocation('/profile?origen=catalogo#datos')
    const requests = adapter.mock.calls.filter(([config]) => config.url === '/auth/me')
    expect(requests).toHaveLength(1)
    expect(requests[0][0].headers.has('Authorization')).toBe(false)
    expect(requests[0][0].withCredentials).toBe(true)
    expect(screen.getByText(user.email)).toBeTruthy()
    expect(screen.getByText('11 de enero de 2026').getAttribute('datetime')).toBe(createdAt)
    expect(within(screen.getByRole('main')).getByText('N').getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByRole('heading', { name: 'Catálogo de anime' })).toBeTruthy()
    expectLocation('/')
  })

  it.each(['https://ejemplo.test/profile', '//ejemplo.test/profile', '/animes/neko', '/profile/../login'])('descarta el destino no autorizado %s', async pathname => {
    mockApi()
    renderApp({ pathname: '/login', state: { returnTo: { pathname } } })
    submitLogin()

    expect(await screen.findByRole('heading', { name: 'Catálogo de anime' })).toBeTruthy()
    expectLocation('/')
  })

  it('mantiene la ruta durante la primera consulta y reemplaza un avatar que falla', async () => {
    const avatarUrl = 'https://example.test/avatar.png'
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    mockApi(async () => {
      await pending
      return { ...profileResponse, data: { ...profileResponse.data, avatarUrl } }
    })
    useSessionStore.getState().startSession(token)
    const { container } = renderApp('/profile')

    expect(await screen.findByText('Cargando perfil…')).toBeTruthy()
    expectLocation('/profile')
    expect(screen.queryByRole('heading', { name: 'Bienvenido de nuevo' })).toBeNull()

    await act(async () => finish())
    expect(await screen.findByText(user.email)).toBeTruthy()
    const image = container.querySelector(`main img[src="${avatarUrl}"]`)
    expect(image?.getAttribute('alt')).toBe('')
    fireEvent.error(image!)
    expect(within(screen.getByRole('main')).getByText('N')).toBeTruthy()
    expect(container.querySelector('main img')).toBeNull()
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it.each([undefined, 503])('conserva la sesión tras un fallo inicial (%s) y permite reintentar', async status => {
    let failed = true
    const getProfile = vi.fn((config: InternalAxiosRequestConfig) => failed ? rejectRequest(config, status) : profileResponse)
    mockApi(getProfile)
    const session = useSessionStore.getState().startSession(token)
    renderApp('/profile')

    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos cargar el perfil.')
    expect(getProfile).toHaveBeenCalledTimes(2)
    expect(useSessionStore.getState().session).toEqual(session)
    expectLocation('/profile')
    expect(screen.queryByText(user.email)).toBeNull()

    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(user.email)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('muestra el perfil en caché al navegar y lo conserva si falla la actualización', async () => {
    let failed = false
    const getProfile = vi.fn((config: InternalAxiosRequestConfig) => failed ? rejectRequest(config, 503) : profileResponse)
    mockApi(getProfile)
    const session = useSessionStore.getState().startSession(token)
    const queryKey = [...privateSessionKey(session.id), 'profile']
    renderApp('/')
    await waitFor(() => expect(queryClient.getQueryData(queryKey)).toMatchObject({ email: user.email }))

    fireEvent.click(screen.getByRole('button', { name: 'Menú de cuenta' }))
    const profileLink = screen.getByRole('link', { name: 'Mi perfil' })
    expect(profileLink.getAttribute('href')).toBe('/profile')
    fireEvent.click(profileLink)
    expect(await screen.findByText(user.email)).toBeTruthy()
    const account = screen.getByRole('button', { name: 'Menú de cuenta' })
    expect(account.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(account)
    expect(screen.getByRole('link', { name: 'Mi perfil' }).getAttribute('aria-current')).toBe('page')
    expect(getProfile).toHaveBeenCalledTimes(1)

    failed = true
    await act(async () => { await queryClient.invalidateQueries({ queryKey }) })
    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos actualizar el perfil.')
    expect(screen.getByText(user.email)).toBeTruthy()
    expect(useSessionStore.getState().session).toEqual(session)
    expectLocation('/profile')
  })

  it('espera en el perfil sin conexión y consulta al reconectar', async () => {
    onlineManager.setOnline(false)
    mockApi()
    useSessionStore.getState().startSession(token)
    renderApp('/profile')

    expect((await screen.findByRole('alert')).textContent).toBe('No hay conexión para consultar el perfil.')
    expectLocation('/profile')
    expect(adapter).not.toHaveBeenCalled()
    act(() => onlineManager.setOnline(true))
    expect(await screen.findByText(user.email)).toBeTruthy()
  })

  it('retira el perfil en caché y redirige al login al recibir un 401 vigente', async () => {
    const session = useSessionStore.getState().startSession(token)
    const queryKey = [...privateSessionKey(session.id), 'profile']
    queryClient.setQueryData(queryKey, { ...user, avatarUrl: '', createdAt })
    mockApi(config => rejectRequest(config, 401))
    renderApp('/profile')

    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy()
    expect(useSessionStore.getState().session).toBeNull()
    expect(queryClient.getQueryData(queryKey)).toBeUndefined()
    expect(screen.queryByText(user.email)).toBeNull()
    expectLocation('/login')
  })

  it('restaura /profile al recargar con un nuevo cliente y el almacén vacío', async () => {
    mockApi()
    useSessionStore.getState().startSession(token)
    const firstRender = renderApp('/profile')
    expect(await screen.findByText(user.email)).toBeTruthy()

    firstRender.unmount()
    queryClient.clear()
    queryClient = new QueryClient()
    useSessionStore.getState().restoreSession()
    adapter.mockClear()
    renderApp('/profile')

    expect(await screen.findByText(user.email)).toBeTruthy()
    expectLocation('/profile')
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('espera antes de redirigir si la comprobación inicial termina con un 401', async () => {
    const answer = deferred()
    mockApi(async config => {
      await answer.pending
      rejectRequest(config, 401)
    })
    useSessionStore.getState().restoreSession()
    renderApp('/profile')
    expect(await screen.findByText('Cargando perfil…')).toBeTruthy()
    expectLocation('/profile')
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).toBeNull()

    await act(async () => answer.finish())
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy()
    expectLocation('/login')
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it.each([undefined, 503])('mantiene /profile y permite restaurar tras un fallo inicial (%s)', async status => {
    let available = false
    mockApi(config => available ? profileResponse : rejectRequest(config, status))
    useSessionStore.getState().restoreSession()
    renderApp('/profile')
    expect(await screen.findByText('No pudimos cargar el perfil.')).toBeTruthy()
    expect(useSessionStore.getState().restoring).toBe(true)
    expectLocation('/profile')

    available = true
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(user.email)).toBeTruthy()
    expect(useSessionStore.getState().restoring).toBe(false)
  })

  it.each([['/', 'Catálogo de anime'], ['/animes/neko', 'Anime de prueba']])('mantiene pública la ruta %s', async (path, heading) => {
    mockApi()
    renderApp(path)

    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
    expectLocation(path)
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).toBeNull()
    expect(adapter.mock.calls.some(([config]) => config.url === '/auth/me')).toBe(false)
  })
})

describe('Navegación principal', () => {
  function navigation() {
    return within(screen.getByRole('navigation', { name: 'Navegación principal' }))
  }

  it('muestra los destinos de visitante y marca el enlace activo', async () => {
    mockApi()
    renderApp('/login')
    const nav = navigation()

    expect(nav.getByRole('link', { name: 'NekoVerse' }).getAttribute('href')).toBe('/')
    expect(nav.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('aria-current')).toBe('page')
    expect(nav.queryByRole('button', { name: 'Menú de cuenta' })).toBeNull()
    fireEvent.click(nav.getByRole('link', { name: 'Crear cuenta' }))
    expect(nav.getByRole('link', { name: 'Crear cuenta' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(nav.getByRole('link', { name: 'NekoVerse' }))

    expect(await screen.findByRole('heading', { name: 'Catálogo de anime' })).toBeTruthy()
    expect(nav.getByRole('link', { name: 'Catálogo' }).getAttribute('aria-current')).toBe('page')
    expect(adapter.mock.calls.some(([config]) => config.url === '/auth/me')).toBe(false)
  })

  it('cierra la cuenta con Escape o clic fuera y mantiene una consulta de perfil', async () => {
    mockApi()
    useSessionStore.getState().startSession(token)
    renderApp('/')
    const nav = navigation()
    const trigger = nav.getByRole('button', { name: 'Menú de cuenta' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(nav.queryByRole('link', { name: 'Mi perfil' })).toBeNull()
    expect(await nav.findByText('N')).toBeTruthy()
    expect(nav.queryByRole('link', { name: 'Iniciar sesión' })).toBeNull()

    fireEvent.click(trigger)
    const profileLink = nav.getByRole('link', { name: 'Mi perfil' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)?.contains(profileLink)).toBe(true)
    profileLink.focus()
    fireEvent.keyDown(profileLink, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(nav.queryByRole('link', { name: 'Mi perfil' })).toBeNull()
    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/me')).toHaveLength(1)
  })

  it('usa el avatar y descarta el nombre, la imagen y el menú de la sesión anterior', async () => {
    const avatarUrl = '/avatar-neko.png'
    const nextProfile = { ...profileResponse, data: { ...profileResponse.data, username: 'lumina' } }
    const getProfile = vi.fn<HandleRequest>()
      .mockReturnValueOnce({ ...profileResponse, data: { ...profileResponse.data, avatarUrl } })
      .mockReturnValueOnce(nextProfile)
    mockApi(getProfile)
    const first = useSessionStore.getState().startSession(token)
    const { container } = renderApp('/')
    const nav = navigation()
    expect(await nav.findByText('neko')).toBeTruthy()
    const image = container.querySelector<HTMLImageElement>(`nav img[src="${avatarUrl}"]`)
    expect(image).toBeTruthy()
    fireEvent.error(image!)
    expect(nav.getByText('N')).toBeTruthy()
    fireEvent.click(nav.getByRole('button', { name: 'Menú de cuenta' }))

    await act(async () => {
      endSession(queryClient, first.id)
      useSessionStore.getState().startSession(token)
    })
    expect(await nav.findByText('lumina')).toBeTruthy()
    expect(nav.getByText('L')).toBeTruthy()
    expect(nav.queryByText('neko')).toBeNull()
    expect(container.querySelector(`nav img[src="${avatarUrl}"]`)).toBeNull()
    expect(nav.getByRole('button', { name: 'Menú de cuenta' }).getAttribute('aria-expanded')).toBe('false')
  })
})

function deferred() {
  let finish!: () => void
  const pending = new Promise<void>(resolve => { finish = resolve })
  return { pending, finish }
}

async function showProfile() {
  const session = useSessionStore.getState().startSession(token)
  renderApp('/profile')
  await screen.findByRole('form', { name: 'Editar perfil' })
  return session
}

function editForm() {
  return within(screen.getByRole('form', { name: 'Editar perfil' }))
}

function submitProfile(username: string) {
  const form = editForm()
  fireEvent.change(form.getByLabelText('Nombre de usuario'), { target: { value: username } })
  fireEvent.click(form.getByRole('button', { name: 'Guardar perfil' }))
}

function submitPassword(newPassword = 'nueva-contraseña123', confirmPassword = newPassword) {
  const form = within(screen.getByRole('form', { name: 'Cambiar contraseña' }))
  fireEvent.change(form.getByLabelText('Contraseña actual'), { target: { value: 'contraseña-actual' } })
  fireEvent.change(form.getByLabelText('Contraseña nueva'), { target: { value: newPassword } })
  fireEvent.change(form.getByLabelText('Confirmar contraseña nueva'), { target: { value: confirmPassword } })
  fireEvent.click(form.getByRole('button', { name: 'Cambiar contraseña' }))
  return form
}

describe('Edición del perfil', () => {
  it('envía un solo PATCH con cambios normalizados y conserva la fecha de registro', async () => {
    const update = deferred()
    const patch = vi.fn(async () => {
      await update.pending
      return profileUpdateResponse
    })
    mockApi(undefined, { profile: patch })
    const session = await showProfile()
    const form = editForm()
    expect(form.getByLabelText<HTMLInputElement>('Nombre de usuario').value).toBe(user.username)
    fireEvent.change(form.getByLabelText('Correo electrónico'), { target: { value: ' NEKO@EXAMPLE.COM ' } })
    submitProfile(' neko_nuevo ')
    fireEvent.submit(screen.getByRole('form', { name: 'Editar perfil' }))

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    const request = adapter.mock.calls.find(([config]) => config.method === 'patch')?.[0]
    expect(request?.data).toBe(JSON.stringify({ username: 'neko_nuevo' }))
    expect(request?.headers.get('X-Neko-Session')).toBe(token)
    expect(request?.headers.get('X-Neko-CSRF')).toBe('1')
    await act(async () => update.finish())

    expect(await form.findByText('Perfil actualizado correctamente.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'neko_nuevo' })).toBeTruthy()
    expect(queryClient.getQueryData(profileQueryKey(session.id))).toMatchObject({ username: 'neko_nuevo', createdAt })
    expect(useSessionStore.getState().session).toEqual(session)
  })

  it('descarta una consulta anterior a la escritura para que no restaure el perfil antiguo', async () => {
    const refresh = deferred()
    const getProfile = vi.fn<HandleRequest>().mockReturnValueOnce(profileResponse).mockImplementation(async () => {
      await refresh.pending
      return profileResponse
    })
    mockApi(getProfile)
    const session = await showProfile()
    void queryClient.invalidateQueries({ queryKey: profileQueryKey(session.id) })
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(2))
    const signal = getProfile.mock.calls[1][0].signal

    submitProfile('neko_nuevo')
    expect(await screen.findByText('Perfil actualizado correctamente.')).toBeTruthy()
    expect(signal?.aborted).toBe(true)
    await act(async () => refresh.finish())

    expect(queryClient.getQueryData(profileQueryKey(session.id))).toMatchObject({ username: 'neko_nuevo', createdAt })
  })

  it.each([
    { status: 400, message: 'Revisa los datos del formulario.', data: { errors: { fieldErrors: { username: ['error'] } } } },
    { status: 409, message: 'El correo o nombre de usuario ya está registrado.' },
    { status: 503, message: 'El servidor no pudo completar la solicitud. Inténtalo de nuevo más tarde.' },
    { status: undefined, message: 'No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.' },
  ])('conserva el formulario y el perfil ante $status sin reenviar el PATCH', async ({ status, message, data }) => {
    const patch = vi.fn((config: InternalAxiosRequestConfig) => {
      if (data) throw new AxiosError('Validation', undefined, config, undefined, { config, status: 400, data, headers: {}, statusText: '' })
      return rejectRequest(config, status)
    })
    mockApi(undefined, { profile: patch })
    const session = await showProfile()
    submitProfile('neko_nuevo')

    expect(await editForm().findByText(message)).toBeTruthy()
    expect(editForm().getByLabelText<HTMLInputElement>('Nombre de usuario').value).toBe('neko_nuevo')
    if (status === 400) expect(editForm().getByText('Revisa el nombre de usuario.').getAttribute('role')).toBe('alert')
    expect(queryClient.getQueryData(profileQueryKey(session.id))).toMatchObject({ username: user.username })
    expect(useSessionStore.getState().session).toEqual(session)
    expect(patch).toHaveBeenCalledTimes(1)
  })

  it('no envía un perfil que no cambió después de normalizarlo', async () => {
    mockApi()
    await showProfile()
    submitProfile(` ${user.username} `)
    expect(await editForm().findByText('No hay cambios para guardar.')).toBeTruthy()
    expect(adapter.mock.calls.some(([config]) => config.method === 'patch')).toBe(false)
  })

  it('ignora un éxito de edición que llega después de cambiar de sesión', async () => {
    const update = deferred()
    const write = vi.spyOn(authApi, 'updateUserProfile').mockImplementation(async () => {
      await update.pending
      return profileUpdateResponse.data
    })
    mockApi()
    const first = await showProfile()
    submitProfile('neko_nuevo')
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    const later = await act(async () => {
      endSession(queryClient, first.id)
      return useSessionStore.getState().startSession(token)
    })
    await screen.findByRole('form', { name: 'Editar perfil' })
    await act(async () => update.finish())

    expect(queryClient.getQueryData(profileQueryKey(first.id))).toBeUndefined()
    expect(queryClient.getQueryData(profileQueryKey(later.id))).toMatchObject({ username: user.username })
    expect(screen.queryByText('Perfil actualizado correctamente.')).toBeNull()
    expect(write.mock.calls[0][2].aborted).toBe(true)
  })
})

describe('Cambio de contraseña', () => {
  it('valida confirmación y límite UTF-8 sin emitir una escritura', async () => {
    mockApi()
    await showProfile()
    const form = submitPassword('contraseña-nueva', 'distinta-123')
    expect(await form.findByText('Las contraseñas nuevas no coinciden')).toBeTruthy()
    submitPassword('é'.repeat(36) + 'a')
    expect(await form.findByText('La contraseña no puede superar 72 bytes en UTF-8')).toBeTruthy()
    expect(form.getByLabelText('Contraseña actual').getAttribute('autocomplete')).toBe('current-password')
    expect(form.getByLabelText('Contraseña nueva').getAttribute('autocomplete')).toBe('new-password')
    expect(adapter.mock.calls.some(([config]) => config.method === 'patch')).toBe(false)
    expect(registerSchema.safeParse({ ...user, password: 'é'.repeat(36) }).success).toBe(true)
    expect(registerSchema.safeParse({ ...user, password: 'é'.repeat(36) + 'a' }).success).toBe(false)
  })

  it('asocia un 400 de contraseña incorrecta con el campo actual y conserva la sesión', async () => {
    mockApi(undefined, {
      password: config => {
        const response = { config, status: 400, data: { message: 'La contraseña actual es incorrecta' }, headers: {}, statusText: '' }
        throw new AxiosError('Incorrecta', undefined, config, undefined, response)
      },
    })
    const session = await showProfile()
    const form = submitPassword()
    const field = form.getByLabelText<HTMLInputElement>('Contraseña actual')
    const error = await form.findByText('La contraseña actual es incorrecta.')
    expect(field.getAttribute('aria-describedby')).toBe(error.id)
    expect(field.value).toBe('')
    expect(useSessionStore.getState().session).toEqual(session)
  })

  it.each([undefined, 503])('mantiene la sesión y no reenvía el cambio de contraseña tras un fallo (%s)', async status => {
    const password = vi.fn((config: InternalAxiosRequestConfig) => rejectRequest(config, status))
    mockApi(undefined, { password })
    const session = await showProfile()
    const form = submitPassword()

    expect(await form.findByRole('alert')).toBeTruthy()
    expect(password).toHaveBeenCalledTimes(1)
    expect(useSessionStore.getState().session).toEqual(session)
    expectLocation('/profile')
  })

  it('envía solo las dos contraseñas y vuelve al login al confirmar el cambio', async () => {
    mockApi()
    const session = await showProfile()
    const nextPassword = 'é'.repeat(36)
    submitPassword(nextPassword)

    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy()
    const request = adapter.mock.calls.find(([config]) => config.url === '/auth/change-password')?.[0]
    expect(request?.headers.get('X-Neko-Session')).toBe(token)
    expect(JSON.parse(request?.data)).toEqual({ currentPassword: 'contraseña-actual', newPassword: nextPassword })
    expect(useSessionStore.getState().session).toBeNull()
    expect(queryClient.getQueryData(profileQueryKey(session.id))).toBeUndefined()
    expectLocation('/login')
  })

  it.each(['perfil', 'contraseña'])('un 401 al editar %s limpia la sesión vigente', async form => {
    mockApi(undefined, { profile: config => rejectRequest(config, 401), password: config => rejectRequest(config, 401) })
    const session = await showProfile()
    if (form === 'perfil') submitProfile('neko_nuevo')
    else submitPassword()

    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy()
    expect(useSessionStore.getState().session).toBeNull()
    expect(queryClient.getQueryData(profileQueryKey(session.id))).toBeUndefined()
  })

  it.each([200, 401])('un cambio tardío con HTTP %s no cierra la sesión posterior', async status => {
    const change = deferred()
    const write = vi.spyOn(authApi, 'changeUserPassword').mockImplementation(async () => {
      await change.pending
      if (status === 401) throw new authApi.AuthRequestError('Sesión inválida', { status })
    })
    mockApi()
    const first = await showProfile()
    submitPassword()
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    const later = await act(async () => {
      endSession(queryClient, first.id)
      return useSessionStore.getState().startSession(token)
    })
    await screen.findByRole('form', { name: 'Cambiar contraseña' })
    await act(async () => change.finish())

    expect(useSessionStore.getState().session).toEqual(later)
    expect(queryClient.getQueryData(profileQueryKey(later.id))).toMatchObject({ username: user.username })
    expectLocation('/profile')
  })
})
