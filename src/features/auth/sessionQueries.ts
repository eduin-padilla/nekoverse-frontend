import type { QueryClient } from '@tanstack/react-query'
import { useSessionStore } from './sessionStore'

export const privateSessionKey = (sessionId: number) => ['private', sessionId] as const
export const profileQueryKey = (sessionId: number) => [...privateSessionKey(sessionId), 'profile'] as const

export function removePrivateQueries(queryClient: QueryClient, sessionId: number) {
  const filters = { queryKey: privateSessionKey(sessionId) }
  void queryClient.cancelQueries(filters, { revert: false })
  queryClient.removeQueries(filters)
}

export function endSession(queryClient: QueryClient, sessionId: number) {
  if (useSessionStore.getState().clearSession(sessionId)) removePrivateQueries(queryClient, sessionId)
}
