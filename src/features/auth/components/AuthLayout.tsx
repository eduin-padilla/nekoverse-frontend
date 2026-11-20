import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 font-sans text-slate-100 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 rounded text-sm text-slate-400 transition hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-400">
          <ArrowLeft size={16} aria-hidden="true" />Volver al catálogo
        </Link>
        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
          <p className="mb-3 text-sm font-semibold text-violet-400">NekoVerse</p>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
