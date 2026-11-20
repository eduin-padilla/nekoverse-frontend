import { useState } from 'react'
import { CalendarDays, Mail } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { EditProfileForm } from '../components/EditProfileForm'
import { ProfileLayout } from '../components/ProfileLayout'
import type { AuthOutletContext } from '../components/RequireAuth'
import { useSessionStore } from '../sessionStore'

const registrationDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' })
const avatarClass = 'size-16 shrink-0 rounded-2xl border border-violet-300/30 sm:size-20'

function ProfileAvatar({ src, username }: { src: string; username: string }) {
  const [failed, setFailed] = useState(false)

  if (src && !failed) {
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`${avatarClass} object-cover`} />
  }

  return (
    <span aria-hidden="true" className={`${avatarClass} grid place-items-center bg-violet-400/15 text-3xl font-semibold text-violet-100`}>
      {Array.from(username)[0]?.toLocaleUpperCase('es')}
    </span>
  )
}

export function ProfilePage() {
  const { sessionId, profile, feedback } = useOutletContext<AuthOutletContext>()
  const isLoggingOut = useSessionStore(state => state.logoutSessionId !== null)
  const { username, email, avatarUrl, createdAt } = profile

  return (
    <ProfileLayout>
      {feedback}
      <section aria-labelledby="personal-info-title" className="grid min-w-0 items-center gap-5 rounded-2xl border border-violet-300/20 bg-[#171223] bg-linear-to-br from-[#231833] to-[#12101c] p-5 sm:gap-6 sm:rounded-3xl sm:p-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <ProfileAvatar key={`${profile.id}:${avatarUrl}`} src={avatarUrl} username={username} />
          <div className="min-w-0">
            <h2 id="personal-info-title" className="text-sm font-medium text-violet-200">Información personal</h2>
            <h3 className="mt-1 wrap-anywhere text-2xl leading-tight font-semibold tracking-tight text-white sm:text-3xl">{username}</h3>
          </div>
        </div>
        <dl className="grid min-w-0 gap-4 border-t border-white/12 pt-4 text-sm sm:grid-cols-2 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
          <div className="min-w-0">
            <dt className="flex items-center gap-2 font-medium text-slate-300"><Mail size={16} className="shrink-0 text-violet-300" aria-hidden="true" />Correo electrónico</dt>
            <dd className="mt-1.5 wrap-anywhere leading-relaxed text-slate-100">{email}</dd>
          </div>
          {createdAt && (
            <div className="min-w-0">
              <dt className="flex items-center gap-2 font-medium text-slate-300"><CalendarDays size={16} className="shrink-0 text-violet-300" aria-hidden="true" />Fecha de registro</dt>
              <dd className="mt-1.5 leading-relaxed text-slate-100"><time dateTime={createdAt}>{registrationDate.format(new Date(createdAt))}</time></dd>
            </div>
          )}
        </dl>
      </section>
      <div key={sessionId} className="grid min-w-0 items-start gap-4 sm:gap-6 lg:grid-cols-2">
        <EditProfileForm profile={profile} sessionId={sessionId} disabled={isLoggingOut} />
        <ChangePasswordForm sessionId={sessionId} disabled={isLoggingOut} />
      </div>
    </ProfileLayout>
  )
}
