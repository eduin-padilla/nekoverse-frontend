export interface Anime {
  _id: string
  title: string
  titleEnglish?: string | null
  titleJapanese?: string | null
  slug: string
  synopsis?: string | null
  posterUrl?: string | null
  bannerUrl?: string | null
  externalId?: number | null
  source?: 'tenrai' | null
  externalUrl?: string | null
  episodes?: number | null
  score?: number | null
  studios?: string[] | null
  genres: string[]
  releaseYear?: number | null
  status: 'upcoming' | 'airing' | 'completed'
  type: 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special'
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface AnimeFilters {
  search?: string
  genre?: string
  status?: Anime['status']
  type?: Anime['type']
}

export interface AnimeListParams extends AnimeFilters {
  page: number
  limit: number
}

export interface AnimeListResponse {
  success: true
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  data: Anime[]
}

export interface AnimeDetailResponse {
  success: true
  data: Anime
}
