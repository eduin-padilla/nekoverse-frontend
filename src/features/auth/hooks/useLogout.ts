import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthRequestError, logoutUser } from '../api'
import { endSession, recheckSession } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'
import { notifySessionChanged, runCookieWrite } from '../sessionTransport'

export function useLogout() {
  const queryClient = useQueryClient()
  const sessionId = useSessionStore(state => state.session?.id)
  const isLoggingOut = useSessionStore(state => state.logoutSessionId !== null)
  const [failure, setFailure] = useState<{ sessionId: number; local: boolean } | null>(null)

  async function finishInBrowser(local: boolean) {
    const { session, beginLogout, finishLogout } = useSessionStore.getState()
    if (!session || session.id !== sessionId || !beginLogout(session.id)) return

    setFailure(null)
    try {
      await runCookieWrite(async () => {
        if (useSessionStore.getState().session?.id !== session.id) return
        await logoutUser(session.credentialId, local)
        endSession(queryClient, session.id)
        notifySessionChanged()
      })
    } catch (error) {
      if (useSessionStore.getState().session?.id !== session.id) return
      if (error instanceof AuthRequestError && error.details.sessionChanged) {
        recheckSession(queryClient)
      } else if (error instanceof AuthRequestError && error.details.status === 401) {
        endSession(queryClient, session.id)
      } else {
        setFailure({ sessionId: session.id, local })
      }
    } finally {
      finishLogout(session.id)
    }
  }

  return {
    logout: () => finishInBrowser(false), logoutLocally: () => finishInBrowser(true),
    isLoggingOut, logoutFailure: failure?.sessionId === sessionId ? failure : null,
  }
}
