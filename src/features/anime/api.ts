import { api } from '../../lib/api'
import type { AnimeDetailResponse, AnimeListParams, AnimeListResponse } from './types'

export async function getAnimes(params: AnimeListParams, signal?: AbortSignal): Promise<AnimeListResponse> {
  const response = await api.get<AnimeListResponse>('/animes', { params, signal })
  if (!response.data.success || !Array.isArray(response.data.data) || !response.data.pagination) {
    throw new Error('La respuesta del catálogo no es válida')
  }
  return response.data
}

export async function getAnimeBySlug(slug: string, signal?: AbortSignal): Promise<AnimeDetailResponse> {
  const response = await api.get<AnimeDetailResponse>(`/animes/${encodeURIComponent(slug)}`, { signal })
  const anime = response.data?.data
  if (!response.data?.success || !anime || anime.slug !== slug || typeof anime.title !== 'string' || !anime.title.trim()) {
    throw new Error('La respuesta del anime no es válida')
  }
  return response.data
}
