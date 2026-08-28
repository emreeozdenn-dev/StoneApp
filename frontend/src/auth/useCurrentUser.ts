import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '../api/auth'

export function useCurrentUser() {
  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  })

  return {
    user: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function hasPermission(permissions: string[] | undefined, key: string): boolean {
  return !!permissions?.includes(key)
}
