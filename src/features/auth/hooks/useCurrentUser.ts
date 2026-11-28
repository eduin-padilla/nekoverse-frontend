import { CancelledError, skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthRequestError, getUserProfile } from '../api'
import { endSession, profileQueryKey, recheckSession } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'

export function useCurrentUser({ refetchOnMount = true }: { refetchOnMount?: boolean } = {}) {
  const generation = useSessionStore(state => state.generation)
  const shouldCheck = useSessionStore(state => state.restoring || state.session !== null)
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: shouldCheck ? profileQueryKey(generation) : ['auth', 'profile'],
    refetchOnMount,
    queryFn: shouldCheck ? async ({ signal }) => {
      try {
        if (useSessionStore.getState().generation !== generation) throw new CancelledError()
        const { sessionId, profile } = await getUserProfile(signal)
        const current = useSessionStore.getState()
        if (signal.aborted || current.generation !== generation) throw new CancelledError()
        if (current.session && current.session.credentialId !== sessionId) {
          recheckSession(queryClient)
          throw new CancelledError()
        }
        current.confirmSession(generation, sessionId)
        return profile
      } catch (error) {
        if (!signal.aborted && error instanceof AuthRequestError && error.details.status === 401) {
          endSession(queryClient, generation)
        }
        throw error
      }
    } : skipToken,
    retry: (failureCount, error) => failureCount < 1 && error instanceof AuthRequestError &&
      (Boolean(error.details.networkError) || (error.details.status ?? 0) >= 500),
  })
}
