import type { QueryClient } from '@tanstack/react-query'
import { AuthRequestError } from './api'
import { recheckSession } from './sessionQueries'

const channelName = 'nekoverse-auth'
let channel: BroadcastChannel | undefined
let writes = Promise.resolve()

export function watchSessionChanges(queryClient: QueryClient) {
  if (typeof BroadcastChannel === 'undefined') return
  const connection = new BroadcastChannel(channelName)
  channel = connection
  connection.onmessage = ({ data }) => {
    if (data === 'changed') recheckSession(queryClient)
  }
  return () => {
    if (channel === connection) channel = undefined
    connection.close()
  }
}

export function notifySessionChanged() {
  channel?.postMessage('changed')
}

export function runCookieWrite<T>(write: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request(channelName, write)
  if (import.meta.env.PROD) {
    return Promise.reject(new AuthRequestError('Este navegador no permite coordinar cambios de sesión de forma segura.'))
  }
  // Per-tab ordering for test runners and local development without Web Locks.
  const result = writes.then(write)
  writes = result.then(() => {}, () => {})
  return result
}
