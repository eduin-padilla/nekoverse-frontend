import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getAnimeBySlug } from '../api'

export function useAnime(slug: string | undefined) {
  return useQuery({
    queryKey: ['anime', slug],
    queryFn: ({ signal }) => getAnimeBySlug(slug!, signal),
    enabled: Boolean(slug?.trim()),
    staleTime: 60000,
    retry: (failureCount, error) => !(isAxiosError(error) && error.response?.status === 404) && failureCount < 1,
  })
}
