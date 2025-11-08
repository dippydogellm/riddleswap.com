import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Package, 
  DollarSign, 
  Users, 
  TrendingUp,
  ShoppingCart,
  Coins
} from 'lucide-react';

interface CollectionShowcaseProps {
  collectionName: string;
  collectionSlug: string;
  description: string;
  issuerAddress: string;
  taxon: number;
  xrpCafeUrl: string;
  heroImage?: string;
  themeColors?: {
    primary: string;
    secondary: string;
  };
  additionalInfo?: {
    supply?: number;
    basePower?: number;
    role?: string;
    mintingStatus?: string;
    features?: string[];
  };
}

export function CollectionShowcase({
  collectionName,
  collectionSlug,
  description,
  issuerAddress,
  taxon,
  xrpCafeUrl,
  heroImage,
  themeColors = { primary: 'from-blue-600 to-purple-600', secondary: 'blue' },
  additionalInfo
}: CollectionShowcaseProps) {
  const [featuredNFTs, setFeaturedNFTs] = useState<any[]>([]);

  // Fetch collection stats from xrp.cafe API
  const { data: collectionData, isLoading } = useQuery({
    queryKey: [`/api/xrpl/collections/${issuerAddress}/${taxon}`],
    queryFn: async () => {
      const response = await fetch(`/api/xrpl/collections/${issuerAddress}/${taxon}`);
      if (!response.ok) throw new Error('Failed to fetch collection data');
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });

  const stats = collectionData?.collection || {};
  const nfts = stats.nfts || [];

  // Get first 6 NFTs as featured
  const featured = nfts.slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
        
        <div className="relative container mx-auto px-4 py-16">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Collection Image */}
            <div className="flex-shrink-0">
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-3xl group-hover:bg-blue-500/30 transition-all duration-500" />
                <img 
                  src={heroImage || stats.image || '/placeholder-collection.png'}
                  alt={collectionName}
                  className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 relative z-10 rounded-3xl object-cover shadow-2xl border-4 border-white/10"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSIyMDAiIHk9IjIxMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVCBDb2xsZWN0aW9uPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
            </div>

            {/* Right: Collection Info */}
            <div className="flex-1 space-y-6">
              <div>
                <Badge className="mb-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  Verified Collection
                </Badge>
                <h1 className={`text-5xl md:text-6xl font-bold bg-gradient-to-r ${themeColors.primary} bg-clip-text text-transparent mb-4`}>
                  {collectionName}
                </h1>
                <p className="text-xl text-gray-300 leading-relaxed">
                  {description}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400">Items</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.totalNFTs || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-400">Floor Price</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.floorPrice > 0 ? `${stats.floorPrice} XRP` : 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400">Owners</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.owners || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-gray-400">Volume</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.totalVolume || '0'} XRP
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <a href={xrpCafeUrl} target="_blank" rel="noopener noreferrer">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Buy on xrp.cafe
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
                
                <a href={`/collections/${collectionSlug}`}>
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-slate-600 text-white hover:bg-slate-800"
                  >
                    View Collection
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured NFTs Section */}
      {featured.length > 0 && (
        <div className="container mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-white mb-8">Featured NFTs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((nft: any) => (
              <Card 
                key={nft.nftokenID}
                className="group bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all duration-300 overflow-hidden"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={nft.image || nft.assets?.image || `https://cdn.bithomp.com/nft/${nft.nftokenID}`}
                    alt={nft.name || 'NFT'}
                    className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                  {nft.forSale && nft.sellPrice && (
                    <Badge className="absolute top-3 right-3 bg-green-600 text-white">
                      {nft.sellPrice} XRP
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg text-white mb-2 truncate">
                    {nft.name || `NFT #${nft.nftokenID?.slice(-4)}`}
                  </h3>
                  <a 
                    href={`${xrpCafeUrl}/${nft.nftokenID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full"
                  >
                    <Button 
                      size="sm" 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      View on xrp.cafe
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="container mx-auto px-4 py-16 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">About This Collection</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>{description}</p>
            
            {/* Additional Info Grid */}
            {additionalInfo && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {additionalInfo.mintingStatus && (
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-gray-400 mb-1">Status</div>
                    <div className={`font-bold ${additionalInfo.mintingStatus.includes('MINTING') ? 'text-green-400' : 'text-blue-400'}`}>
                      {additionalInfo.mintingStatus}
                    </div>
                  </div>
                )}
                {additionalInfo.supply && (
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-gray-400 mb-1">Supply</div>
                    <div className="font-bold text-white">{additionalInfo.supply.toLocaleString()}</div>
                  </div>
                )}
                {additionalInfo.basePower && (
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-gray-400 mb-1">Base Power</div>
                    <div className="font-bold text-yellow-400">{additionalInfo.basePower.toLocaleString()}</div>
                  </div>
                )}
                {additionalInfo.role && (
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-gray-400 mb-1">Role</div>
                    <div className="font-bold text-purple-400">{additionalInfo.role}</div>
                  </div>
                )}
              </div>
            )}

            {/* Features List */}
            {additionalInfo?.features && additionalInfo.features.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-bold text-white mb-4">Collection Features</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {additionalInfo.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">✓</span>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 mt-6">
              <div>
                <div className="text-sm text-gray-400">Issuer</div>
                <div className="font-mono text-sm text-blue-400">{issuerAddress}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Taxon</div>
                <div className="font-mono text-sm text-white">{taxon}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
