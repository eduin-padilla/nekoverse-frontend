import { registerUser } from '../api'
import type { RegisterInput } from '../schemas'
import { useAuthRequest, type AuthCallbacks } from './useAuthRequest'

export function useRegister() {
  const { runSubmission, runRequest } = useAuthRequest()

  function registerAccount(input: RegisterInput, { onSuccess, onError }: AuthCallbacks) {
    return runRequest(({ signal }) => registerUser(input, signal), onSuccess, onError)
  }

  return { runSubmission, registerAccount }
}
