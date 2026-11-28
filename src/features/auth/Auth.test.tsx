// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import * as authApi from './api'
import { useLogin } from './hooks/useLogin'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { loginSchema } from './schemas'
import { useSessionStore } from './sessionStore'
import type { LoginResult } from './types'

const user = { id: '1', username: 'neko', email: 'neko@example.com', role: 'user' } as const
const sessionId = 'credential-test'
const adapter = vi.fn<AxiosAdapter>()
const originalAdapter = api.defaults.adapter

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { config, data, status, statusText: '', headers: {} }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise })
  return { promise, resolve }
}

function BackButton() {
  const navigate = useNavigate()
  return <button onClick={() => { void navigate(-1) }}>Atrás</button>
}

function queryWrapper() {
  const queryClient = new QueryClient()
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderAuthPage(path: '/login' | '/register') {
  return render(
    <MemoryRouter initialEntries={['/', path]}>
      <BackButton />
      <Routes>
        <Route path="/" element={<h1>Catálogo</h1>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: queryWrapper() },
  )
}

function fillCredentials(password = 'contraseña123') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: ' NEKO@EXAMPLE.COM ' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
}

beforeEach(() => {
  adapter.mockReset()
  api.defaults.adapter = adapter
  useSessionStore.setState({ session: null, restoring: false, logoutSessionId: null })
})

