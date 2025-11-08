import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { formatXRP, formatPercentage } from '@/utils/formatting';

interface CollectionStats {
  collectionId: string;
  name: string;
  floorPrice: number;
  volume24h: number;
  volumeChange24h: number;
  sales24h: number;
  owners: number;
  totalNFTs: number;
  image?: string;
  issuer?: string;
  taxon?: number;
}

export function NFTTrendingCollections() {
  const [collections, setCollections] = useState<CollectionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchCollections();
  }, [period]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      // Add cache-busting to ensure fresh data - increase limit to get more real projects
      const response = await fetch(`/api/nft/marketplace/top-collections?period=${period}&limit=20&_t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json() as any;
        setCollections(data);

      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const formatChange = (change: number) => {
    const isPositive = change >= 0;
    return (
      <span className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {formatPercentage(Math.abs(change))}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trending Collections</CardTitle>
          <div className="flex gap-2">
            {([{ key: '24h', label: '24H' }, { key: '7d', label: '7D' }, { key: '30d', label: '30D' }] as const).map((p) => (
              <Badge
                key={p.key}
                variant={period === p.key ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setPeriod(p.key as '24h' | '7d' | '30d')}
              >
                {p.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {collections.filter(c => 
              (c.name && c.name !== 'Unnamed Collection') || 
              c.totalNFTs > 0 || 
              c.floorPrice > 0 || 
              c.volume24h > 0 ||
              c.owners > 0
            ).slice(0, 15).map((collection, index) => (
              <Link
                key={`${collection.collectionId}-${collection.volume24h}-${index}`}
                href={`/nft-collection/${collection.issuer}/${collection.taxon}`}
                className="flex items-center space-x-3 lg:space-x-4 p-3 lg:p-4 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-center w-8 text-sm font-medium text-gray-500">
                  #{index + 1}
                </div>
                
                <div className="w-12 h-12 lg:w-16 lg:h-16 relative rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={`/api/nft/image/${collection.issuer}:${collection.taxon}`} 
                    alt={collection.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiNmM2Y0ZjYiIHJ4PSI4Ii8+PHRleHQgeD0iMzIiIHk9IjM2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNmI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ORlQ8L3RleHQ+PC9zdmc+`;
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-semibold text-sm lg:text-base truncate mb-1">{collection.name || `Taxon ${collection.taxon}`}</h4>
                  <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-4 text-xs lg:text-sm text-gray-500">
                    <span className="flex-shrink-0">Floor: {collection.floorPrice > 0 ? `${formatXRP(collection.floorPrice)} XRP` : 'Not Listed'}</span>
                    <span className="flex-shrink-0">{collection.totalNFTs || 0} NFTs</span>
                    <span className="flex-shrink-0">{collection.owners || 0} owners</span>
                  </div>
                </div>
                
                <div className="text-right min-w-0 flex-shrink-0">
                  <div className="font-semibold text-sm lg:text-base whitespace-nowrap">
                    {collection.volume24h > 0 ? `${formatXRP(collection.volume24h)} XRP` : '-'}
                  </div>
                  <div className="text-xs lg:text-sm whitespace-nowrap">
                    {collection.volumeChange24h ? formatChange(collection.volumeChange24h) : 'New'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
