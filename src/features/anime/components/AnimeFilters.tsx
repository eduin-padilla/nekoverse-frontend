import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { AnimeFilters as AnimeFilterValues } from '../types'

const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20'

interface AnimeFiltersProps {
  filters: AnimeFilterValues
  onApply: (filters: AnimeFilterValues) => void
}

export function AnimeFilters({ filters, onApply }: AnimeFiltersProps) {
  const [draft, setDraft] = useState<AnimeFilterValues>(filters)

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextFilters = {
      search: draft.search?.trim() || undefined,
      genre: draft.genre?.trim() || undefined,
      status: draft.status,
      type: draft.type,
    }
    setDraft(nextFilters)
    onApply(nextFilters)
  }

  function clearFilters() {
    setDraft({})
    onApply({})
  }

  return (
    <form aria-label="Buscar y filtrar animes" onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr]">
        <label className="text-xs font-medium text-slate-300">
          Buscar por título
          <input type="search" name="search" maxLength={150} value={draft.search ?? ''} onChange={event => setDraft(current => ({ ...current, search: event.target.value }))} placeholder="¿Qué anime quieres encontrar?" className={inputClass} />
        </label>
        <label className="text-xs font-medium text-slate-300">
          Género
          <input type="text" name="genre" value={draft.genre ?? ''} onChange={event => setDraft(current => ({ ...current, genre: event.target.value }))} placeholder="Ej.: Action" aria-describedby="genre-help" className={inputClass} />
        </label>
        <label className="text-xs font-medium text-slate-300">
          Estado
          <select name="status" value={draft.status ?? ''} onChange={event => setDraft(current => ({ ...current, status: (event.target.value || undefined) as AnimeFilterValues['status'] }))} className={inputClass}>
            <option value="">Todos los estados</option>
            <option value="upcoming">Próximamente</option>
            <option value="airing">En emisión</option>
            <option value="completed">Finalizado</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-300">
          Formato
          <select name="type" value={draft.type ?? ''} onChange={event => setDraft(current => ({ ...current, type: (event.target.value || undefined) as AnimeFilterValues['type'] }))} className={inputClass}>
            <option value="">Todos los formatos</option>
            <option value="TV">Serie TV</option>
            <option value="Movie">Película</option>
            <option value="OVA">OVA</option>
            <option value="ONA">ONA</option>
            <option value="Special">Especial</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="genre-help" className="flex items-start gap-2 text-xs leading-5 text-slate-400"><SlidersHorizontal size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Introduce un solo género con su nombre completo, tal como aparece en el catálogo.</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400"><Search size={16} aria-hidden="true" />Aplicar filtros</button>
          <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400"><X size={16} aria-hidden="true" />Limpiar</button>
        </div>
      </div>
    </form>
  )
}
