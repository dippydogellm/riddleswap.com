import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface UnifiedMetadata {
  // Core project info
  id: string;
  name: string;
  description?: string;
  website?: string;
  
  // Media
  logo_url?: string;
  banner_url?: string;
  image?: string; // Fallback image
  
  // Social links
  social_links?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    [key: string]: string | undefined;
  };
  
  // Chain data
  chain: string;
  issuer?: string;
  issuer_wallet?: string;
  nft_token_taxon?: number;
  contract_address?: string;
  
  // Statistics (from Bithomp/chain data)
  floor_price?: string;
  floor_price_usd?: number;
  total_nfts?: number;
  owners?: number;
  volume_24h?: number;
  volume_24h_usd?: number;
  market_cap?: number;
  
  // Override info
  has_override: boolean;
  override_published: boolean;
  verified: boolean;
  
  // Source tracking
  data_sources: {
    bithomp?: boolean;
    override?: boolean;
    chain?: boolean;
  };
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  last_fetched?: string;
}

// Hook for fetching unified metadata
export function useUnifiedMetadata(
  issuer: string, 
  taxon?: number, 
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  const enabled = options?.enabled ?? (!!issuer);
  
  return useQuery<UnifiedMetadata>({
    queryKey: taxon 
      ? ['/api/metadata/unified', issuer, taxon]
      : ['/api/metadata/unified', issuer],
    queryFn: async ({ queryKey }) => {
      const [, issuer, taxon] = queryKey;
      const url = taxon 
        ? `/api/metadata/unified/${issuer}/${taxon}`
        : `/api/metadata/unified/${issuer}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch metadata');
      }
      return response.json();
    },
    enabled,
    staleTime: options?.staleTime ?? 300000, // 5 minutes
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: false,
  });
}

// Hook for batch metadata fetching
export function useBatchUnifiedMetadata(
  projects: Array<{ issuer: string; taxon?: number }>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const enabled = options?.enabled ?? (projects.length > 0);
  
  return useQuery<UnifiedMetadata[]>({
    queryKey: ['/api/metadata/unified/batch', projects],
    queryFn: async () => {
      const response = await apiRequest('/api/metadata/unified/batch', {
        method: 'POST',
        body: JSON.stringify({ projects }),
      });
      return response.json();
    },
    enabled,
    staleTime: options?.staleTime ?? 300000, // 5 minutes
  });
}

// Hook for marketplace listings with unified metadata
export function useMarketplaceMetadata(
  page: number = 1,
  limit: number = 20,
  filters?: {
    verified?: boolean;
    hasOverrides?: boolean;
    chain?: string;
    sortBy?: 'floor_price' | 'volume_24h' | 'created_at' | 'owners';
    sortOrder?: 'asc' | 'desc';
  }
) {
  return useQuery<{
    items: UnifiedMetadata[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ['/api/metadata/marketplace', { page, limit, ...filters }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey;
      const searchParams = new URLSearchParams();
      
      Object.entries(params as Record<string, any>).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
      
      const response = await fetch(`/api/metadata/marketplace?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch marketplace data');
      }
      return response.json();
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
}

// Hook for search with unified metadata
export function useMetadataSearch(
  query: string,
  options?: {
    chains?: string[];
    verified?: boolean;
    hasOverrides?: boolean;
    limit?: number;
  }
) {
  const enabled = query.length >= 2; // Minimum 2 characters
  
  return useQuery<UnifiedMetadata[]>({
    queryKey: ['/api/metadata/search', query, options],
    queryFn: async ({ queryKey }) => {
      const [, searchQuery, searchOptions] = queryKey;
      const params = new URLSearchParams({
        q: searchQuery as string,
        limit: ((searchOptions as any)?.limit || 20).toString(),
      });
      
      if ((searchOptions as any)?.chains) {
        (searchOptions as any).chains.forEach((chain: string) => {
          params.append('chains[]', chain);
        });
      }
      
      if ((searchOptions as any)?.verified !== undefined) {
        params.append('verified', (searchOptions as any).verified.toString());
      }
      
      if ((searchOptions as any)?.hasOverrides !== undefined) {
        params.append('hasOverrides', (searchOptions as any).hasOverrides.toString());
      }
      
      const response = await fetch(`/api/metadata/search?${params}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return response.json();
    },
    enabled,
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook for getting metadata stats
export function useMetadataStats() {
  return useQuery<{
    totalProjects: number;
    verifiedProjects: number;
    totalOverrides: number;
    publishedOverrides: number;
    chainDistribution: Record<string, number>;
    recentActivity: {
      overridesCreated: number;
      overridesPublished: number;
      newVerifications: number;
    };
  }>({
    queryKey: ['/api/metadata/stats'],
    staleTime: 300000, // 5 minutes
    refetchInterval: 300000, // 5 minutes
  });
}

// Utility hook for cache management
export function useMetadataCache() {
  const invalidateProject = (issuer: string, taxon?: number) => {
    // This would use the queryClient to invalidate specific cache entries
    // Implementation depends on how you want to expose this functionality
  };

  const invalidateMarketplace = () => {
    // Invalidate marketplace cache
  };

  const prefetchMetadata = (issuer: string, taxon?: number) => {
    // Prefetch metadata for better UX
  };

  return {
    invalidateProject,
    invalidateMarketplace,
    prefetchMetadata,
  };
}
