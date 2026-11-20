import { useState } from 'react'
import { SquarePen } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { setServerErrors, setUnexpectedError, setValidationErrors } from '../formErrors'
import { useUpdateProfile } from '../hooks/useUpdateProfile'
import { updateProfileSchema, type UpdateProfileInput } from '../schemas'
import type { UserProfile } from '../types'
import { AuthField, AuthServerError, AuthSubmitButton } from './AuthFormControls'

const fields = ['username', 'email'] as const
type EditProfileValues = Required<UpdateProfileInput>

export function EditProfileForm({ profile, sessionId, disabled }: { profile: UserProfile; sessionId: number; disabled: boolean }) {
  const [saved, setSaved] = useState(false)
  const { updateProfile, runSubmission } = useUpdateProfile(sessionId)
  const { register, handleSubmit, setError, clearErrors, reset, formState: { errors, isSubmitting, dirtyFields } } = useForm<EditProfileValues>({
    values: { username: profile.username, email: profile.email },
    resetOptions: { keepDirtyValues: true, keepErrors: true },
  })

  async function submit(values: EditProfileValues) {
    clearErrors()
    setSaved(false)
    const validation = updateProfileSchema.safeParse({
      username: dirtyFields.username ? values.username : undefined,
      email: dirtyFields.email ? values.email : undefined,
    })
    if (!validation.success) {
      setValidationErrors(validation.error, fields, setError)
      return
    }

    const changes: UpdateProfileInput = {}
    for (const field of fields) {
      const value = validation.data[field]
      if (value !== undefined && value !== profile[field]) changes[field] = value
    }
    if (Object.keys(changes).length === 0) {
      setError('root.server', { message: 'No hay cambios para guardar.' })
      return
    }

    await updateProfile(changes, {
      onSuccess: updated => {
        reset({ username: updated.username, email: updated.email })
        setSaved(true)
      },
      onError: error => setServerErrors(error, fields, setError),
    })
  }

  return (
    <form
      noValidate aria-labelledby="edit-profile-heading" aria-busy={isSubmitting}
      onChange={() => { if (saved) setSaved(false) }}
      onSubmit={event => {
        event.preventDefault()
        void runSubmission(() => handleSubmit(submit)(event), () => setUnexpectedError(setError))
      }}
      className="min-w-0 space-y-5 rounded-2xl border border-white/10 bg-[#12111c] p-5 sm:rounded-3xl sm:p-7"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-violet-200">
          <SquarePen size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="edit-profile-heading" className="text-xl font-semibold tracking-tight">Editar perfil</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">El correo electrónico también se usa para iniciar sesión.</p>
        </div>
      </div>
      <AuthServerError error={errors.root?.unexpected ?? errors.root?.server} />
      {saved && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 p-3 text-sm text-emerald-100">Perfil actualizado correctamente.</p>}
      <div className="space-y-4">
        <AuthField registration={register('username')} label="Nombre de usuario" autoComplete="username" maxLength={30} error={errors.username} disabled={disabled || isSubmitting} appearance="profile" />
        <AuthField registration={register('email')} label="Correo electrónico" type="email" autoComplete="email" maxLength={254} error={errors.email} disabled={disabled || isSubmitting} appearance="profile" />
      </div>
      <div className="border-t border-white/10 pt-5">
        <AuthSubmitButton label="Guardar perfil" isSubmitting={isSubmitting} disabled={disabled} appearance="accent" />
      </div>
    </form>
  )
}
