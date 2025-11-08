import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, Eye, X } from 'lucide-react';
import { useLocation } from 'wouter';

interface Collection {
  issuer: string;
  taxon: number;
  name: string;
  image?: string;
  floorPrice: number;
  volume24h: number;
  totalNFTs: number;
  description?: string;
  verified?: boolean;
}

export function CollectionSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [, setLocation] = useLocation();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/nft/collections/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      
      if (response.ok) {
        const data = await response.json() as any;
        setSearchResults(data.collections || []);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Collection search failed:', error);
      setSearchResults([]);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const formatXRP = (amount: number) => {
    if (!amount || amount === 0) return '0 XRP';
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XRP`;
  };

  return (
    <div className="relative">
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Collection Search</h3>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search collections by name or issuer address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {showResults && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto border shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-2">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Searching collections...</div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2 py-1">
                  Found {searchResults.length} collection{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((collection) => (
                  <div
                    key={`${collection.issuer}-${collection.taxon}`}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    onClick={() => {
                      setLocation(`/nft-collection/${collection.issuer}/${collection.taxon}`);
                      clearSearch();
                    }}
                  >
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {collection.image ? (
                        <img 
                          src={collection.image?.includes('bithomp.com') ? collection.image : `https://bithomp.com/api/v2/nft/${collection.issuer}/${collection.taxon}/image`} 
                          alt={collection.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://bithomp.com/api/v2/nft/${collection.issuer}/${collection.taxon}/image?fallback=true`;
                          }}
                        />
                      ) : (
                        <Layers className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate text-gray-900 dark:text-white">{collection.name}</h4>
                        {collection.verified && (
                          <Badge variant="secondary" className="text-xs">Verified</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground dark:text-gray-400 font-mono truncate">
                        {collection.issuer ? `${collection.issuer.slice(0, 8)}...${collection.issuer.slice(-4)}` : 'Unknown issuer'} / Taxon {collection.taxon || 0}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>Floor: {formatXRP(collection.floorPrice)}</span>
                        <span>Items: {collection.totalNFTs}</span>
                        <span>24h Vol: {formatXRP(collection.volume24h)}</span>
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No collections found for "{searchQuery}"
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
