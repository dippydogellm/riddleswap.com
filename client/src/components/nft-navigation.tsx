import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rocket, Store, Settings, TrendingUp, Image } from 'lucide-react';

interface NFTNavigationProps {
  className?: string;
}

export function NFTNavigation({ className }: NFTNavigationProps) {
  const nftPages = [
    {
      title: '🚀 NFT Launchpad',
      description: 'Launch your NFT collection on XRPL',
      href: '/nft-launchpad',
      icon: Rocket,
      badge: 'Create',
      color: 'from-blue-600 to-purple-600'
    },
    {
      title: '🏪 NFT Marketplace',
      description: 'Buy and sell XRPL NFTs',
      href: '/nft-marketplace',
      icon: Store,
      badge: 'Trade',
      color: 'from-green-600 to-blue-600'
    },
    {
      title: '📊 Management',
      description: 'Manage your NFT projects and collections',
      href: '/nft-management',
      icon: Settings,
      badge: 'Manage',
      color: 'from-purple-600 to-pink-600'
    },
    {
      title: '🔥 Top 24h',
      description: 'Discover trending NFT collections',
      href: '/nft-top24h',
      icon: TrendingUp,
      badge: 'Trending',
      color: 'from-orange-600 to-red-600'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {nftPages.map((page) => (
        <Card key={page.href} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className={`mx-auto w-16 h-16 bg-gradient-to-r ${page.color} rounded-full flex items-center justify-center`}>
                <page.icon className="w-8 h-8 text-white" />
              </div>
              
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{page.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {page.badge}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {page.description}
                </p>
              </div>
              
              <Button 
                disabled 
                className={`w-full bg-gray-400 cursor-not-allowed opacity-60`}
              >
                Under Construction
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function NFTQuickLinks() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm" disabled className="opacity-60 cursor-not-allowed">
            <Rocket className="w-4 h-4 mr-2" />
            Launch NFTs
          </Button>
          <Button variant="outline" size="sm" disabled className="opacity-60 cursor-not-allowed">
            <Store className="w-4 h-4 mr-2" />
            Marketplace
          </Button>
          <Button variant="outline" size="sm" disabled className="opacity-60 cursor-not-allowed">
            <TrendingUp className="w-4 h-4 mr-2" />
            Top Collections
          </Button>
          <Button variant="outline" size="sm" disabled className="opacity-60 cursor-not-allowed">
            <Settings className="w-4 h-4 mr-2" />
            Manage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
