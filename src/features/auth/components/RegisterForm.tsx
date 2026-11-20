import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { setServerErrors, setUnexpectedError, setValidationErrors } from '../formErrors'
import { useRegister } from '../hooks/useRegister'
import { registerSchema, type RegisterInput } from '../schemas'
import { AuthField, AuthServerError, AuthSubmitButton } from './AuthFormControls'
import { AuthLayout } from './AuthLayout'

const fields = ['username', 'email', 'password'] as const

export function RegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const { registerAccount, runSubmission } = useRegister()
  const { register, handleSubmit, setError, clearErrors, resetField, formState: { errors, isSubmitting } } =
    useForm<RegisterInput>({ defaultValues: { username: '', email: '', password: '' } })

  async function submit(values: RegisterInput) {
    clearErrors()
    const validation = registerSchema.safeParse(values)
    if (!validation.success) {
      setValidationErrors(validation.error, fields, setError)
      return
    }

    await registerAccount(validation.data, {
      onSuccess: () => {
        resetField('password')
        onRegistered()
      },
      onError: error => {
        setServerErrors(error, fields, setError)
        resetField('password', { keepError: true })
      },
    })
  }

  return (
    <AuthLayout title="Crea tu cuenta" description="Comienza tu historia en NekoVerse.">
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
          registration={register('username')} label="Nombre de usuario" autoComplete="username" maxLength={30}
          placeholder="Tu nombre en NekoVerse" error={errors.username} disabled={isSubmitting}
        />
        <AuthField
          registration={register('email')} label="Correo electrónico" type="email" autoComplete="email"
          maxLength={254} placeholder="tu@correo.com" error={errors.email} disabled={isSubmitting}
        />
        <AuthField
          registration={register('password')} label="Contraseña" type="password" autoComplete="new-password"
          maxLength={72} error={errors.password} help="Al menos 8 caracteres y hasta 72 bytes en UTF-8." disabled={isSubmitting}
        />
        <AuthSubmitButton label="Crear cuenta" isSubmitting={isSubmitting} />
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="rounded font-medium text-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-400">Inicia sesión</Link>
      </p>
    </AuthLayout>
  )
} 
