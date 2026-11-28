// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import * as authApi from './api'
import { LoginForm } from './components/LoginForm'
import { SessionControls } from './components/SessionControls'
import { privateSessionKey } from './sessionQueries'
import { useSessionStore } from './sessionStore'

const token = 'first.payload.signature'
const nextToken = 'second.payload.signature'
const user = { id: '507f1f77bcf86cd799439011', username: 'neko', email: 'neko@example.com', role: 'user' } as const
const profile = { ...user, avatarUrl: '', createdAt: '2026-01-01T00:00:00.000Z' }
const profileResponse = {
  success: true,
  sessionId: token,
  data: { _id: user.id, username: user.username, email: user.email, role: user.role, createdAt: profile.createdAt },
}
const logoutResponse = { success: true, message: 'Sesión cerrada correctamente' }
const publicKey = ['animes', { page: 1 }]
const adapter = vi.fn<AxiosAdapter>()
const originalAdapter = api.defaults.adapter
let queryClient: QueryClient

type RequestHandler = (config: InternalAxiosRequestConfig) => unknown

function mockRequests({ me, login, logout, local }: { me?: RequestHandler; login?: RequestHandler; logout?: RequestHandler; local?: RequestHandler } = {}) {
  adapter.mockImplementation(async config => {
    let data: unknown
    switch (config.url) {
      case '/auth/me': data = me ? await me(config) : profileResponse; break
      case '/auth/login': data = login ? await login(config) : { success: true, data: { user, sessionId: token } }; break
      case '/auth/logout': data = logout ? await logout(config) : logoutResponse; break
      case '/auth/logout/local': return { config, data: await local?.(config), status: 204, statusText: 'OK', headers: {} }
      default: throw new Error(`Solicitud inesperada: ${config.url}`)
    }
    return { config, data, status: 200, statusText: 'OK', headers: {} }
  })
}

function rejectRequest(config: InternalAxiosRequestConfig, status?: number): never {
  if (status === undefined) throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  const response = { config, status, data: { success: false }, headers: {}, statusText: '' }
  throw new AxiosError('Error HTTP', undefined, config, undefined, response)
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

function renderSession(withLogin = false) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SessionControls />
        {withLogin && <LoginForm registered={false} />}
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: user.email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña123' } })
  fireEvent.submit(screen.getByRole<HTMLButtonElement>('button', { name: 'Iniciar sesión' }).form!)
}

function logoutButton() {
  const account = screen.getByRole('button', { name: 'Menú de cuenta' })
  if (account.getAttribute('aria-expanded') === 'false') fireEvent.click(account)
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Cerrar sesión en todos los dispositivos' })
}

function profileKey(sessionId: number) {
  return [...privateSessionKey(sessionId), 'profile']
}

