import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Image, 
  Coins, 
  ArrowRight, 
  Package, 
  Sparkles,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

export default function LaunchWizard() {
  const [, setLocation] = useLocation();

  const launchOptions = [
    {
      id: 'nft-single',
      title: '1:1 NFT Launch',
      description: 'Create individual unique NFTs with custom metadata and properties',
      icon: Image,
      color: 'from-purple-500 to-pink-500',
      features: [
        'Single NFT minting',
        'Custom metadata',
        'Royalty settings',
        'IPFS storage'
      ],
      path: '/launch/nft-single',
      badge: 'Quick Start'
    },
    {
      id: 'nft-collection',
      title: 'NFT Collection Launch',
      description: 'Launch complete NFT collections with bulk upload and automated minting',
      icon: Package,
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Bulk image upload',
        'Automated metadata generation',
        'Collection management',
        'IPFS batch upload'
      ],
      path: '/launch/nft-collection',
      badge: 'Most Popular'
    },
    {
      id: 'token',
      title: 'Token Launch',
      description: 'Create and deploy tokens across 17 chains with liquidity setup',
      icon: Coins,
      color: 'from-green-500 to-emerald-500',
      features: [
        'Multi-chain deployment',
        'Liquidity pool setup',
        'Bonding curve options',
        'Automatic distribution'
      ],
      path: '/launch/token',
      badge: 'Pro Feature'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <Rocket className="h-5 w-5 text-blue-400" />
            <span className="text-blue-300 font-medium">RiddleSwap Launch Wizard</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            Launch Your Project
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Create and deploy NFTs or tokens across multiple blockchains with our production-ready wizard
          </p>
        </div>

        {/* Launch Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {launchOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Card 
                key={option.id}
                className="bg-slate-900/50 border-slate-700 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer group"
                onClick={() => setLocation(option.path)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${option.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                      {option.badge}
                    </Badge>
                  </div>
                  
                  <CardTitle className="text-white text-xl mb-2">
                    {option.title}
                  </CardTitle>
                  
                  <CardDescription className="text-slate-400">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {option.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full group-hover:bg-blue-600 transition-colors"
                    onClick={() => setLocation(option.path)}
                  >
                    Start Launch
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Overview */}
        <Card className="bg-slate-900/30 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Production-Ready Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-slate-300">
              <div>
                <h3 className="font-semibold text-white mb-2">IPFS Integration</h3>
                <p className="text-sm text-slate-400">
                  Automated Pinata IPFS uploads with verification and permanent storage
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Multi-Chain Support</h3>
                <p className="text-sm text-slate-400">
                  Deploy across 17 blockchains including XRPL, Ethereum, Solana, and more
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Automated Verification</h3>
                <p className="text-sm text-slate-400">
                  Built-in validation and verification for metadata, images, and deployments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
