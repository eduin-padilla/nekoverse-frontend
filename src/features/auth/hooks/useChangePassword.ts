import { useQueryClient } from '@tanstack/react-query'
import { changeUserPassword } from '../api'
import type { ChangePasswordInput } from '../schemas'
import { endSession } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'
import { useAuthRequest, type AuthCallbacks } from './useAuthRequest'

export function useChangePassword(sessionId: number) {
  const queryClient = useQueryClient()
  const { runSubmission, runRequest } = useAuthRequest()

  function changePassword(input: ChangePasswordInput, onError: AuthCallbacks['onError']) {
    const { session, logoutSessionId } = useSessionStore.getState()
    if (session?.id !== sessionId || logoutSessionId !== null) return

    return runRequest(({ signal }) => changeUserPassword(session.token, input, signal), () => {
      endSession(queryClient, sessionId)
    }, error => {
      if (useSessionStore.getState().session?.id !== sessionId) return
      if (error.details.status === 401) endSession(queryClient, sessionId)
      else return onError(error)
    })
  }

  return { changePassword, runSubmission }
}
