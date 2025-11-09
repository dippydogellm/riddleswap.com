import { useQuery } from '@tanstack/react-query';

interface User {
  id: number;
  username: string;
  handle: string;
  walletAddress?: string;
  createdAt: string;
}

interface UserResponse {
  authenticated: boolean;
  user: User | null;
}

/**
 * Hook to get current authenticated user
 * Returns user data or null if not authenticated
 */
export function useUser() {
  const { data, isLoading, error } = useQuery<UserResponse>({
    queryKey: ['/api/users/me'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: data?.user || null,
    isAuthenticated: data?.authenticated || false,
    isLoading,
    error,
  };
}
