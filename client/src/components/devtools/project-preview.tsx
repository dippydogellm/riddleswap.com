import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Users, 
  Coins, 
  TrendingUp, 
  Globe, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Star,
  Activity
} from 'lucide-react';

interface BithompCollectionData {
  name?: string;
  description?: string;
  image?: string;
  verified?: boolean;
  totalNFTs?: number;
  owners?: number;
  floorPrice?: number;
  floorPriceUsd?: number;
  volume24h?: number;
  volume24hUsd?: number;
  website?: string;
  twitter?: string;
  discord?: string;
  issuer?: string;
  taxon?: number;
  createdAt?: string;
  lastActivity?: string;
}

interface ProjectPreviewProps {
  issuerWallet?: string;
  nftTokenTaxon?: number;
  onDataLoaded?: (data: BithompCollectionData) => void;
  onError?: (error: string) => void;
  className?: string;
  showRefreshButton?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function ProjectPreview({ 
  issuerWallet, 
  nftTokenTaxon, 
  onDataLoaded, 
  onError,
  className,
  showRefreshButton = true,
  autoRefresh = false,
  refreshInterval = 30000
}: ProjectPreviewProps) {
  const [manualRefresh, setManualRefresh] = useState(0);

  const { 
    data: collectionData, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useQuery<BithompCollectionData>({
    queryKey: ['bithomp-collection', issuerWallet, nftTokenTaxon, manualRefresh],
    queryFn: async () => {
      if (!issuerWallet) {
        throw new Error('Issuer wallet address is required');
      }

      const params = new URLSearchParams({
        issuer: issuerWallet,
        ...(nftTokenTaxon && { taxon: nftTokenTaxon.toString() })
      });

      const response = await fetch(`/api/bithomp/collection-preview?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch collection data: ${response.statusText}`);
      }

      const result = await response.json() as any;
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch collection data');
      }

      return result.collection as BithompCollectionData;
    },
    enabled: !!issuerWallet,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Notify parent component when data is loaded or error occurs
  useEffect(() => {
    if (collectionData) {
      onDataLoaded?.(collectionData);
    }
  }, [collectionData, onDataLoaded]);

  useEffect(() => {
    if (error) {
      onError?.(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [error, onError]);

  const handleRefresh = () => {
    setManualRefresh(prev => prev + 1);
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return new Intl.NumberFormat().format(num);
  };

  const formatPrice = (price: number | undefined, currency: string = 'XRP') => {
    if (price === undefined || price === null) return 'N/A';
    const formatted = price < 0.01 ? price.toFixed(6) : price.toFixed(2);
    return `${formatted} ${currency}`;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!issuerWallet) {
    return (
      <Alert className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Please provide an issuer wallet address to preview collection data.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card className={`${className} border-blue-200 dark:border-blue-800`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-16 mb-1" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div>
                  <Skeleton className="h-4 w-16 mb-1" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof Error ? error.message : 'Failed to load collection data'}</span>
          {showRefreshButton && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefetching}
              className="ml-2"
              data-testid="refresh-preview-button"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!collectionData) {
    return (
      <Alert className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          No collection data found for the provided issuer and taxon.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={`${className} bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800`} data-testid="project-preview-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            {collectionData.image ? (
              <img 
                src={collectionData.image} 
                alt={`${collectionData.name} logo`}
                className="w-16 h-16 rounded-lg object-cover border-2 border-white shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl border-2 border-white shadow-sm">
                {collectionData.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <span data-testid="collection-name">
                  {collectionData.name || 'Unnamed Collection'}
                </span>
                {collectionData.verified && (
                  <Badge className="bg-blue-500 text-white border-blue-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                <span className="font-mono text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded border">
                  {issuerWallet?.slice(0, 8)}...{issuerWallet?.slice(-6)}
                </span>
                {nftTokenTaxon && (
                  <>
                    <span className="mx-2">•</span>
                    <span>Taxon {nftTokenTaxon}</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {showRefreshButton && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefetching}
                data-testid="refresh-collection-data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {collectionData.website && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(collectionData.website, '_blank')}
                data-testid="collection-website"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Description and Links */}
          <div className="space-y-4">
            {collectionData.description && (
              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Description</h4>
                <p className="text-sm bg-white dark:bg-slate-800/50 p-3 rounded-lg border line-clamp-4" data-testid="collection-description">
                  {collectionData.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 p-3 bg-white dark:bg-slate-800/50 rounded-lg border">
                <Coins className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-lg font-bold" data-testid="total-nfts">
                    {formatNumber(collectionData.totalNFTs)}
                  </p>
                  <p className="text-xs text-slate-500">Total NFTs</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 p-3 bg-white dark:bg-slate-800/50 rounded-lg border">
                <Users className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-lg font-bold" data-testid="owners-count">
                    {formatNumber(collectionData.owners)}
                  </p>
                  <p className="text-xs text-slate-500">Owners</p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            {(collectionData.website || collectionData.twitter || collectionData.discord) && (
              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Links</h4>
                <div className="flex space-x-2">
                  {collectionData.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(collectionData.website, '_blank')}
                      data-testid="social-website"
                    >
                      <Globe className="w-4 h-4" />
                    </Button>
                  )}
                  {collectionData.twitter && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(collectionData.twitter, '_blank')}
                      data-testid="social-twitter"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </Button>
                  )}
                  {collectionData.discord && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(collectionData.discord, '_blank')}
                      data-testid="social-discord"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Market Data */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Market Data</h4>
            
            {(collectionData.floorPrice || collectionData.volume24h) && (
              <div className="grid grid-cols-1 gap-4">
                {collectionData.floorPrice && (
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border">
                    <div className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium">Floor Price</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold" data-testid="floor-price">
                        {formatPrice(collectionData.floorPrice)}
                      </p>
                      {collectionData.floorPriceUsd && (
                        <p className="text-xs text-slate-500" data-testid="floor-price-usd">
                          ${formatPrice(collectionData.floorPriceUsd, '')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {collectionData.volume24h && (
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">24h Volume</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold" data-testid="volume-24h">
                        {formatPrice(collectionData.volume24h)}
                      </p>
                      {collectionData.volume24hUsd && (
                        <p className="text-xs text-slate-500" data-testid="volume-24h-usd">
                          ${formatPrice(collectionData.volume24hUsd, '')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity Info */}
            <div className="space-y-2">
              {collectionData.createdAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Created</span>
                  <span className="font-medium">{formatDate(collectionData.createdAt)}</span>
                </div>
              )}
              {collectionData.lastActivity && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                    <Activity className="w-3 h-3" />
                    <span>Last Activity</span>
                  </span>
                  <span className="font-medium">{formatDate(collectionData.lastActivity)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
