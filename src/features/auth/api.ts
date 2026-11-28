import axios from 'axios'
import { z } from 'zod'
import { api } from '../../lib/api'
import type { ChangePasswordInput, UpdateProfileInput } from './schemas'
import type { AuthField, AuthFieldErrors, AuthUser, LoginInput, LoginResult, RegisterInput, UserProfile } from './types'

const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().trim().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
})
const loginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ sessionId: z.string().min(1), user: userSchema }),
})
const registerResponseSchema = z.object({ success: z.literal(true), data: userSchema })
const profileResponseSchema = z.object({
  success: z.literal(true),
  sessionId: z.string().min(1),
  data: userSchema.omit({ id: true }).extend({
    _id: userSchema.shape.id,
    avatarUrl: z.string().nullish(),
    createdAt: z.iso.datetime(),
  }),
})
const updateProfileResponseSchema = z.object({ success: z.literal(true), data: userSchema.extend({ avatarUrl: z.string().nullish() }) })
const messageResponseSchema = z.object({ success: z.literal(true), message: z.string().min(1) })
const fieldIssues = z.array(z.string()).optional()
const validationResponseSchema = z.object({
  errors: z.object({ fieldErrors: z.object({ username: fieldIssues, email: fieldIssues, password: fieldIssues, currentPassword: fieldIssues, newPassword: fieldIssues }) }),
})
const incorrectPasswordResponse = z.object({ message: z.literal('La contraseña actual es incorrecta') })
const fieldMessages = {
  username: 'Revisa el nombre de usuario.', email: 'Revisa el correo electrónico.', password: 'Revisa la contraseña.',
  currentPassword: 'Revisa la contraseña actual.', newPassword: 'Usa al menos 8 caracteres y como máximo 72 bytes, distintos de la contraseña actual.',
} satisfies Partial<Record<AuthField, string>>

interface AuthErrorDetails {
  fieldErrors?: AuthFieldErrors
  cancelled?: boolean
  status?: number
  networkError?: boolean
  sessionChanged?: boolean
  code?: 'AUTH_RATE_LIMITED' | 'AUTH_BUSY'
  retryAfterSeconds?: number
}

export class AuthRequestError extends Error {
  readonly fieldErrors: AuthFieldErrors

  constructor(message: string, public readonly details: AuthErrorDetails = {}) {
    super(message)
    this.name = 'AuthRequestError'
    this.fieldErrors = details.fieldErrors ?? {}
  }
}

function readRetryAfter(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined
}

function retryMessage(seconds: number | undefined) {
  if (seconds === undefined) return 'Espera un momento antes de volver a intentarlo.'
  if (seconds === 1) return 'Vuelve a intentarlo en 1 segundo.'
  if (seconds < 60) return `Vuelve a intentarlo en ${seconds} segundos.`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? 'Vuelve a intentarlo en 1 minuto.' : `Vuelve a intentarlo en unos ${minutes} minutos.`
}

function toAuthError(error: unknown, operation: 'login' | 'register' | 'session' | 'updateProfile' | 'changePassword'): AuthRequestError {
  if (error instanceof AuthRequestError) return error
  if (axios.isCancel(error)) return new AuthRequestError('La solicitud fue cancelada', { cancelled: true })
  if (!axios.isAxiosError(error)) return new AuthRequestError('No pudimos completar la solicitud. Inténtalo de nuevo.')
  if (!error.response) {
    return new AuthRequestError('No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.', { networkError: true })
  }

  const { status, data } = error.response
  const code = data && typeof data === 'object' && 'code' in data ? data.code : undefined
  const busy = status === 503 && code === 'AUTH_BUSY'
  if (status === 429 || busy) {
    const { headers } = error.response
    const retryAfter = headers instanceof axios.AxiosHeaders
      ? headers.get('Retry-After')
      : Object.entries(headers).find(([name]) => name.toLowerCase() === 'retry-after')?.[1]
    const retryAfterSeconds = readRetryAfter(retryAfter)
    const message = busy ? 'El servicio de autenticación está ocupado.' : 'Demasiados intentos.'
    return new AuthRequestError(`${message} ${retryMessage(retryAfterSeconds)}`, {
      status, code: busy ? 'AUTH_BUSY' : code === 'AUTH_RATE_LIMITED' ? code : undefined, retryAfterSeconds,
    })
  }
  if (status === 409 && code === 'SESSION_CHANGED') {
    return new AuthRequestError('La sesión cambió en el navegador.', { status, sessionChanged: true })
  }
  if (status === 401) {
    const message = operation === 'login' ? 'Correo o contraseña incorrectos.' : 'Tu sesión ya no está activa.'
    return new AuthRequestError(message, { status })
  }
  if (status === 409 && operation !== 'session' && operation !== 'changePassword') {
    return new AuthRequestError('El correo o nombre de usuario ya está registrado.', { status })
  }
  if (status === 400 && operation !== 'session') {
    if (operation === 'changePassword' && incorrectPasswordResponse.safeParse(data).success) {
      return new AuthRequestError('Comprueba tu contraseña actual.', { status, fieldErrors: { currentPassword: 'La contraseña actual es incorrecta.' } })
    }
    const validation = validationResponseSchema.safeParse(data)
    const fieldErrors: AuthFieldErrors = {}
    if (validation.success) {
      for (const field of Object.keys(fieldMessages) as Array<keyof typeof fieldMessages>) {
        if (validation.data.errors.fieldErrors[field]?.length) fieldErrors[field] = fieldMessages[field]
      }
    }
    return new AuthRequestError('Revisa los datos del formulario.', { status, fieldErrors })
  }
  return new AuthRequestError('El servidor no pudo completar la solicitud. Inténtalo de nuevo más tarde.', { status })
}

