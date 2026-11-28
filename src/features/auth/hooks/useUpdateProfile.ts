import { useQueryClient } from '@tanstack/react-query'
import { AuthRequestError, updateUserProfile } from '../api'
import type { UpdateProfileInput } from '../schemas'
import { endSession, profileQueryKey, recheckSession } from '../sessionQueries'
import { useSessionStore } from '../sessionStore'
import type { UserProfile } from '../types'
import { useAuthRequest, type AuthCallbacks } from './useAuthRequest'

export function useUpdateProfile(sessionId: number) {
  const queryClient = useQueryClient()
  const { runSubmission, runRequest } = useAuthRequest()

  function updateProfile(input: UpdateProfileInput, callbacks: {
    onSuccess: (profile: UserProfile) => void
    onError: AuthCallbacks['onError']
  }) {
    const { session, logoutSessionId } = useSessionStore.getState()
    if (session?.id !== sessionId || logoutSessionId !== null) return
    const queryKey = profileQueryKey(sessionId)

    return runRequest(({ signal }) => updateUserProfile(session.credentialId, input, signal), async (updated, signal) => {
      if (useSessionStore.getState().session?.id !== sessionId) return
      await queryClient.cancelQueries({ queryKey, exact: true })
      if (signal.aborted || useSessionStore.getState().session?.id !== sessionId) return

      const current = queryClient.getQueryData<UserProfile>(queryKey)
      if (current?.id !== updated.id) {
        return callbacks.onError(new AuthRequestError('No pudimos confirmar la actualización del perfil.'))
      }

      const profile = { ...current, ...updated }
      queryClient.setQueryData(queryKey, profile)
      callbacks.onSuccess(profile)
    }, error => {
      if (useSessionStore.getState().session?.id !== sessionId) return
      if (error.details.sessionChanged) recheckSession(queryClient)
      else if (error.details.status === 401) endSession(queryClient, sessionId)
      else return callbacks.onError(error)
    })
  }

  return { updateProfile, runSubmission }
}
