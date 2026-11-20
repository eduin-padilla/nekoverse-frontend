import type { ReactNode } from 'react'

interface ErrorMessageProps {
  children: ReactNode
  className?: string
  id?: string
}

export default function ErrorMessage({ children, className = 'mt-2 text-xs text-rose-300', id }: ErrorMessageProps) {
  return <p id={id} role="alert" className={className}>{children}</p>
}
