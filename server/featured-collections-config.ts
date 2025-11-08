// Programmable Featured Collections Configuration
// This file defines which collections appear in featured/trending sections
// All data is loaded dynamically from Bithomp API

export interface FeaturedCollectionConfig {
  taxon: number;
  priority: number; // Lower numbers appear first
  enabled: boolean;
  minVolume?: number; // Minimum 24h volume to show
  displayName?: string | null; // Override name if needed, null for authentic only
}

// Programmable configuration for featured collections
export const FEATURED_COLLECTIONS: FeaturedCollectionConfig[] = [
  {
    taxon: 0,
    priority: 1,
    enabled: true,
    minVolume: 0,
    displayName: null // Use only authentic name from metadata
  },
  {
    taxon: 1,
    priority: 2,
    enabled: false, // Taxon 1 doesn't exist
    minVolume: 0,
    displayName: null
  },
  {
    taxon: 2, 
    priority: 3,
    enabled: true,
    minVolume: 0,
    displayName: null // Use only authentic name from metadata
  },
  {
    taxon: 3,
    priority: 4, 
    enabled: true,
    minVolume: 0,
    displayName: null // Use only authentic name from metadata
  },
  {
    taxon: 4,
    priority: 5,
    enabled: true,
    minVolume: 0,
    displayName: null // Use only authentic name from metadata
  }
];

// Configuration for main page collection links
export const MAIN_PAGE_CONFIG = {
  showIndividualNFTs: false, // Only show collection links, no individual NFTs
  maxCollections: 4, // Maximum collections to show on main page
  sortBy: 'priority' as 'priority' | 'volume' | 'sales'
};

// Function to get enabled featured collections sorted by priority
export function getFeaturedCollectionsConfig(): FeaturedCollectionConfig[] {
  return FEATURED_COLLECTIONS
    .filter(config => config.enabled)
    .sort((a, b) => a.priority - b.priority);
}

// Function to check if a collection should be featured
export function shouldFeatureCollection(taxon: number, volume24h: number): boolean {
  const config = FEATURED_COLLECTIONS.find(c => c.taxon === taxon && c.enabled);
  if (!config) return false;
  
  if (config.minVolume && volume24h < config.minVolume) return false;
  
  return true;
}

// Function to get display name for collection
export function getCollectionDisplayName(taxon: number, apiName?: string): string | null {
  // ONLY use authentic API name from metadata
  if (apiName && apiName !== 'null' && apiName !== '') {
    return apiName;
  }
  
  // NO fallback names - return null if no authentic metadata
  return null;
}