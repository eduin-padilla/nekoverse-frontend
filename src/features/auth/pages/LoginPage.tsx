import { useLocation, useNavigate } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'

function readReturnTo(value: unknown) {
  if (!value || typeof value !== 'object' || !('pathname' in value) ||
      typeof value.pathname !== 'string' || !/^\/profile\/?$/i.test(value.pathname)) return undefined

  const search = 'search' in value ? value.search : ''
  const hash = 'hash' in value ? value.hash : ''
  if (typeof search !== 'string' || (search !== '' && !search.startsWith('?')) || search.includes('#') ||
      typeof hash !== 'string' || (hash !== '' && !hash.startsWith('#'))) return undefined

  return { pathname: '/profile', search, hash }
}

export function LoginPage() {
  const state: unknown = useLocation().state
  const navigate = useNavigate()
  const routeState = typeof state === 'object' && state !== null ? state : {}
  const registered = 'registered' in routeState && routeState.registered === true
  const returnTo = readReturnTo('returnTo' in routeState ? routeState.returnTo : undefined)

  return <LoginForm registered={registered} onAuthenticated={() => { void navigate(returnTo ?? '/', { replace: true }) }} />
}
