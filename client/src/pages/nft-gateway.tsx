import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, TrendingUp, Gift, Star, Copy, ExternalLink, RefreshCw, Plus, Coins, Image, Trophy, Clock } from 'lucide-react';

// TypeScript interfaces for type safety
interface ConnectedWallet {
  id: string;
  chain: string;
  type: string;
  address: string;
  balance: string;
}

interface Asset {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  type: 'token' | 'nft';
  balance: string;
  value: string;
  image: string;
}

interface Reward {
  id: number;
  type: 'Daily Login' | 'Swap Bonus' | 'Collection Milestone';
  description: string;
  amount: string;
  isClaimable: boolean;
  progress?: string;
  expiresIn?: string;
}

export default function NFTGatewayPage() {
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [selectedChain, setSelectedChain] = useState("all");

  const handleConnectWallet = () => {
    // Wallet connection logic will be integrated with existing system
  };

  const handleClaimReward = (rewardId: number) => {
    setRewards(rewards.map(reward => 
      reward.id === rewardId 
        ? { ...reward, isClaimable: false, description: "Claimed successfully!" }
        : reward
    ));
  };

  const handleRefreshAssets = () => {
    // Refresh assets from blockchain

  };

  const filteredAssets = selectedChain === "all" 
    ? assets 
    : assets.filter(asset => asset.chain.toLowerCase() === selectedChain);

  const totalValue = assets.reduce((sum, asset) => {
    const value = parseFloat(asset.value.replace(/[$,]/g, ''));
    return sum + value;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
            🚪 NFT Gateway
          </h1>
          <p className="text-xl text-gray-700 font-medium max-w-3xl mx-auto leading-relaxed">
            Your comprehensive multi-chain wallet manager for assets, NFTs, and rewards collection
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="bg-blue-50 border-2 border-blue-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <Wallet className="w-8 h-8 text-blue-700 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-700">{connectedWallets.length}</div>
              <div className="text-gray-700 font-medium">Connected Wallets</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-2 border-green-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <Coins className="w-8 h-8 text-green-700 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-700">${totalValue.toLocaleString()}</div>
              <div className="text-gray-700 font-medium">Total Value</div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 border-2 border-purple-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <Image className="w-8 h-8 text-purple-700 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-700">{assets.filter(a => a.type === 'nft').length}</div>
              <div className="text-gray-700 font-medium">NFTs Owned</div>
            </CardContent>
          </Card>
          
          <Card className="bg-orange-50 border-2 border-orange-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <Gift className="w-8 h-8 text-orange-700 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-700">{rewards.filter(r => r.isClaimable).length}</div>
              <div className="text-gray-700 font-medium">Pending Rewards</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="wallets" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-gray-100 border-2 border-gray-200">
            <TabsTrigger value="wallets" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-medium">
              Wallets
            </TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 font-medium">
              Assets
            </TabsTrigger>
            <TabsTrigger value="nfts" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 font-medium">
              NFTs
            </TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 font-medium">
              Rewards
            </TabsTrigger>
          </TabsList>

          {/* Wallets Tab */}
          <TabsContent value="wallets">
            <Card className="bg-blue-50 border-2 border-blue-200 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl text-blue-700 font-bold">Connected Wallets</CardTitle>
                    <CardDescription className="text-gray-700 font-medium">
                      Manage your multi-chain wallet connections
                    </CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700 font-bold">
                        <Plus className="w-4 h-4 mr-2" />
                        Connect Wallet
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900 font-bold">Connect New Wallet</DialogTitle>
                        <DialogDescription className="text-gray-700 font-medium">
                          Choose a blockchain and wallet type to connect
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <Button className="bg-blue-600 hover:bg-blue-700 font-bold">XRPL - Xaman</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700 font-bold">Ethereum - MetaMask</Button>
                        <Button className="bg-green-600 hover:bg-green-700 font-bold">Polygon - MetaMask</Button>
                        <Button className="bg-orange-600 hover:bg-orange-700 font-bold">Solana - Phantom</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connectedWallets.map((wallet) => (
                    <Card key={wallet.id} className="bg-white border-2 border-gray-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Wallet className="w-6 h-6 text-blue-700" />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{wallet.chain}</div>
                              <div className="text-sm text-gray-600 font-medium">{wallet.type}</div>
                              <div className="text-xs text-gray-500 font-mono">
                                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{wallet.balance}</div>
                            <Badge className="bg-green-100 text-green-700 border border-green-300 font-medium">
                              Connected
                            </Badge>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 font-medium">
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 font-medium">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets">
            <Card className="bg-green-50 border-2 border-green-200 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl text-green-700 font-bold">Token Assets</CardTitle>
                    <CardDescription className="text-gray-700 font-medium">
                      View and manage your token holdings across all chains
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-300 rounded-md bg-white text-gray-700 font-medium"
                    >
                      <option value="all">All Chains</option>
                      <option value="xrpl">XRPL</option>
                      <option value="ethereum">Ethereum</option>
                      <option value="polygon">Polygon</option>
                      <option value="solana">Solana</option>
                    </select>
                    <Button onClick={handleRefreshAssets} className="bg-green-600 hover:bg-green-700 font-bold">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredAssets.filter(asset => asset.type === 'token').map((asset) => (
                    <Card key={asset.id} className="bg-white border-2 border-gray-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
                              {asset.image}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{asset.name}</div>
                              <div className="text-sm text-gray-600 font-medium">{asset.symbol}</div>
                              <Badge className="bg-gray-100 text-gray-700 border border-gray-300 text-xs font-medium">
                                {asset.chain}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{asset.balance} {asset.symbol}</div>
                            <div className="text-sm text-green-600 font-bold">{asset.value}</div>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 mt-2 font-medium">
                              Trade
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NFTs Tab */}
          <TabsContent value="nfts">
            <Card className="bg-purple-50 border-2 border-purple-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-purple-700 font-bold">NFT Collection</CardTitle>
                <CardDescription className="text-gray-700 font-medium">
                  Browse and manage your NFT collection across all chains
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assets.filter(asset => asset.type === 'nft').map((nft) => (
                    <Card key={nft.id} className="bg-white border-2 border-gray-200 shadow-sm hover:scale-105 transition-transform">
                      <CardContent className="p-4">
                        <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg mb-4 flex items-center justify-center text-6xl border border-purple-200">
                          {nft.image}
                        </div>
                        <div className="space-y-2">
                          <div className="font-bold text-gray-900">{nft.name}</div>
                          <Badge className="bg-gray-100 text-gray-700 border border-gray-300 text-xs font-medium">
                            {nft.chain}
                          </Badge>
                          <div className="text-sm text-purple-600 font-bold">{nft.value}</div>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 font-medium">
                              View Details
                            </Button>
                            <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 font-medium">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards">
            <Card className="bg-orange-50 border-2 border-orange-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-orange-700 font-bold">Rewards Center</CardTitle>
                <CardDescription className="text-gray-700 font-medium">
                  Claim your rewards and track your progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rewards.map((reward) => (
                    <Card key={reward.id} className="bg-white border-2 border-gray-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                              {reward.type === 'Daily Login' && <Clock className="w-6 h-6 text-orange-700" />}
                              {reward.type === 'Swap Bonus' && <TrendingUp className="w-6 h-6 text-orange-700" />}
                              {reward.type === 'Collection Milestone' && <Trophy className="w-6 h-6 text-orange-700" />}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{reward.type}</div>
                              <div className="text-sm text-gray-600 font-medium">{reward.description}</div>
                              {reward.progress && (
                                <div className="text-xs text-gray-500">Progress: {reward.progress}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-orange-700 text-lg">{reward.amount}</div>
                            {reward.expiresIn && (
                              <div className="text-xs text-gray-500">Expires: {reward.expiresIn}</div>
                            )}
                            <Button 
                              size="sm" 
                              className={`mt-2 font-bold ${
                                reward.isClaimable 
                                  ? 'bg-orange-600 hover:bg-orange-700' 
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              disabled={!reward.isClaimable}
                              onClick={() => handleClaimReward(reward.id)}
                            >
                              {reward.isClaimable ? 'Claim' : 'Claimed'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
    </div>
  );
}
