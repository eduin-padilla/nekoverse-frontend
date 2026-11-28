import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { watchSessionChanges } from '../features/auth/sessionTransport'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => watchSessionChanges(queryClient), [])
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}
