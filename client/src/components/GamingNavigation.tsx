import React from 'react';
import { Link } from 'wouter';
import { 
  Home, 
  Users, 
  Swords, 
  Trophy, 
  Map, 
  Shield, 
  Package,
  ShoppingCart,
  Landmark,
  Crown,
  Gamepad2
} from 'lucide-react';

interface GamingNavigationProps {
  theme?: 'light' | 'dark';
  className?: string;
}

const GamingNavigation: React.FC<GamingNavigationProps> = ({ theme = 'dark', className = '' }) => {
  const navigationItems = [
    {
      name: 'Gaming Hub',
      href: '/gaming',
      icon: <Gamepad2 className="h-4 w-4" />,
      description: 'Your command center'
    },
    {
      name: 'The Trolls Inquisition',
      href: '/trolls-inquisition',
      icon: <Crown className="h-4 w-4" />,
      description: 'NFT Battle Arena'
    },
    {
      name: 'RiddleCity',
      href: '/riddle-city',
      icon: <Map className="h-4 w-4" />,
      description: 'Virtual land metaverse'
    },
    {
      name: 'Land Marketplace',
      href: '/land-marketplace',
      icon: <Landmark className="h-4 w-4" />,
      description: 'Buy and manage land'
    },
    {
      name: 'NFT Marketplace',
      href: '/gaming-nfts',
      icon: <ShoppingCart className="h-4 w-4" />,
      description: 'Browse gaming NFTs'
    },
    {
      name: 'NFT Browser',
      href: '/gaming/nfts/browse',
      icon: <Package className="h-4 w-4" />,
      description: 'Advanced NFT search'
    },
    {
      name: 'My NFTs',
      href: '/gaming/my-nfts',
      icon: <Package className="h-4 w-4" />,
      description: 'View your collection'
    },
    {
      name: 'Battle Arena',
      href: '/gaming/battles',
      icon: <Swords className="h-4 w-4" />,
      description: 'Squadrons & battles'
    },
    {
      name: 'Alliance Hub',
      href: '/alliances',
      icon: <Shield className="h-4 w-4" />,
      description: 'Join forces with others'
    },
    {
      name: 'Leaderboards',
      href: '/gaming#leaderboards',
      icon: <Trophy className="h-4 w-4" />,
      description: 'Global rankings'
    },
    {
      name: 'Profile Editor',
      href: '/edit-gaming-profile',
      icon: <Crown className="h-4 w-4" />,
      description: 'Customize your profile'
    }
  ];

  const bgColor = theme === 'dark' ? 'bg-slate-800/50' : 'bg-white/90';
  const borderColor = theme === 'dark' ? 'border-purple-500/30' : 'border-purple-300';
  const textColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const hoverBg = theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50';

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 ${className}`}>
      <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        🎮 Gaming Features
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 p-3 rounded-lg transition-all ${textColor} ${hoverBg} border ${borderColor}`}
          >
            <div className="flex-shrink-0">{item.icon}</div>
            <div className="flex-1">
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-xs opacity-70">{item.description}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className={`mt-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-600/30' : 'bg-yellow-50 border-yellow-300'} border`}>
        <p className={`text-sm ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800'}`}>
          💡 <strong>No NFTs? No problem!</strong> You can still purchase land, join alliances, and participate in the gaming ecosystem. Get started by exploring the marketplace or buying your first plot of land!
        </p>
      </div>
    </div>
  );
};

export default GamingNavigation;
