import { useNavigate } from 'react-router-dom'
import { RegisterForm } from '../components/RegisterForm'

export function RegisterPage() {
  const navigate = useNavigate()

  function showRegistrationConfirmation() {
    void navigate('/login', { replace: true, state: { registered: true } })
  }

  return <RegisterForm onRegistered={showRegistrationConfirmation} />
}