afterEach(() => {
  cleanup()
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('Formularios de autenticación', () => {
  it('inicia sesión con un solo envío y mantiene el estado de espera hasta recibir respuesta', async () => {
    const pending = deferred<void>()
    adapter.mockImplementation(async config => {
      await pending.promise
      return response(config, { success: true, data: { user, sessionId } })
    })
    renderAuthPage('/login')
    fillCredentials()

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Iniciar sesión' })
    const form = button.form!
    expect(screen.getByLabelText('Correo electrónico').getAttribute('autocomplete')).toBe('username')
    expect(screen.getByLabelText('Contraseña').getAttribute('autocomplete')).toBe('current-password')
    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })

    await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    expect(adapter.mock.calls[0][0]).toMatchObject({
      url: '/auth/login',
      data: JSON.stringify({ email: user.email, password: 'contraseña123' }),
    })
    expect(form.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Enviando…' }).disabled).toBe(true)
    expect(screen.getByLabelText<HTMLInputElement>('Contraseña').disabled).toBe(true)

    pending.resolve()
    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull()
    expect(useSessionStore.getState().session?.credentialId).toBe(sessionId)
  })

  it('registra una cuenta y reemplaza la ruta con el aviso de confirmación en login', async () => {
    adapter.mockImplementation(async config => response(config, { success: true, data: user }, 201))
    renderAuthPage('/register')
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: ' neko ' } })
    fillCredentials()
    const password = screen.getByLabelText('Contraseña')
    expect(password.getAttribute('autocomplete')).toBe('new-password')
    expect(password.getAttribute('aria-describedby')).toBe('password-help')
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    const confirmation = await screen.findByText('Tu cuenta se creó correctamente. Ahora puedes iniciar sesión.')
    expect(confirmation.getAttribute('role')).toBe('status')
    expect(adapter.mock.calls[0][0]).toMatchObject({
      url: '/auth/register',
      data: JSON.stringify({ username: user.username, email: user.email, password: 'contraseña123' }),
    })
    expect(useSessionStore.getState().session).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeTruthy()
  })

  it.each([
    { path: '/login', button: 'Iniciar sesión', passwordMessage: 'Introduce tu contraseña' },
    { path: '/register', button: 'Crear cuenta', passwordMessage: 'La contraseña debe tener al menos 8 caracteres' },
  ] as const)('relaciona los errores con sus campos y solicita el foco en $path', async ({ path, button, passwordMessage }) => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    renderAuthPage(path)
    fireEvent.click(screen.getByRole('button', { name: button }))

    const password = screen.getByLabelText('Contraseña')
    const error = await screen.findByText(passwordMessage)
    expect(error.getAttribute('role')).toBe('alert')
    expect(password.getAttribute('aria-describedby')).toBe(error.id)
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(focus.mock.contexts.at(-1)).toBe(password)
    expect(adapter).not.toHaveBeenCalled()
  })

  it('aplica errores del servidor al formulario y borra la contraseña conservando su error', async () => {
    adapter.mockImplementation(async config => {
      const failure = response(config, { errors: { fieldErrors: { password: ['invalid'] } } }, 400)
      throw new AxiosError('Bad request', 'ERR_BAD_REQUEST', config, undefined, failure)
    })
    renderAuthPage('/login')
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect((await screen.findByText('Revisa los datos del formulario.')).getAttribute('role')).toBe('alert')
    expect((await screen.findByText('Revisa la contraseña.')).getAttribute('role')).toBe('alert')
    expect(screen.getByLabelText<HTMLInputElement>('Contraseña').value).toBe('')
    expect(screen.getByLabelText<HTMLInputElement>('Correo electrónico').value.trim()).toBe('NEKO@EXAMPLE.COM')
    expect(useSessionStore.getState().session).toBeNull()
  })

  it.each([
    { path: '/login', button: 'Iniciar sesión', status: 429, code: 'AUTH_RATE_LIMITED', retryAfter: '125',
      message: 'Demasiados intentos. Vuelve a intentarlo en unos 3 minutos.' },
    { path: '/register', button: 'Crear cuenta', status: 429, code: 'AUTH_RATE_LIMITED', retryAfter: undefined,
      message: 'Demasiados intentos. Espera un momento antes de volver a intentarlo.' },
    { path: '/register', button: 'Crear cuenta', status: 429, code: 'AUTH_RATE_LIMITED', retryAfter: '-1',
      message: 'Demasiados intentos. Espera un momento antes de volver a intentarlo.' },
    { path: '/login', button: 'Iniciar sesión', status: 503, code: 'AUTH_BUSY', retryAfter: '2',
      message: 'El servicio de autenticación está ocupado. Vuelve a intentarlo en 2 segundos.' },
  ] as const)('muestra $code en $path sin reenviar la solicitud', async ({ path, button, status, code, retryAfter, message }) => {
    const session = path === '/login' ? useSessionStore.getState().startSession('existing-session') : null
    adapter.mockImplementation(async config => {
      const headers = new AxiosHeaders()
      if (retryAfter !== undefined) headers.set('Retry-After', retryAfter)
      const failure = { ...response(config, { success: false, code }, status), headers }
      throw new AxiosError('Error HTTP', undefined, config, undefined, failure)
    })
    renderAuthPage(path)
    if (path === '/register') fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'neko' } })
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: button }))

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(useSessionStore.getState().session).toEqual(session)
  })

  it('informa de una excepción durante el envío y permite volver a intentarlo', async () => {
    vi.spyOn(loginSchema, 'safeParse').mockImplementationOnce(() => {
      throw new Error('Fallo de validación simulado')
    })
    adapter.mockImplementation(async config => response(config, { success: true, data: { user, sessionId } }))
    renderAuthPage('/login')
    fillCredentials()

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Iniciar sesión' })
    fireEvent.click(button)

    const error = await screen.findByRole('alert')
    expect(error.textContent).toBe('Ocurrió un error inesperado en el formulario.')
    expect(button.form?.getAttribute('aria-busy')).toBe('false')
    expect(button.disabled).toBe(false)
    expect(adapter).not.toHaveBeenCalled()
    expect(useSessionStore.getState().session).toBeNull()

    fireEvent.click(button)
    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('conserva el token y omite el error de autenticación si falla onSuccess', async () => {
    vi.spyOn(authApi, 'loginUser').mockResolvedValue({ user, sessionId })
    const onSuccess = vi.fn(() => {
      expect(useSessionStore.getState().session?.credentialId).toBe(sessionId)
      throw new Error('Fallo en el efecto de éxito')
    })
    const onError = vi.fn()
    const onUnexpectedError = vi.fn()
    const { result } = renderHook(() => useLogin(), { wrapper: queryWrapper() })

    await act(async () => {
      const { login, runSubmission } = result.current
      await runSubmission(() => login({ email: user.email, password: 'contraseña123' }, { onSuccess, onError }), onUnexpectedError)
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(onUnexpectedError).toHaveBeenCalledTimes(1)
    expect(useSessionStore.getState().session?.credentialId).toBe(sessionId)
  })

  it.each([
    { path: '/login', button: 'Iniciar sesión', data: { user, sessionId } },
    { path: '/register', button: 'Crear cuenta', data: user },
  ] as const)('aborta el envío al salir de $path e ignora su respuesta tardía', async ({ path, button, data }) => {
    const pending = deferred<void>()
    adapter.mockImplementation(async config => {
      await pending.promise
      return response(config, { success: true, data })
    })
    renderAuthPage(path)
    if (path === '/register') {
      fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: user.username } })
    }
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: button }))
    await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    const signal = adapter.mock.calls[0][0].signal
    fireEvent.click(screen.getByRole('link', { name: 'Volver al catálogo' }))

    if (path === '/register') expect(signal?.aborted).toBe(true)
    else expect(signal).toBeUndefined()
    await act(async () => pending.resolve())
    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(useSessionStore.getState().session).toBeNull()
  })

  it('descarta un login anterior incluso si su formulario sigue montado', async () => {
    const olderLogin = deferred<LoginResult>()
    const login = vi.spyOn(authApi, 'loginUser')
      .mockImplementationOnce(() => olderLogin.promise)
      .mockResolvedValueOnce({ user, sessionId })
    const first = renderAuthPage('/login')
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1))

    const second = renderAuthPage('/login')
    const email = second.container.querySelector('#email')!
    const password = second.container.querySelector('#password')!
    fireEvent.change(email, { target: { value: user.email } })
    fireEvent.change(password, { target: { value: 'contraseña123' } })
    fireEvent.submit(password.closest('form')!)
    expect(login).toHaveBeenCalledTimes(1)

    await act(async () => olderLogin.resolve({ user, sessionId: 'older-credential' }))
    await screen.findByRole('heading', { name: 'Catálogo' })
    expect(login).toHaveBeenCalledTimes(2)
    expect(useSessionStore.getState().session?.credentialId).toBe(sessionId)
    expect(first.container.querySelector('form')?.getAttribute('aria-busy')).toBe('false')
  })
})