function writeHeaders(credentialId?: string) {
  return credentialId ? { 'X-Neko-CSRF': '1', 'X-Neko-Session': credentialId } : { 'X-Neko-CSRF': '1' }
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  try {
    const response = await api.post<unknown>('/auth/login', input, { headers: writeHeaders() })
    const result = loginResponseSchema.safeParse(response.data)
    if (!result.success) throw new AuthRequestError('El servidor devolvió una respuesta de acceso incompleta o no válida.')
    return result.data.data
  } catch (error) {
    throw toAuthError(error, 'login')
  }
}

export async function registerUser(input: RegisterInput, signal?: AbortSignal): Promise<AuthUser> {
  try {
    const response = await api.post<unknown>('/auth/register', input, { signal, headers: writeHeaders() })
    const result = registerResponseSchema.safeParse(response.data)
    if (!result.success) throw new AuthRequestError('No pudimos confirmar el registro: la respuesta del servidor está incompleta.')
    return result.data.data
  } catch (error) {
    throw toAuthError(error, 'register')
  }
}

export async function getUserProfile(signal: AbortSignal): Promise<{ sessionId: string; profile: UserProfile }> {
  try {
    const response = await api.get<unknown>('/auth/me', { signal })
    const result = profileResponseSchema.safeParse(response.data)
    if (!result.success) throw new AuthRequestError('El servidor devolvió un perfil incompleto o no válido.')
    const { _id, avatarUrl, ...profile } = result.data.data
    return { sessionId: result.data.sessionId, profile: { id: _id, avatarUrl: avatarUrl ?? '', ...profile } }
  } catch (error) {
    throw toAuthError(error, 'session')
  }
}

export async function logoutUser(credentialId: string, local = false): Promise<void> {
  try {
    const response = await api.post<unknown>(local ? '/auth/logout/local' : '/auth/logout', undefined, { headers: writeHeaders(credentialId) })
    const confirmed = local ? response.status === 204 : messageResponseSchema.safeParse(response.data).success
    if (!confirmed) {
      throw new AuthRequestError('El servidor devolvió una confirmación de cierre no válida.')
    }
  } catch (error) {
    throw toAuthError(error, 'session')
  }
}

export async function updateUserProfile(credentialId: string, input: UpdateProfileInput, signal: AbortSignal): Promise<Omit<UserProfile, 'createdAt'>> {
  try {
    const response = await api.patch<unknown>('/auth/me', input, { signal, headers: writeHeaders(credentialId) })
    const result = updateProfileResponseSchema.safeParse(response.data)
    if (!result.success) throw new AuthRequestError('No pudimos confirmar la actualización del perfil.')
    const { avatarUrl, ...profile } = result.data.data
    return { ...profile, avatarUrl: avatarUrl ?? '' }
  } catch (error) {
    throw toAuthError(error, 'updateProfile')
  }
}

export async function changeUserPassword(credentialId: string, input: ChangePasswordInput): Promise<void> {
  try {
    const response = await api.patch<unknown>('/auth/change-password', input, { headers: writeHeaders(credentialId) })
    if (!messageResponseSchema.safeParse(response.data).success) {
      throw new AuthRequestError('No pudimos confirmar el cambio de contraseña.')
    }
  } catch (error) {
    throw toAuthError(error, 'changePassword')
  }
}
