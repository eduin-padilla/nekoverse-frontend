import { useState } from 'react'
import { Film, Star } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { Anime } from '../types'

const statusLabels: Record<Anime['status'], string> = {
  upcoming: 'Próximamente',
  airing: 'En emisión',
  completed: 'Finalizado',
}

export function AnimeCard({ anime }: { anime: Anime }) {
  const { search } = useLocation()
  const [failedPoster, setFailedPoster] = useState<string | null>(null)
  const posterUrl = anime.posterUrl?.trim()
  const showPoster = Boolean(posterUrl && failedPoster !== posterUrl)

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
      <Link to={{ pathname: `/animes/${encodeURIComponent(anime.slug)}`, search }} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-400">
      <div className="relative aspect-2/3 overflow-hidden bg-slate-800">
        {showPoster ? (
          <img src={posterUrl} alt={`Póster de ${anime.title}`} loading="lazy" decoding="async" onError={() => setFailedPoster(posterUrl ?? null)} className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
        ) : (
          <div role="img" aria-label={`Póster no disponible para ${anime.title}`} className="flex h-full flex-col items-center justify-center gap-3 bg-linear-to-br from-slate-800 to-violet-950 px-4 text-center text-slate-400">
            <Film size={36} aria-hidden="true" />
            <span className="text-xs">Póster no disponible</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/90 to-transparent px-4 pb-4 pt-10">
          <span className="rounded-md bg-slate-950/75 px-2 py-1 text-xs font-medium text-slate-200">{statusLabels[anime.status]}</span>
        </div>
        {typeof anime.score === 'number' && Number.isFinite(anime.score) && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-slate-950/85 px-2 py-1 text-xs font-semibold text-amber-300">
            <Star size={12} aria-hidden="true" />
            <span aria-label={`Puntuación: ${anime.score}`}>{anime.score.toFixed(1)}</span>
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-xs text-slate-400">{anime.type} · {anime.releaseYear ?? 'Año por confirmar'}</p>
        <h2 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 text-slate-100">{anime.title}</h2>
        <p className="text-xs text-slate-400">{anime.episodes == null ? 'Episodios por confirmar' : `${anime.episodes} episodios`}</p>
        <div className="flex min-h-6 flex-wrap gap-1.5">
          {anime.genres.slice(0, 2).map(genre => <span key={genre} className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">{genre}</span>)}
        </div>
      </div>
      </Link>
    </article>
  )
}
