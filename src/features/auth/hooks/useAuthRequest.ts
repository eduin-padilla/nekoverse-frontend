import { useLayoutEffect, useRef } from 'react'
import { AuthRequestError } from '../api'

export interface AuthCallbacks {
  onSuccess: () => void | Promise<void>
  onError: (error: AuthRequestError) => void | Promise<void>
}

export function useAuthRequest() {
  const activeRequest = useRef<AbortController | null>(null)

  useLayoutEffect(() => () => activeRequest.current?.abort(), [])

  async function runSubmission(submit: () => Promise<void>, onUnexpectedError: () => void) {
    if (activeRequest.current) return

    const request = new AbortController()
    activeRequest.current = request
    try {
      await submit()
    } catch {
      if (!request.signal.aborted) onUnexpectedError()
    } finally {
      activeRequest.current = null
    }
  }

  async function runRequest<T>(
    execute: (request: AbortController) => Promise<T>,
    onSuccess: (result: T, signal: AbortSignal) => void | Promise<void>,
    onError: (error: AuthRequestError, signal: AbortSignal) => void | Promise<void>,
  ) {
    const request = activeRequest.current
    if (!request || request.signal.aborted) return
    const { signal } = request

    let result: T
    try {
      result = await execute(request)
    } catch (error) {
      if (signal.aborted) return
      if (!(error instanceof AuthRequestError)) throw error
      if (!error.details.cancelled) await onError(error, signal)
      return
    }

    if (!signal.aborted) await onSuccess(result, signal)
  }

  return { runSubmission, runRequest }
}
