import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Image as ImageIcon, Eye, X, Hash } from 'lucide-react';
import { useLocation } from 'wouter';

interface NFT {
  nftId: string;
  name: string;
  collection?: string;
  issuer: string;
  taxon: number;
  image?: string;
  price?: number;
  currency?: string;
  hasOffers?: boolean;
  lastSale?: number;
  rarity?: string;
  description?: string;
}

export function NFTSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [, setLocation] = useLocation();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/nft/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      
      if (response.ok) {
        const data = await response.json() as any;
        setSearchResults(data.nfts || []);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(true);
      }
    } catch (error) {
      console.error('NFT search failed:', error);
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

  const formatPrice = (price?: number, currency?: string) => {
    if (!price) return 'Not listed';
    return `${price.toFixed(2)} ${currency || 'XRP'}`;
  };

  return (
    <div className="relative">
      <Card className="border-2 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">NFT Search</h3>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search NFTs by name, issuer, or token ID..."
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
        <Card className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto border shadow-lg bg-white">
          <CardContent className="p-2">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">Searching NFTs...</div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-600 px-2 py-1">
                  Found {searchResults.length} NFT{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((nft) => (
                  <div
                    key={nft.nftId}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => {
                      setLocation(`/nft/${nft.nftId}`);
                      clearSearch();
                    }}
                  >
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {nft.image ? (
                        <img 
                          src={nft.image} 
                          alt={nft.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://bithomp.com/api/v2/nft/${nft.issuer}/${nft.taxon}/image?fallback=true`;
                          }}
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{nft.name}</h4>
                        {nft.hasOffers && (
                          <Badge variant="secondary" className="text-xs">Has Offers</Badge>
                        )}
                        {nft.rarity && (
                          <Badge variant="outline" className="text-xs">{nft.rarity}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono truncate">
                        <Hash className="h-3 w-3 inline mr-1" />
                        {nft.nftId}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {nft.issuer.slice(0, 8)}...{nft.issuer.slice(-4)} / Taxon {nft.taxon}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Price: {formatPrice(nft.price, nft.currency)}</span>
                        {nft.lastSale && <span>Last Sale: {nft.lastSale} XRP</span>}
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                No NFTs found for "{searchQuery}"
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
