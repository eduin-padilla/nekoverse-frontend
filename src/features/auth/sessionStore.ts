import { create } from 'zustand'

interface Session {
  id: number
  token: string
}

interface SessionState {
  session: Session | null
  logoutSessionId: number | null
  startSession: (token: string) => Session
  clearSession: (sessionId: number) => boolean
  beginLogout: (sessionId: number) => boolean
  finishLogout: (sessionId: number) => void
}

let nextSessionId = 0
let pendingLogin: AbortController | undefined

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  logoutSessionId: null,
  startSession: token => {
    const session = { id: ++nextSessionId, token }
    set({ session })
    return session
  },
  clearSession: sessionId => {
    if (get().session?.id !== sessionId) return false
    set({ session: null })
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
