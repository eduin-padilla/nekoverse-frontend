import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'
import type { ZodError } from 'zod'
import type { AuthRequestError } from './api'
import type { AuthField } from './types'

type FormField<T extends FieldValues> = FieldPath<T> & AuthField

export function setValidationErrors<T extends FieldValues>(
  error: ZodError, fields: readonly FormField<T>[], setError: UseFormSetError<T>,
) {
  for (const field of fields) {
    const issue = error.issues.find(item => item.path[0] === field)
    if (issue) setError(field, { type: 'validation', message: issue.message }, { shouldFocus: true })
  }
}

export function setServerErrors<T extends FieldValues>(
  error: AuthRequestError, fields: readonly FormField<T>[], setError: UseFormSetError<T>,
) {
  setError('root.server', { message: error.message })
  for (const field of fields) {
    const message = error.fieldErrors[field]
    if (message) setError(field, { type: 'server', message })
  }
}

export function setUnexpectedError<T extends FieldValues>(setError: UseFormSetError<T>) {
  setError('root.unexpected', { message: 'Ocurrió un error inesperado en el formulario.' })
}
