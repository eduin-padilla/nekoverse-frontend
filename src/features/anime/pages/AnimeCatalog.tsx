import { useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { AnimeCard } from '../components/AnimeCard'
import { AnimeFilters } from '../components/AnimeFilters'
import { useAnimes } from '../hooks/useAnimes'
import type { AnimeFilters as AnimeFilterValues } from '../types'

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-400/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-40'

export function AnimeCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawPage = searchParams.get('page') ?? '1'
  const parsedPage = Number(rawPage)
  const page = /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(parsedPage) && Number.isSafeInteger((parsedPage - 1) * 12) ? parsedPage : 1
  const search = searchParams.get('search')?.trim()
  const filters: AnimeFilterValues = {
    search: search && search.length <= 150 ? search : undefined,
    genre: searchParams.get('genre')?.trim() || undefined,
    status: (['upcoming', 'airing', 'completed'] as const).find(value => value === searchParams.get('status')),
    type: (['TV', 'Movie', 'OVA', 'ONA', 'Special'] as const).find(value => value === searchParams.get('type')),
  }
  const { data, isPending, isError, isFetching, isPlaceholderData, fetchStatus, refetch } = useAnimes({ ...filters, page, limit: 12 })
  const pagination = data?.pagination
  const hasFilters = Boolean(filters.search || filters.genre || filters.status || filters.type)

  function applyFilters(nextFilters: AnimeFilterValues) {
    updateSearchParams(1, nextFilters)
  }

  function changePage(offset: number) {
    updateSearchParams(Math.max(1, page + offset), filters)
  }

  function updateSearchParams(nextPage: number, nextFilters: AnimeFilterValues) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value) params.set(key, value)
    }
    if (nextPage > 1) params.set('page', String(nextPage))
    setSearchParams(params)
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-violet-500/40">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-5 sm:px-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><BookOpen size={21} aria-hidden="true" /></span>
          <span className="text-xl font-bold tracking-tight">Neko<span className="text-violet-400">Verse</span></span>
          <span className="ml-auto text-xs text-slate-400">Tu universo de anime</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-violet-400 uppercase">El universo empieza aquí</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Historias que te acompañan.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">Explora nuestro catálogo de anime y encuentra tu próxima historia.</p>
        </div>
        <AnimeFilters key={JSON.stringify(filters)} filters={filters} onApply={applyFilters} />
        <section aria-labelledby="catalog-title" aria-busy={isFetching}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
            <h2 id="catalog-title" className="text-lg font-semibold">Catálogo de anime</h2>
            <p role="status" className="text-xs text-slate-400">
              {isFetching && data ? 'Actualizando catálogo…' : pagination ? `${pagination.total} ${hasFilters ? 'resultados' : 'animes publicados'}` : 'Explora el catálogo'}
            </p>
          </div>
          {isPending && (
            <div role="status" className="rounded-2xl border border-white/10 bg-slate-900/50 px-6 py-16 text-center">
              <RefreshCw className="mx-auto mb-4 text-violet-400 motion-safe:animate-spin" aria-hidden="true" />
              <p className="text-slate-300">{fetchStatus === 'paused' ? 'Sin conexión. El catálogo se cargará cuando vuelvas a conectarte.' : 'Cargando animes…'}</p>
            </div>
          )}
          {isError && (
            <div role="alert" className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6">
              <h3 className="font-semibold text-rose-200">No pudimos cargar el catálogo</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Comprueba tu conexión e inténtalo de nuevo.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className={buttonClass} onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={15} aria-hidden="true" />Reintentar</button>
                {!data && page > 1 && <button type="button" className={buttonClass} onClick={() => changePage(-1)}>Volver a la página anterior</button>}
              </div>
            </div>
          )}
          {data && data.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 px-6 py-16 text-center">
              <BookOpen size={32} className="mx-auto mb-4 text-violet-400" aria-hidden="true" />
              <h3 className="text-lg font-semibold">{pagination?.total === 0 ? hasFilters ? 'No encontramos animes con estos filtros' : 'El catálogo está por comenzar' : 'No hay animes en esta página'}</h3>
              <p className="mt-2 text-sm text-slate-400">{pagination?.total === 0 ? hasFilters ? 'Prueba con otro título o ajusta los filtros para seguir explorando.' : 'Todavía no hay animes publicados. Vuelve pronto para descubrir nuevas historias.' : 'Vuelve a la página anterior para seguir explorando.'}</p>
              {hasFilters && <button type="button" className={`${buttonClass} mt-5`} onClick={() => applyFilters({})}>Limpiar filtros</button>}
            </div>
          )}
          {data && data.data.length > 0 && (
            <div className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-6 ${isPlaceholderData ? 'opacity-60' : ''}`}>
              {data.data.map(anime => <AnimeCard key={anime._id} anime={anime} />)}
            </div>
          )}
          {pagination && (pagination.totalPages > 1 || page > 1) && (
            <nav aria-label="Paginación del catálogo" className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-white/10 pt-6">
              <button type="button" className={buttonClass} disabled={page <= 1 || isFetching || isPlaceholderData} onClick={() => changePage(-1)}><ChevronLeft size={16} aria-hidden="true" />Anterior</button>
              <span className="text-sm text-slate-400">Página {pagination.page} de {Math.max(1, pagination.totalPages)}</span>
              <button type="button" className={buttonClass} disabled={!pagination.hasNextPage || isFetching || isPlaceholderData} onClick={() => changePage(1)}>Siguiente<ChevronRight size={16} aria-hidden="true" /></button>
            </nav>
          )}
        </section>
      </main>
      <footer className="mx-auto max-w-7xl px-5 pb-8 text-xs text-slate-500 sm:px-8">NekoVerse · Un lugar para descubrir anime.</footer>
    </div>
  )
}
