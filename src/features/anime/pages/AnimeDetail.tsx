import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { ArrowLeft, ExternalLink, Film, RefreshCw, Star } from 'lucide-react'
import { useAnime } from '../hooks/useAnime'

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-400/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 disabled:opacity-40'
const statusLabels = { upcoming: 'Próximamente', airing: 'En emisión', completed: 'Finalizado' }

function displayNumber(value: number | null | undefined, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}${suffix}` : 'Por confirmar'
}

function getExternalUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? '')
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function AnimeDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { search } = useLocation()
  const { data, error, isPending, isError, isFetching, fetchStatus, refetch } = useAnime(slug)
  const [failedPoster, setFailedPoster] = useState<string | null>(null)
  const [failedBanner, setFailedBanner] = useState<string | null>(null)
  const anime = data?.data
  const notFound = !slug?.trim() || (isAxiosError(error) && error.response?.status === 404)
  const poster = anime?.posterUrl?.trim()
  const banner = anime?.bannerUrl?.trim()
  const title = anime?.title.trim() || 'Anime'
  const genres = Array.isArray(anime?.genres) ? anime.genres.filter(genre => typeof genre === 'string' && genre.trim()) : []
  const studios = Array.isArray(anime?.studios) ? anime.studios.filter(studio => typeof studio === 'string' && studio.trim()) : []
  const externalUrl = getExternalUrl(anime?.externalUrl)
  const titles = [...new Set([anime?.titleEnglish?.trim(), anime?.titleJapanese?.trim()].filter(value => value && value !== title))]
  const backLink = <Link to={{ pathname: '/', search }} className={buttonClass}><ArrowLeft size={16} aria-hidden="true" />Volver al catálogo</Link>

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-violet-500/40">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to={{ pathname: '/', search }} className="rounded text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-violet-400">Neko<span className="text-violet-400">Verse</span></Link>
          {backLink}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {notFound ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-16 text-center">
            <Film size={36} className="mx-auto mb-5 text-violet-400" aria-hidden="true" />
            <h1 className="text-3xl font-bold">Anime no encontrado</h1>
            <p className="mt-4 text-sm leading-6 text-slate-400">Este anime no existe o ya no está publicado. Puedes seguir explorando el catálogo.</p>
          </section>
        ) : isPending ? (
          <section role="status" className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-16 text-center">
            <RefreshCw className="mx-auto mb-4 text-violet-400 motion-safe:animate-spin" aria-hidden="true" />
            <h1 className="text-lg font-semibold">{fetchStatus === 'paused' ? 'Sin conexión' : 'Cargando anime…'}</h1>
            {fetchStatus === 'paused' && <p className="mt-3 text-sm text-slate-400">Los detalles se cargarán cuando vuelvas a conectarte.</p>}
          </section>
        ) : (
          <>
            {isError && (
              <section role="alert" className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6">
                <h1 className="text-xl font-semibold text-rose-200">No pudimos cargar los detalles</h1>
                <p className="mt-2 text-sm text-slate-400">Comprueba tu conexión e inténtalo de nuevo.</p>
                <button type="button" className={`${buttonClass} mt-4`} onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={15} aria-hidden="true" />Reintentar</button>
              </section>
            )}
            {anime && (
              <article aria-busy={isFetching}>
                <div className="relative h-44 overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-violet-950 via-slate-900 to-slate-950 sm:h-64 lg:h-80">
                  {banner && failedBanner !== banner && <img src={banner} alt="" decoding="async" onError={() => setFailedBanner(banner)} className="h-full w-full object-cover opacity-60" />}
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/95 via-slate-950/20 to-transparent" />
                </div>
                <div className="relative -mt-16 grid gap-8 px-4 sm:-mt-24 sm:grid-cols-[180px_1fr] sm:px-8 lg:grid-cols-[240px_1fr] lg:gap-12">
                  <div>
                    <div className="mx-auto aspect-2/3 w-40 overflow-hidden rounded-2xl border border-white/15 bg-slate-800 shadow-2xl sm:w-full">
                      {poster && failedPoster !== poster ? <img src={poster} alt={`Póster de ${title}`} decoding="async" onError={() => setFailedPoster(poster)} className="h-full w-full object-cover" /> : <div role="img" aria-label={`Póster no disponible para ${title}`} className="flex h-full flex-col items-center justify-center gap-3 bg-linear-to-br from-slate-800 to-violet-950 px-4 text-center text-slate-400"><Film size={36} aria-hidden="true" /><span className="text-xs">Póster no disponible</span></div>}
                    </div>
                    {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} mt-5 w-full`}>Ver fuente original<ExternalLink size={14} aria-hidden="true" /></a>}
                  </div>
                  <div className="min-w-0 pt-0 sm:pt-28">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-violet-200">
                      <span className="rounded-full bg-violet-400/10 px-3 py-1">{anime.type || 'Formato por confirmar'}</span>
                      <span className="rounded-full bg-violet-400/10 px-3 py-1">{statusLabels[anime.status] || 'Estado por confirmar'}</span>
                    </div>
                    <h1 className="text-3xl font-bold leading-tight tracking-tight wrap-break-word sm:text-4xl lg:text-5xl">{title}</h1>
                    {titles.map(value => <p key={value} className="mt-2 text-sm text-slate-400">{value}</p>)}
                    <dl className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4"><dt className="text-xs text-slate-400">Puntuación</dt><dd className="mt-2 flex items-center gap-2 font-semibold text-amber-300"><Star size={16} aria-hidden="true" />{typeof anime.score === 'number' && Number.isFinite(anime.score) ? `${anime.score.toFixed(1)} / 10` : 'Sin puntuación'}</dd></div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4"><dt className="text-xs text-slate-400">Episodios</dt><dd className="mt-2 font-semibold">{displayNumber(anime.episodes)}</dd></div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4"><dt className="text-xs text-slate-400">Año</dt><dd className="mt-2 font-semibold">{displayNumber(anime.releaseYear)}</dd></div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4"><dt className="text-xs text-slate-400">Origen</dt><dd className="mt-2 font-semibold">{anime.source === 'tenrai' ? 'Tenrai' : 'NekoVerse'}</dd></div>
                    </dl>
                    <section className="mt-8" aria-labelledby="synopsis-title">
                      <h2 id="synopsis-title" className="text-lg font-semibold">Sinopsis</h2>
                      <p className="mt-3 text-sm leading-7 whitespace-pre-line text-slate-300">{anime.synopsis?.trim() || 'Todavía no hay una sinopsis disponible para este anime.'}</p>
                    </section>
                    <section className="mt-8" aria-labelledby="genres-title">
                      <h2 id="genres-title" className="text-lg font-semibold">Géneros</h2>
                      {genres.length ? <ul className="mt-3 flex flex-wrap gap-2">{[...new Set(genres)].map(genre => <li key={genre} className="rounded-full border border-violet-400/15 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-200">{genre}</li>)}</ul> : <p className="mt-3 text-sm text-slate-400">Géneros por confirmar.</p>}
                    </section>
                    <section className="mt-8" aria-labelledby="studios-title">
                      <h2 id="studios-title" className="text-lg font-semibold">Estudios</h2>
                      <p className="mt-3 text-sm text-slate-300">{studios.length ? studios.join(', ') : 'Estudios por confirmar.'}</p>
                      {typeof anime.externalId === 'number' && Number.isFinite(anime.externalId) && <p className="mt-3 text-xs text-slate-500">Identificador externo: {anime.externalId}</p>}
                    </section>
                  </div>
                </div>
              </article>
            )}
          </>
        )}
      </main>
      <footer className="mx-auto max-w-7xl px-5 py-8 text-xs text-slate-500 sm:px-8">NekoVerse · Un lugar para descubrir anime.</footer>
    </div>
  )
}
