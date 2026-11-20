import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <main aria-labelledby="profile-title" className="min-h-screen bg-[#0b0a12] bg-[radial-gradient(ellipse_at_top,_#21162f_0%,_#0b0a12_56%)] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-8 sm:pt-9 sm:pb-16 lg:px-10">
        <Link to="/" className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 motion-safe:transition-colors">
          <ArrowLeft size={16} aria-hidden="true" />Volver al catálogo
        </Link>
        <h1 id="profile-title" className="mt-3 text-3xl font-semibold tracking-tight sm:mt-4 sm:text-4xl">Mi perfil</h1>
        <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-6">{children}</div>
      </div>
    </main>
  )
}
