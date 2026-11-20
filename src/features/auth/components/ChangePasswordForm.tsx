import { ShieldCheck, Info } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { setServerErrors, setUnexpectedError, setValidationErrors } from '../formErrors'
import { useChangePassword } from '../hooks/useChangePassword'
import { changePasswordSchema, type ChangePasswordValues } from '../schemas'
import { AuthField, AuthServerError, AuthSubmitButton } from './AuthFormControls'

const fields = ['currentPassword', 'newPassword', 'confirmPassword'] as const

export function ChangePasswordForm({ sessionId, disabled }: { sessionId: number; disabled: boolean }) {
  const { changePassword, runSubmission } = useChangePassword(sessionId)
  const { register, handleSubmit, setError, clearErrors, resetField, formState: { errors, isSubmitting } } = useForm<ChangePasswordValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function submit(values: ChangePasswordValues) {
    clearErrors()
    const validation = changePasswordSchema.safeParse(values)
    if (!validation.success) {
      setValidationErrors(validation.error, fields, setError)
      return
    }

    const { currentPassword, newPassword } = validation.data
    await changePassword({ currentPassword, newPassword }, error => {
      setServerErrors(error, fields, setError)
      if (error.fieldErrors.currentPassword) resetField('currentPassword', { keepError: true })
    })
  }

  return (
    <form
      noValidate aria-label="Cambiar contraseña" aria-busy={isSubmitting}
      onSubmit={event => {
        event.preventDefault()
        void runSubmission(() => handleSubmit(submit)(event), () => setUnexpectedError(setError))
      }}
      className="min-w-0 space-y-5 rounded-2xl border border-white/10 bg-[#12111c] p-5 sm:rounded-3xl sm:p-7"
    >
      <div className="flex items-center gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-violet-200">
          <ShieldCheck size={21} aria-hidden="true" />
        </span>
        <h2 className="min-w-0 text-xl font-semibold tracking-tight">Seguridad de la cuenta</h2>
      </div>
      <AuthServerError error={errors.root?.unexpected ?? errors.root?.server} />
      <div className="space-y-4">
        <AuthField registration={register('currentPassword')} label="Contraseña actual" type="password" autoComplete="current-password" error={errors.currentPassword} disabled={disabled || isSubmitting} appearance="profile" />
        <AuthField registration={register('newPassword')} label="Contraseña nueva" type="password" autoComplete="new-password" error={errors.newPassword} help="Al menos 8 caracteres y hasta 72 bytes en UTF-8." disabled={disabled || isSubmitting} appearance="profile" />
        <AuthField registration={register('confirmPassword')} label="Confirmar contraseña nueva" type="password" autoComplete="new-password" error={errors.confirmPassword} disabled={disabled || isSubmitting} appearance="profile" />
      </div>
      <div className="space-y-4 border-t border-white/10 pt-5">
        <p className="flex items-start gap-2.5 rounded-xl bg-violet-400/8 px-3 py-2.5 text-sm leading-relaxed text-violet-100">
          <Info size={17} className="mt-0.5 shrink-0 text-violet-300" aria-hidden="true" />
          Al guardar la contraseña nueva, se cerrará la sesión en todos tus dispositivos.
        </p>
        <AuthSubmitButton label="Cambiar contraseña" isSubmitting={isSubmitting} disabled={disabled} appearance="outline" />
      </div>
    </form>
  )
}
