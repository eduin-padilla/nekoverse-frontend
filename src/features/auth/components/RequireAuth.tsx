import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useSessionStore } from '../sessionStore'
import type { UserProfile } from '../types'
import ErrorMessage from './ErrorMessage'
import { ProfileLayout } from './ProfileLayout'

export interface AuthOutletContext {
  sessionId: number
  profile: UserProfile
  feedback: ReactNode
}

export function RequireAuth() {
  const sessionId = useSessionStore(state => state.session?.id)
  const location = useLocation()
  const profile = useCurrentUser({ refetchOnMount: false })

  if (sessionId === undefined) {
    const { pathname, search, hash } = location
    return <Navigate to="/login" replace state={{ returnTo: { pathname, search, hash } }} />
  }

  const errorMessage = profile.data ? 'No pudimos actualizar el perfil.' : 'No pudimos cargar el perfil.'
  const feedback = (profile.isError || profile.isPaused) && (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/25 bg-rose-950/35 px-4 py-3 sm:px-5">
      <ErrorMessage className="text-sm text-rose-200">
        {profile.isPaused ? 'No hay conexión para consultar el perfil.' : errorMessage}
      </ErrorMessage>
      <button
        type="button" disabled={profile.isFetching} onClick={() => void profile.refetch()}
        className="min-h-11 rounded-lg border border-violet-300/40 px-3 text-sm font-medium text-violet-100 hover:bg-violet-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-50 motion-safe:transition-colors"
      >
        {profile.isFetching ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  )

  if (!profile.data) {
    return (
      <ProfileLayout>
        {feedback || (
          <p role="status" className="flex min-h-36 items-center gap-3 rounded-2xl border border-violet-300/20 bg-[#171223] px-5 text-sm font-medium text-violet-100 sm:rounded-3xl sm:px-7">
            <LoaderCircle size={20} aria-hidden="true" className="text-violet-300 motion-safe:animate-spin" />Cargando perfil…
          </p>
        )}
      </ProfileLayout>
    )
  }

  return <Outlet context={{ sessionId, profile: profile.data, feedback } satisfies AuthOutletContext} />
}
