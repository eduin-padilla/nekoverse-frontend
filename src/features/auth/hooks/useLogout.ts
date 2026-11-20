import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthRequestError, logoutUser } from '../api'
import { endSession } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'

export function useLogout() {
  const queryClient = useQueryClient()
  const sessionId = useSessionStore(state => state.session?.id)
  const isLoggingOut = useSessionStore(state => state.logoutSessionId !== null)
  const [failedSessionId, setFailedSessionId] = useState<number | null>(null)

  async function logout() {
    const { session, beginLogout, finishLogout } = useSessionStore.getState()
    if (!session || session.id !== sessionId || !beginLogout(session.id)) return

    setFailedSessionId(null)
    try {
      await logoutUser(session.token)
      endSession(queryClient, session.id)
    } catch (error) {
      if (error instanceof AuthRequestError && error.details.status === 401) {
        endSession(queryClient, session.id)
      } else if (useSessionStore.getState().session?.id === session.id) {
        setFailedSessionId(session.id)
      }
    } finally {
      finishLogout(session.id)
    }
  }

  function logoutLocally() {
    const { session, beginLogout, finishLogout } = useSessionStore.getState()
    if (session && session.id === failedSessionId && beginLogout(session.id)) {
      endSession(queryClient, session.id)
      finishLogout(session.id)
    }
  }

  return { logout, logoutLocally, isLoggingOut, logoutUnconfirmed: sessionId === failedSessionId }
}
