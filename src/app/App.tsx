import { BookOpen } from 'lucide-react'
import { AppRoutes } from './AppRoutes'
import { Link, NavLink } from 'react-router-dom'
import { SessionControls } from '../features/auth/components/SessionControls'

function App() {
  return (
    <>
      <header className="border-b border-violet-300/15 bg-[#100d19] text-sm text-slate-200">
        <nav aria-label="Navegación principal" className="mx-auto flex min-w-0 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 sm:gap-x-5">
            <Link to="/" aria-label="NekoVerse" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-semibold tracking-tight text-white hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 motion-safe:transition-colors">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-200"><BookOpen size={17} aria-hidden="true" /></span>
              <span>Neko<span className="text-violet-300">Verse</span></span>
            </Link>
            <NavLink to="/" end className="inline-flex min-h-11 items-center rounded-lg px-2.5 font-medium hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300 aria-[current=page]:bg-violet-400/15 aria-[current=page]:text-violet-100 motion-safe:transition-colors">
              Catálogo
            </NavLink>
          </div>
          <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
            <SessionControls />
          </div>
        </nav>
      </header>
      <AppRoutes />
    </>
  )
}

export default App
