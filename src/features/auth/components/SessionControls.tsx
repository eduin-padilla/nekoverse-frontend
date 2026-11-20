import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { NavLink, useLocation, useMatch } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useLogout } from '../hooks/useLogout'
import { useSessionStore } from '../sessionStore'
import type { UserProfile } from '../types'
import ErrorMessage from './ErrorMessage'

const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 motion-safe:transition-colors'
const guestClass = `inline-flex min-h-11 items-center rounded-lg px-2.5 font-medium whitespace-nowrap aria-[current=page]:ring-2 aria-[current=page]:ring-violet-200 ${focusClass}`
const menuItemClass = `flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-100 hover:bg-violet-400/15 aria-[current=page]:bg-violet-400/15 aria-[current=page]:text-violet-100 ${focusClass}`

function AccountMenu({ profile, profileRoute, isLoggingOut, onLogout }: {
  profile?: UserProfile
  profileRoute: boolean
  isLoggingOut: boolean
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [failedAvatar, setFailedAvatar] = useState<string>()
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const avatarUrl = profile?.avatarUrl
  const username = profile?.username

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  return (
    <div
      ref={root}
      className="relative ml-auto min-w-0"
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        trigger.current?.focus()
      }}
    >
      <button
        ref={trigger} type="button" aria-label="Menú de cuenta" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className={`flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-violet-300/20 px-1.5 text-violet-100 hover:bg-violet-400/15 sm:px-2 ${profileRoute || open ? 'bg-violet-400/15' : 'bg-violet-400/5'} ${focusClass}`}
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-violet-300/15 text-sm font-semibold" aria-hidden="true">
          {avatarUrl && avatarUrl !== failedAvatar ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatarUrl)} className="size-full object-cover" />
          ) : username ? Array.from(username)[0]?.toLocaleUpperCase('es') : <UserRound size={17} />}
        </span>
        {username && <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{username}</span>}
        <ChevronDown size={14} aria-hidden="true" className={`shrink-0 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!open} className="absolute top-full right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-violet-300/20 bg-[#191426] p-2 shadow-xl shadow-black/50">
        <NavLink to="/profile" end className={menuItemClass}>
          <UserRound size={16} aria-hidden="true" className="shrink-0 text-violet-300" />Mi perfil
        </NavLink>
        <button type="button" className={`${menuItemClass} disabled:opacity-60`} disabled={isLoggingOut} onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" className="shrink-0 text-violet-300" />
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión en todos los dispositivos'}
        </button>
      </div>
    </div>
  )
}

export function SessionControls() {
  const sessionId = useSessionStore(state => state.session?.id)
  const { key: locationKey } = useLocation()
  const profileRoute = useMatch('/profile')
  const profile = useCurrentUser()
  const { logout, logoutLocally, isLoggingOut, logoutUnconfirmed } = useLogout()

  if (sessionId === undefined) {
    return (
      <>
        <NavLink to="/login" end className={`${guestClass} hover:bg-white/5 hover:text-violet-100 aria-[current=page]:bg-violet-400/15`}>Iniciar sesión</NavLink>
        <NavLink to="/register" end className={`${guestClass} bg-violet-300 text-violet-950 hover:bg-violet-200`}>Crear cuenta</NavLink>
      </>
    )
  }

  return (
    <>
      {profile.isError && !profileRoute && <span role="status" className="min-w-0 text-xs text-slate-300">No pudimos actualizar el perfil.</span>}
      <AccountMenu key={`${sessionId}:${locationKey}`} profile={profile.data} profileRoute={Boolean(profileRoute)} isLoggingOut={isLoggingOut} onLogout={() => void logout()} />
      {logoutUnconfirmed && (
        <div className="flex min-w-0 basis-full flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded-lg border border-rose-300/20 bg-rose-950/25 px-3 py-2">
          <ErrorMessage className="text-xs text-rose-200">No pudimos confirmar el cierre en todos los dispositivos.</ErrorMessage>
          <button type="button" className={`min-h-11 rounded-lg px-2 text-sm font-medium text-violet-100 hover:bg-violet-400/15 disabled:opacity-60 ${focusClass}`} disabled={isLoggingOut} onClick={logoutLocally}>
            Cerrar sesión solo en esta pestaña
          </button>
        </div>
      )}
    </>
  )
}
