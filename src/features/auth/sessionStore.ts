import { create } from 'zustand'

interface Session {
  id: number
  credentialId: string
}

interface SessionState {
  session: Session | null
  generation: number
  restoring: boolean
  logoutSessionId: number | null
  startSession: (credentialId: string) => Session
  restoreSession: () => void
  confirmSession: (generation: number, credentialId: string) => void
  clearSession: (sessionId: number) => boolean
  beginLogout: (sessionId: number) => boolean
  finishLogout: (sessionId: number) => void
}

let nextSessionId = 0
let pendingLogin: AbortController | undefined

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  generation: 0,
  restoring: true,
  logoutSessionId: null,
  startSession: credentialId => {
    const session = { id: ++nextSessionId, credentialId }
    set({ session, generation: session.id, restoring: false })
    return session
  },
  restoreSession: () => set({ session: null, generation: ++nextSessionId, restoring: true }),
  confirmSession: (generation, credentialId) => {
    const current = get()
    if (current.generation === generation && current.restoring) {
      set({ session: { id: generation, credentialId }, restoring: false })
    }
  },
  clearSession: sessionId => {
    if (get().generation !== sessionId) return false
    set({ session: null, generation: ++nextSessionId, restoring: false })
    return true
  },
  beginLogout: sessionId => {
    const current = get()
    if (current.session?.id !== sessionId || current.logoutSessionId !== null) return false
    set({ logoutSessionId: sessionId })

    const request = pendingLogin
    pendingLogin = undefined
    request?.abort()
    return true
  },
  finishLogout: sessionId => {
    if (get().logoutSessionId === sessionId) set({ logoutSessionId: null })
  },
}))

export function beginLogin(request: AbortController) {
  if (useSessionStore.getState().logoutSessionId !== null) return false
  const previous = pendingLogin
  pendingLogin = request
  previous?.abort()
  request.signal.addEventListener('abort', () => finishLogin(request.signal), { once: true })
  return true
}

export function finishLogin(signal: AbortSignal) {
  if (pendingLogin?.signal !== signal) return false
  pendingLogin = undefined
  return true
}
