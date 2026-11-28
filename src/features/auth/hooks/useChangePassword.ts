import { useQueryClient } from '@tanstack/react-query'
import { changeUserPassword } from '../api'
import type { ChangePasswordInput } from '../schemas'
import { endSession, recheckSession } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'
import { notifySessionChanged, runCookieWrite } from '../sessionTransport'
import { useAuthRequest, type AuthCallbacks } from './useAuthRequest'

export function useChangePassword(sessionId: number) {
  const queryClient = useQueryClient()
  const { runSubmission, runRequest } = useAuthRequest()

  function changePassword(input: ChangePasswordInput, onError: AuthCallbacks['onError']) {
    const { session, logoutSessionId } = useSessionStore.getState()
    if (session?.id !== sessionId || logoutSessionId !== null) return

    return runRequest(({ signal }) => runCookieWrite(async () => {
      if (signal.aborted || useSessionStore.getState().session?.id !== sessionId) return
      await changeUserPassword(session.credentialId, input)
      endSession(queryClient, sessionId)
      notifySessionChanged()
    }), () => {}, error => {
      if (useSessionStore.getState().session?.id !== sessionId) return
      if (error.details.sessionChanged) recheckSession(queryClient)
      else if (error.details.status === 401) endSession(queryClient, sessionId)
      else return onError(error)
    })
  }

  return { changePassword, runSubmission }
}
