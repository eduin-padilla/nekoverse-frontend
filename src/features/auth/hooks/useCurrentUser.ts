import { CancelledError, skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthRequestError, getUserProfile } from '../api'
import { endSession, profileQueryKey } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'

export function useCurrentUser({ refetchOnMount = true }: { refetchOnMount?: boolean } = {}) {
  const sessionId = useSessionStore(state => state.session?.id)
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: sessionId === undefined ? ['auth', 'profile'] : profileQueryKey(sessionId),
    refetchOnMount,
    queryFn: sessionId === undefined ? skipToken : async ({ signal }) => {
      const { session } = useSessionStore.getState()
      if (session?.id !== sessionId) throw new CancelledError()

      try {
        return await getUserProfile(session.token, signal)
      } catch (error) {
        if (!signal.aborted && error instanceof AuthRequestError && error.details.status === 401) {
          endSession(queryClient, sessionId)
        }
        throw error
      }
    },
    retry: (failureCount, error) => failureCount < 1 && error instanceof AuthRequestError &&
      (Boolean(error.details.networkError) || (error.details.status ?? 0) >= 500),
  })
}
