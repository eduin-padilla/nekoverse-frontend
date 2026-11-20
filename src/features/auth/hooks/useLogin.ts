import { useQueryClient } from '@tanstack/react-query'
import { loginUser } from '../api'
import type { LoginInput } from '../schemas'
import { removePrivateQueries } from '../sessionQueries'
import { beginLogin, finishLogin, useSessionStore } from '../sessionStore'
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
        return loginUser(input, request.signal)
      }, (result, signal) => {
        if (!result || !finishLogin(signal)) return
        const { session: previous, startSession } = useSessionStore.getState()
        const session = startSession(result.token)
        if (previous) removePrivateQueries(queryClient, previous.id)
        return onSuccess(session.id)
      }, (error, signal) => {
        if (finishLogin(signal)) return onError(error)
      })
    } finally {
      if (loginSignal) finishLogin(loginSignal)
    }
  }

  return { runSubmission, login }
}