beforeEach(() => {
  adapter.mockReset()
  api.defaults.adapter = adapter
  useSessionStore.setState({ session: null, restoring: false, logoutSessionId: null })
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  queryClient.setQueryData(publicKey, ['anime público'])
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  onlineManager.setOnline(true)
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('Perfil de la sesión', () => {
  it('consulta /me tras iniciar sesión y guarda el perfil normalizado en React Query', async () => {
    mockRequests()
    renderSession(true)
    expect(adapter).not.toHaveBeenCalled()
    submitLogin()

    expect(await screen.findByText('Inicio de sesión correcto')).toBeTruthy()
    const session = useSessionStore.getState().session!
    expect(session).toEqual({ id: expect.any(Number), credentialId: token })
    await waitFor(() => expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile))
    const request = adapter.mock.calls.find(([config]) => config.url === '/auth/me')?.[0]
    expect(request?.method).toBe('get')
    expect(request?.headers.has('Authorization')).toBe(false)
    expect(request?.withCredentials).toBe(true)
    expect(queryClient.getQueryCache().getAll().map(query => query.queryHash).join()).not.toContain(token)
  })

  it('limpia toda la caché privada de la sesión vigente al recibir un 401 y conserva el catálogo', async () => {
    const session = useSessionStore.getState().startSession(token)
    queryClient.setQueryData(profileKey(session.id), profile)
    queryClient.setQueryData([...privateSessionKey(session.id), 'private-data'], ['privado'])
    mockRequests({ me: config => rejectRequest(config, 401) })
    renderSession()

    await waitFor(() => expect(useSessionStore.getState().session).toBeNull())
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeTruthy()
    expect(queryClient.getQueriesData({ queryKey: privateSessionKey(session.id) })).toEqual([])
    expect(queryClient.getQueryData(publicKey)).toEqual(['anime público'])
  })

  it.each([
    { label: 'red', status: undefined, attempts: 2 },
    { label: '5xx', status: 503, attempts: 2 },
    { label: '404', status: 404, attempts: 1 },
    { label: 'respuesta inválida', status: 200, attempts: 1 },
  ])('conserva el JWT y el perfil ante $label', async ({ status, attempts }) => {
    const session = useSessionStore.getState().startSession(token)
    queryClient.setQueryData(profileKey(session.id), profile)
    const me = vi.fn<RequestHandler>(config => status === 200 ? { success: true, data: { _id: user.id } } : rejectRequest(config, status))
    mockRequests({ me })
    renderSession()

    expect(await screen.findByText('No pudimos actualizar el perfil.')).toBeTruthy()
    expect(me).toHaveBeenCalledTimes(attempts)
    expect(useSessionStore.getState().session).toEqual(session)
    expect(logoutButton()).toBeTruthy()
    expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile)
  })

  it('trata un 401 de login como un error de credenciales y mantiene la sesión actual', async () => {
    const session = useSessionStore.getState().startSession(token)
    mockRequests({ login: config => rejectRequest(config, 401) })
    renderSession(true)
    submitLogin()

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeTruthy()
    expect(useSessionStore.getState().session).toEqual(session)
    await waitFor(() => expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile))
  })

  it.each(['éxito', '401'])('descarta un /me tardío con %s después de otro login, aunque se repita el JWT', async result => {
    const pendingProfile = deferred()
    const first = useSessionStore.getState().startSession(token)
    const getProfile = vi.spyOn(authApi, 'getUserProfile')
      .mockImplementationOnce(async () => {
        await pendingProfile.promise
        if (result === '401') throw new authApi.AuthRequestError('Sesión inválida', { status: 401 })
        return { sessionId: token, profile: { ...profile, username: 'Perfil anterior' } }
      })
      .mockResolvedValueOnce({ sessionId: token, profile: { ...profile, username: 'Perfil nuevo' } })
    queryClient.setQueryData([...privateSessionKey(first.id), 'private-data'], 'anterior')
    mockRequests()
    renderSession(true)
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    const signal = getProfile.mock.calls[0][0]
    submitLogin()

    expect(await screen.findByText('Inicio de sesión correcto')).toBeTruthy()
    const second = useSessionStore.getState().session!
    expect(second.id).not.toBe(first.id)
    expect(second.credentialId).toBe(first.credentialId)
    expect(signal.aborted).toBe(true)
    await waitFor(() => expect(queryClient.getQueryData(profileKey(second.id))).toMatchObject({ username: 'Perfil nuevo' }))
    await act(async () => pendingProfile.resolve())

    expect(useSessionStore.getState().session).toEqual(second)
    expect(queryClient.getQueriesData({ queryKey: privateSessionKey(first.id) })).toEqual([])
    expect(queryClient.getQueryData(profileKey(second.id))).toMatchObject({ username: 'Perfil nuevo' })
    expect(queryClient.getQueryData(publicKey)).toEqual(['anime público'])
  })
})

