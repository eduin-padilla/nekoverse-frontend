export type { LoginInput, RegisterInput } from './schemas'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
}

export interface UserProfile extends AuthUser {
  avatarUrl: string
  createdAt: string
}

export type AuthField = 'username' | 'email' | 'password' | 'currentPassword' | 'newPassword' | 'confirmPassword'
export type AuthFieldErrors = Partial<Record<AuthField, string>>

export interface LoginResult {
  sessionId: string
  user: AuthUser
}
