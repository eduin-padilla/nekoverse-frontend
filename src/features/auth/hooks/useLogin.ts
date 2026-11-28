import { useQueryClient } from '@tanstack/react-query'
import { AuthRequestError, loginUser } from '../api'
import type { LoginInput } from '../schemas'
import { profileQueryKey, recheckSession, removePrivateQueries } from '../sessionQueries'
import { beginLogin, finishLogin, useSessionStore } from '../sessionStore'
import { notifySessionChanged, runCookieWrite } from '../sessionTransport'
import { useAuthRequest, type AuthCallbacks } from './useAuthRequest'

interface LoginCallbacks extends Omit<AuthCallbacks, 'onSuccess'> {
  onSuccess: (sessionId: number) => void | Promise<void>
}

export function useLogin() {
  const queryClient = useQueryClient()
  const { runSubmission, runRequest } = useAuthRequest()

  async function login(input: LoginInput, { onSuccess, onError }: LoginCallbacks) {
    let loginSignal: AbortSignal | undefined
    try {
      await runRequest(async request => {
        if (!beginLogin(request)) return
        loginSignal = request.signal
        return runCookieWrite(async () => {
          if (request.signal.aborted) return
          let sessionId: string
          try {
            ({ sessionId } = await loginUser(input))
          } catch (error) {
            if (error instanceof AuthRequestError && error.details.code !== 'AUTH_BUSY' &&
                (error.details.status === undefined || error.details.status >= 500)) {
              const { session } = useSessionStore.getState()
              if (session) void queryClient.invalidateQueries({ queryKey: profileQueryKey(session.id) })
              else recheckSession(queryClient)
              notifySessionChanged()
            }
            throw error
          }
          notifySessionChanged()
          if (request.signal.aborted) {
            recheckSession(queryClient)
            return
          }
          const { generation, startSession } = useSessionStore.getState()
          const session = startSession(sessionId)
          removePrivateQueries(queryClient, generation)
          return session.id
        })
      }, (sessionId, signal) => {
        if (sessionId !== undefined && finishLogin(signal)) return onSuccess(sessionId)
      }, (error, signal) => {
        if (finishLogin(signal)) return onError(error)
      })
    } finally {
      if (loginSignal) finishLogin(loginSignal)
    }
  }

  return { runSubmission, login }
}
