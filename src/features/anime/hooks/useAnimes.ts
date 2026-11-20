import { useQuery } from '@tanstack/react-query'
import { getAnimes } from '../api'
import type { AnimeListParams } from '../types'

export function useAnimes(params: AnimeListParams) {
  return useQuery({
    queryKey: ['animes', params],
    queryFn: ({ signal }) => getAnimes(params, signal),
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery?.queryKey[0] !== 'animes') return undefined
      const previous = previousQuery.queryKey[1] as AnimeListParams | undefined
      const sameFilters = previous && previous.limit === params.limit && previous.search === params.search && previous.genre === params.genre && previous.status === params.status && previous.type === params.type
      return sameFilters && previous.page !== params.page ? previousData : undefined
    },
    staleTime: 60000,
    retry: 1,
  })
}
