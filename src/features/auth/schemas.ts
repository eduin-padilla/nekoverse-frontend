import { z } from 'zod'

const username = z.string().trim().min(3, 'El usuario debe tener al menos 3 caracteres').max(30, 'El usuario no puede superar 30 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Usa solo letras, números y guiones bajos')
const email = z.string().trim().email('Introduce un correo válido').max(254, 'El correo no puede superar 254 caracteres').transform(value => value.toLowerCase())
const newPassword = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine(value => new TextEncoder().encode(value).length <= 72, 'La contraseña no puede superar 72 bytes en UTF-8')

export const loginSchema = z.object({
  email: z.string().trim().email('Introduce un correo válido').transform(value => value.toLowerCase()),
  password: z.string().min(1, 'Introduce tu contraseña').max(72, 'La contraseña no puede superar 72 caracteres'),
})

export const registerSchema = z.object({
  username, email, password: newPassword,
})

export const updateProfileSchema = z.object({ username: username.optional(), email: email.optional() })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Introduce tu contraseña actual'),
  newPassword,
  confirmPassword: z.string().min(1, 'Confirma tu contraseña nueva'),
}).refine(values => values.currentPassword !== values.newPassword, {
  path: ['newPassword'], message: 'La nueva contraseña debe ser diferente a la actual',
}).refine(values => values.newPassword === values.confirmPassword, {
  path: ['confirmPassword'], message: 'Las contraseñas nuevas no coinciden',
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export type ChangePasswordInput = Omit<ChangePasswordValues, 'confirmPassword'>
