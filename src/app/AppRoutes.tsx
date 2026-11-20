import { AnimeCatalog } from '../features/anime/pages/AnimeCatalog'
import { AnimeDetail } from '../features/anime/pages/AnimeDetail'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ProfilePage } from '../features/auth/pages/ProfilePage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { Link, Route, Routes } from 'react-router-dom'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AnimeCatalog />} />
      <Route path="/animes/:slug" element={<AnimeDetail />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 px-5 text-center text-slate-100"><h1 className="text-3xl font-bold">Página no encontrada</h1><Link to="/" className="rounded-xl bg-violet-500 px-5 py-3 font-medium text-white hover:bg-violet-400">Volver al catálogo</Link></main>} />
    </Routes>
  )
}