describe('Cierre de sesión', () => {
  it('se resincroniza si el navegador sustituyó la cookie antes de cerrar sesión', async () => {
    const old = useSessionStore.getState().startSession(token)
    let current = token
    mockRequests({
      me: () => ({ ...profileResponse, sessionId: current }),
      logout: config => {
        current = nextToken
        const response = { config, status: 409, data: { code: 'SESSION_CHANGED' }, headers: {}, statusText: '' }
        throw new AxiosError('Conflicto', undefined, config, undefined, response)
      },
    })
    renderSession()
    await waitFor(() => expect(queryClient.getQueryData(profileKey(old.id))).toEqual(profile))
    fireEvent.click(logoutButton())
    await waitFor(() => expect(useSessionStore.getState().session?.credentialId).toBe(nextToken))
    expect(queryClient.getQueryData(profileKey(old.id))).toBeUndefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('no informa que cerró la sesión si el cierre en este navegador falla', async () => {
    const session = useSessionStore.getState().startSession(token)
    mockRequests({ local: config => rejectRequest(config, 503) })
    renderSession()
    logoutButton()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión en este navegador' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos confirmar el cierre en este navegador.')
    expect(useSessionStore.getState().session).toEqual(session)
  })
  it.each([200, 401])('cierra la sesión vigente y elimina la caché privada con HTTP %s', async status => {
    mockRequests({ logout: config => status === 401 ? rejectRequest(config, status) : logoutResponse })
    renderSession(true)
    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe('/login')
    expect(screen.getByRole('link', { name: 'Crear cuenta' }).getAttribute('href')).toBe('/register')
    submitLogin()
    expect(await screen.findByText('Inicio de sesión correcto')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).toBeNull()
    const session = useSessionStore.getState().session!
    await waitFor(() => expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile))
    expect(screen.getByRole('button', { name: 'Menú de cuenta' }).textContent).toContain(user.username)
    fireEvent.click(logoutButton())

    await waitFor(() => expect(useSessionStore.getState().session).toBeNull())
    const request = adapter.mock.calls.find(([config]) => config.url === '/auth/logout')?.[0]
    expect(request?.method).toBe('post')
    expect(request?.headers.get('X-Neko-Session')).toBe(token)
    expect(request?.headers.get('X-Neko-CSRF')).toBe('1')
    expect(queryClient.getQueriesData({ queryKey: privateSessionKey(session.id) })).toEqual([])
    expect(queryClient.getQueryData(publicKey)).toEqual(['anime público'])
    expect(screen.queryByText('Inicio de sesión correcto')).toBeNull()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy()
  })

  it.each([undefined, 503, 200])('informa del cierre sin confirmar (%s) y permite cerrar en el navegador', async status => {
    const session = useSessionStore.getState().startSession(token)
    const logout = vi.fn<RequestHandler>(config => status === 200 ? { success: true } : rejectRequest(config, status))
    mockRequests({ logout })
    renderSession()
    await waitFor(() => expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile))
    fireEvent.click(logoutButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('No pudimos confirmar el cierre en todos los dispositivos.')
    expect(useSessionStore.getState().session).toEqual(session)
    expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión en este navegador' }))

    await waitFor(() => expect(useSessionStore.getState().session).toBeNull())
    expect(logout).toHaveBeenCalledTimes(1)
    expect(adapter.mock.calls.some(([request]) => request.url === '/auth/logout/local')).toBe(true)
    expect(queryClient.getQueriesData({ queryKey: privateSessionKey(session.id) })).toEqual([])
    expect(queryClient.getQueryData(publicKey)).toEqual(['anime público'])
  })

  it('al reconectar, /me detecta la revocación si se perdió la respuesta del logout', async () => {
    const session = useSessionStore.getState().startSession(token)
    let revoked = false
    mockRequests({
      me: config => revoked ? rejectRequest(config, 401) : profileResponse,
      logout: config => { revoked = true; return rejectRequest(config) },
    })
    renderSession()
    await waitFor(() => expect(queryClient.getQueryData(profileKey(session.id))).toEqual(profile))
    act(() => onlineManager.setOnline(false))
    fireEvent.click(logoutButton())
    await screen.findByRole('alert')
    expect(useSessionStore.getState().session).toEqual(session)

    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(useSessionStore.getState().session).toBeNull())
    expect(queryClient.getQueryData(profileKey(session.id))).toBeUndefined()
  })

  it('el cierre local también cancela un login iniciado después del fallo remoto', async () => {
    const pendingLogin = deferred()
    useSessionStore.getState().startSession(token)
    const login = vi.spyOn(authApi, 'loginUser').mockImplementationOnce(async () => {
      await pendingLogin.promise
      throw new authApi.AuthRequestError('Credenciales incorrectas', { status: 401 })
    })
    mockRequests({ logout: config => rejectRequest(config, 503) })
    renderSession(true)
    fireEvent.click(logoutButton())
    const localLogout = await screen.findByRole('button', { name: 'Cerrar sesión en este navegador' })
    submitLogin()
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1))

    fireEvent.click(localLogout)
    expect(adapter.mock.calls.some(([request]) => request.url === '/auth/logout/local')).toBe(false)
    await act(async () => pendingLogin.resolve())
    await waitFor(() => expect(useSessionStore.getState().session).toBeNull())
    expect(screen.queryByText('Inicio de sesión correcto')).toBeNull()
  })

  it('invalida el login pendiente, bloquea nuevos intentos y envía un solo POST al hacer doble clic', async () => {
    const pendingLogin = deferred()
    const pendingLogout = deferred()
    const session = useSessionStore.getState().startSession(token)
    const login = vi.spyOn(authApi, 'loginUser').mockImplementationOnce(async () => {
      await pendingLogin.promise
      throw new authApi.AuthRequestError('Credenciales incorrectas', { status: 401 })
    })
    const logout = vi.fn(async () => { await pendingLogout.promise; return logoutResponse })
    mockRequests({ logout })
    renderSession(true)
    submitLogin()
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1))
    const button = logoutButton()
    act(() => { fireEvent.click(button); fireEvent.click(button) })

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cerrando sesión…' }).disabled).toBe(true)
    expect(logout).not.toHaveBeenCalled()
    await act(async () => pendingLogin.resolve())
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
    const loginButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Iniciar sesión' })
    expect(loginButton.disabled).toBe(true)
    await act(async () => { fireEvent.submit(loginButton.form!) })
    expect(login).toHaveBeenCalledTimes(1)
    expect(useSessionStore.getState().session).toEqual(session)
    expect(screen.queryByText('Inicio de sesión correcto')).toBeNull()

    await act(async () => pendingLogout.resolve())
    expect(useSessionStore.getState().session).toBeNull()
    expect(loginButton.disabled).toBe(false)
  })

  it.each([200, 401, 503])('un logout tardío con HTTP %s no afecta una sesión posterior', async status => {
    const first = useSessionStore.getState().startSession(token)
    const pendingLogout = deferred()
    const logout = vi.fn<RequestHandler>(async config => {
      await pendingLogout.promise
      return status === 200 ? logoutResponse : rejectRequest(config, status)
    })
    mockRequests({ logout, me: () => ({ ...profileResponse, sessionId: useSessionStore.getState().session?.credentialId ?? token }) })
    renderSession()
    fireEvent.click(logoutButton())
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
    const second = await act(async () => useSessionStore.getState().startSession(nextToken))
    await waitFor(() => expect(queryClient.getQueryData(profileKey(second.id))).toEqual(profile))
    await act(async () => pendingLogout.resolve())

    expect(useSessionStore.getState().session).toEqual(second)
    expect(useSessionStore.getState().logoutSessionId).toBeNull()
    expect(first.id).not.toBe(second.id)
    expect(queryClient.getQueryData(profileKey(second.id))).toEqual(profile)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
