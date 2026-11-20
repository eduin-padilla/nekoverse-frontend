import type { ComponentProps } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { AuthField as FieldName } from '../types'
import ErrorMessage from './ErrorMessage'

const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 disabled:opacity-50'

interface AuthFieldProps extends Pick<ComponentProps<'input'>, 'type' | 'autoComplete' | 'maxLength' | 'placeholder' | 'disabled'> {
  registration: UseFormRegisterReturn<FieldName>
  label: string
  error?: { message?: string }
  help?: string
  appearance?: 'profile'
}

export function AuthField({ registration, label, error, help, appearance, ...inputProps }: AuthFieldProps) {
  const { name } = registration
  const errorId = `${name}-error`
  const helpId = `${name}-help`

  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <input
        id={name}
        {...inputProps}
        {...registration}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : help ? helpId : undefined}
        className={appearance === 'profile' ? `${inputClass} min-h-11 aria-invalid:border-rose-400/70 motion-safe:transition-colors` : inputClass}
      />
      {error && <ErrorMessage id={errorId}>{error.message}</ErrorMessage>}
      {help && <p id={helpId} className="mt-2 text-xs text-slate-400">{help}</p>}
    </div>
  )
}

export function AuthServerError({ error }: { error?: { message?: string } }) {
  if (!error) return null

  return (
    <ErrorMessage className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
      {error.message}
    </ErrorMessage>
  )
}

const submitAppearances = {
  default: 'bg-violet-500 text-white transition hover:bg-violet-400 focus-visible:outline-violet-400',
  accent: 'min-h-11 bg-violet-300 text-violet-950 hover:bg-violet-200 focus-visible:outline-violet-300 sm:w-auto motion-safe:transition-colors',
  outline: 'min-h-11 border border-violet-300/40 text-violet-100 hover:border-violet-300/70 hover:bg-violet-300/10 focus-visible:outline-violet-300 sm:w-auto motion-safe:transition-colors',
}

export function AuthSubmitButton({ label, isSubmitting, disabled, appearance = 'default' }: {
  label: string; isSubmitting: boolean; disabled?: boolean; appearance?: keyof typeof submitAppearances
}) {
  return (
    <button type="submit" disabled={isSubmitting || disabled} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-50 ${submitAppearances[appearance]}`}>
      {isSubmitting && <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
      {isSubmitting ? 'Enviando…' : label}
    </button>
  )
}
