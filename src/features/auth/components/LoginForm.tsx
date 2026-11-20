import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { setServerErrors, setUnexpectedError, setValidationErrors } from '../formErrors'
import { useLogin } from '../hooks/useLogin'
import { loginSchema, type LoginInput } from '../schemas'
import { useSessionStore } from '../sessionStore'
import { AuthField, AuthServerError, AuthSubmitButton } from './AuthFormControls'
import { AuthLayout } from './AuthLayout'

const fields = ['email', 'password'] as const

export function LoginForm({ registered, onAuthenticated }: { registered: boolean; onAuthenticated?: () => void }) {
  const [confirmedSessionId, setConfirmedSessionId] = useState<number | null>(null)
  const signedIn = useSessionStore(state => state.session?.id === confirmedSessionId)
  const isLoggingOut = useSessionStore(state => state.logoutSessionId !== null)
  const { login, runSubmission } = useLogin()
  const { register, handleSubmit, setError, clearErrors, resetField, formState: { errors, isSubmitting } } =
    useForm<LoginInput>({ defaultValues: { email: '', password: '' } })

  async function submit(values: LoginInput) {
    clearErrors()
    const validation = loginSchema.safeParse(values)
    if (!validation.success) {
      setValidationErrors(validation.error, fields, setError)
      return
    }

    await login(validation.data, {
      onSuccess: sessionId => {
        resetField('password')
        if (onAuthenticated) return onAuthenticated()
        setConfirmedSessionId(sessionId)
      },
      onError: error => {
        setServerErrors(error, fields, setError)
        resetField('password', { keepError: true })
      },
    })
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" description="Inicia sesión para continuar en tu universo de anime.">
      {signedIn ? (
        <div role="status" className="mt-7 space-y-4 rounded-xl border border-violet-400/20 bg-violet-400/5 p-5">
          <CheckCircle2 className="text-violet-300" aria-hidden="true" />
          <p className="font-medium">Inicio de sesión correcto</p>
          <Link to="/" className="inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">Ir al catálogo</Link>
        </div>
      ) : (
        <>
          {registered && <p role="status" className="mt-6 rounded-xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-violet-200">Tu cuenta se creó correctamente. Ahora puedes iniciar sesión.</p>}
          <form
            noValidate
            onSubmit={event => {
              event.preventDefault()
              void runSubmission(() => handleSubmit(submit)(event), () => setUnexpectedError(setError))
            }}
            className="mt-7 space-y-5"
            aria-busy={isSubmitting}
          >
            <AuthServerError error={errors.root?.unexpected ?? errors.root?.server} />
            <AuthField
              registration={register('email')} label="Correo electrónico" type="email" autoComplete="username"
              placeholder="tu@correo.com" error={errors.email} disabled={isSubmitting || isLoggingOut}
            />
            <AuthField
              registration={register('password')} label="Contraseña" type="password" autoComplete="current-password"
              maxLength={72} error={errors.password} disabled={isSubmitting || isLoggingOut}
            />
            <AuthSubmitButton label="Iniciar sesión" isSubmitting={isSubmitting} disabled={isLoggingOut} />
          </form>
          <p className="mt-6 text-center text-sm text-slate-400">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/register" className="rounded font-medium text-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-400">Regístrate</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
