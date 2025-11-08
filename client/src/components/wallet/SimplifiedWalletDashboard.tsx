/**
 * Simplified Wallet Dashboard
 * Clean, mobile-first design with chain tabs and total portfolio view
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Send, 
  Download, 
  ShoppingBag,
  RefreshCw,
  Shield,
  Upload,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Copy,
  ExternalLink,
  Wallet,
  Image as ImageIcon,
  Coins
} from 'lucide-react';
import { fetchChainBalance } from '@/lib/balance-fetcher';
import { ChainLogo } from '@/components/ChainLogo';
import { useToast } from '@/hooks/use-toast';

interface SimplifiedWalletDashboardProps {
  wallets: {
    xrp?: string;
    eth?: string;
    sol?: string;
    btc?: string;
  };
  onSend?: () => void;
  onReceive?: () => void;
  onBuy?: () => void;
  onImport?: () => void;
  onRefresh?: () => void;
  onSecurity?: () => void;
}

interface TokenData {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  icon?: string;
}

const CHAIN_CONFIGS = {
  xrp: {
    name: 'XRPL',
    fullName: 'XRP Ledger',
    symbol: 'XRP',
    color: 'bg-blue-500',
    icon: '/images/chains/xrp-logo.png',
    route: '/xrp-wallet-redesigned'
  },
  eth: {
    name: 'ETH',
    fullName: 'Ethereum',
    symbol: 'ETH',
    color: 'bg-green-500',
    icon: '/images/chains/ethereum-logo.png',
    route: '/eth-wallet'
  },
  sol: {
    name: 'SOL',
    fullName: 'Solana',
    symbol: 'SOL',
    color: 'bg-purple-500',
    icon: '/images/chains/solana-logo.png',
    route: '/sol-wallet'
  },
  btc: {
    name: 'BTC',
    fullName: 'Bitcoin',
    symbol: 'BTC',
    color: 'bg-orange-500',
    icon: '/images/chains/bitcoin-logo.png',
    route: '/btc-wallet'
  },
  arbitrum: {
    name: 'ARB',
    fullName: 'Arbitrum One',
    symbol: 'ETH',
    color: 'bg-blue-600',
    icon: '/images/chains/arbitrum-logo.png',
    route: '/arbitrum-wallet'
  },
  optimism: {
    name: 'OP',
    fullName: 'Optimism',
    symbol: 'ETH',
    color: 'bg-red-500',
    icon: '/images/chains/optimism-logo.png',
    route: '/optimism-wallet'
  },
  base: {
    name: 'BASE',
    fullName: 'Base',
    symbol: 'ETH',
    color: 'bg-blue-600',
    icon: '/images/chains/base-logo.png',
    route: '/base-wallet'
  },
  polygon: {
    name: 'MATIC',
    fullName: 'Polygon',
    symbol: 'MATIC',
    color: 'bg-purple-600',
    icon: '/images/chains/polygon-logo.png',
    route: '/polygon-wallet'
  },
  zksync: {
    name: 'ZK',
    fullName: 'zkSync Era',
    symbol: 'ETH',
    color: 'bg-gray-700',
    icon: '/images/chains/zksync-logo.png',
    route: '/zksync-wallet'
  },
  linea: {
    name: 'LINEA',
    fullName: 'Linea',
    symbol: 'ETH',
    color: 'bg-black',
    icon: '/images/chains/linea-logo.png',
    route: '/linea-wallet'
  },
  taiko: {
    name: 'TAIKO',
    fullName: 'Taiko',
    symbol: 'ETH',
    color: 'bg-pink-600',
    icon: '/images/chains/taiko-logo.png',
    route: '/taiko-wallet'
  },
  unichain: {
    name: 'UNI',
    fullName: 'Unichain',
    symbol: 'ETH',
    color: 'bg-pink-500',
    icon: '/images/chains/unichain-logo.png',
    route: '/unichain-wallet'
  },
  soneium: {
    name: 'SON',
    fullName: 'Soneium',
    symbol: 'ETH',
    color: 'bg-blue-500',
    icon: '/images/chains/soneium-logo.png',
    route: '/soneium-wallet'
  },
  mantle: {
    name: 'MNT',
    fullName: 'Mantle Network',
    symbol: 'MNT',
    color: 'bg-green-600',
    icon: '/images/chains/mantle-logo.png',
    route: '/mantle-wallet'
  },
  metis: {
    name: 'METIS',
    fullName: 'Metis Andromeda',
    symbol: 'METIS',
    color: 'bg-cyan-500',
    icon: '/images/chains/metis-logo.png',
    route: '/metis-wallet'
  },
  scroll: {
    name: 'SCROLL',
    fullName: 'Scroll',
    symbol: 'ETH',
    color: 'bg-orange-600',
    icon: '/images/chains/scroll-logo.png',
    route: '/scroll-wallet'
  },
  bnb: {
    name: 'BNB',
    fullName: 'BNB Smart Chain',
    symbol: 'BNB',
    color: 'bg-yellow-500',
    icon: '/images/chains/bnb-logo.png',
    route: '/bnb-wallet'
  },
  avax: {
    name: 'AVAX',
    fullName: 'Avalanche C-Chain',
    symbol: 'AVAX',
    color: 'bg-red-500',
    icon: '/images/chains/avalanche-logo.png',
    route: '/avax-wallet'
  }
};

// Token List Card Component
function TokenListCard({ chainConfig, chainData, onViewDetails }: {
  chainConfig: typeof CHAIN_CONFIGS[keyof typeof CHAIN_CONFIGS];
  chainData: { balance: string; usdValue: string; address: string };
  onViewDetails?: () => void;
}) {
  const balanceNum = parseFloat(chainData.balance);
  const hasBalance = balanceNum > 0;

  return (
    <Card className="bg-gray-800/30 border-gray-700 hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={onViewDetails}>
      <CardContent className="p-4">
        {/* Native Token */}
        <div className="flex items-center justify-between py-4 border-b border-gray-700 last:border-0">
          <div className="flex items-center gap-3">
            <img 
              src={chainConfig.icon} 
              alt={chainConfig.symbol}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <div className="font-semibold">{chainConfig.symbol}</div>
              <div className="text-sm text-gray-400">
                {balanceNum.toFixed(4)} {chainConfig.symbol}
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <div>
              <div className="font-semibold">
                ${parseFloat(chainData.usdValue).toFixed(2)}
              </div>
              <div className="text-sm text-green-400">+0.16%</div>
            </div>
            <ChevronDown className="w-5 h-5 text-orange-500" />
          </div>
        </div>

        {/* Empty state */}
        {!hasBalance && (
          <div className="text-center py-8 text-gray-500">
            <p>No balance on {chainConfig.fullName}</p>
            <p className="text-sm mt-2">Get started by receiving {chainConfig.symbol}</p>
          </div>
        )}
        
        {/* View details hint */}
        {hasBalance && (
          <div className="text-center pt-3 text-sm text-orange-400">
            Tap to view full wallet details →
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SimplifiedWalletDashboard({
  wallets,
  onSend,
  onReceive,
  onBuy,
  onImport,
  onRefresh,
  onSecurity
}: SimplifiedWalletDashboardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedChain, setSelectedChain] = useState<'xrp' | 'eth' | 'sol' | 'btc'>('xrp');
  const [portfolioChange, setPortfolioChange] = useState({ value: 209.65, percent: 36.24 });
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [detailsChain, setDetailsChain] = useState<'xrp' | 'eth' | 'sol' | 'btc'>('xrp');

  // Fetch balances for all chains
  const { data: xrpBalance, refetch: refetchXrp } = useQuery({
    queryKey: ['balance', 'xrp', wallets.xrp],
    queryFn: () => fetchChainBalance('xrp', wallets.xrp || ''),
    enabled: !!wallets.xrp
  });

  const { data: ethBalance, refetch: refetchEth } = useQuery({
    queryKey: ['balance', 'eth', wallets.eth],
    queryFn: () => fetchChainBalance('eth', wallets.eth || ''),
    enabled: !!wallets.eth
  });

  const { data: solBalance, refetch: refetchSol } = useQuery({
    queryKey: ['balance', 'sol', wallets.sol],
    queryFn: () => fetchChainBalance('sol', wallets.sol || ''),
    enabled: !!wallets.sol
  });

  const { data: btcBalance, refetch: refetchBtc } = useQuery({
    queryKey: ['balance', 'btc', wallets.btc],
    queryFn: () => fetchChainBalance('btc', wallets.btc || ''),
    enabled: !!wallets.btc
  });

  // Calculate total portfolio value
  const totalPortfolioUSD = (
    parseFloat(xrpBalance?.usdValue || '0') +
    parseFloat(ethBalance?.usdValue || '0') +
    parseFloat(solBalance?.usdValue || '0') +
    parseFloat(btcBalance?.usdValue || '0')
  );

  // Get chain data by chain ID
  const getChainData = (chain: 'xrp' | 'eth' | 'sol' | 'btc') => {
    switch (chain) {
      case 'xrp':
        return {
          balance: xrpBalance?.balance || '0',
          usdValue: xrpBalance?.usdValue || '0',
          address: wallets.xrp || ''
        };
      case 'eth':
        return {
          balance: ethBalance?.balance || '0',
          usdValue: ethBalance?.usdValue || '0',
          address: wallets.eth || ''
        };
      case 'sol':
        return {
          balance: solBalance?.balance || '0',
          usdValue: solBalance?.usdValue || '0',
          address: wallets.sol || ''
        };
      case 'btc':
        return {
          balance: btcBalance?.balance || '0',
          usdValue: btcBalance?.usdValue || '0',
          address: wallets.btc || ''
        };
    }
  };

  const handleRefreshAll = () => {
    refetchXrp();
    refetchEth();
    refetchSol();
    refetchBtc();
    onRefresh?.();
    toast({
      title: 'Refreshing',
      description: 'Updating all wallet balances...'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header - Total Portfolio */}
        <div className="text-center mb-8">
          <div className="text-5xl font-bold mb-2">
            ${totalPortfolioUSD.toFixed(2)}
          </div>
          <div className={`inline-flex items-center gap-1 text-lg ${
            portfolioChange.value >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {portfolioChange.value >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span>
              {portfolioChange.value >= 0 ? '+' : ''}${portfolioChange.value.toFixed(2)} ({portfolioChange.percent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Button
            onClick={onSend}
            className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 h-24 flex-col gap-2"
          >
            <Send className="w-6 h-6" />
            <span className="text-sm">Send</span>
          </Button>
          <Button
            onClick={onReceive}
            className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 h-24 flex-col gap-2"
          >
            <Download className="w-6 h-6" />
            <span className="text-sm">Receive</span>
          </Button>
          <Button
            onClick={onBuy}
            className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 h-24 flex-col gap-2"
          >
            <ShoppingBag className="w-6 h-6" />
            <span className="text-sm">Buy</span>
          </Button>
        </div>

        {/* Additional Actions Row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Button
            onClick={onImport}
            variant="outline"
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 h-16 flex-col gap-1"
          >
            <Upload className="w-5 h-5" />
            <span className="text-xs">Import</span>
          </Button>
          <Button
            onClick={handleRefreshAll}
            variant="outline"
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 h-16 flex-col gap-1"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-xs">Refresh</span>
          </Button>
          <Button
            onClick={onSecurity}
            variant="outline"
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 h-16 flex-col gap-1"
          >
            <Shield className="w-5 h-5" />
            <span className="text-xs">Security</span>
          </Button>
        </div>

        {/* All Supported Chains - Quick Access Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            All Supported Chains ({Object.keys(CHAIN_CONFIGS).length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(CHAIN_CONFIGS).map(([chainId, config]) => (
              <button
                key={chainId}
                onClick={() => setLocation(config.route)}
                className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-orange-500/50 rounded-lg p-4 flex flex-col items-center gap-2 transition-all cursor-pointer group"
              >
                <img 
                  src={config.icon} 
                  alt={config.name}
                  className="w-10 h-10 rounded-full group-hover:scale-110 transition-transform"
                />
                <span className="text-sm font-semibold">{config.name}</span>
                <span className="text-xs text-gray-400">{config.fullName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chain Tabs */}
        <Tabs value={selectedChain} onValueChange={(v) => setSelectedChain(v as any)} className="mb-6">
          <TabsList className="grid w-full grid-cols-4 h-auto bg-gray-800/50 p-1">
            <TabsTrigger 
              value="xrp" 
              className="data-[state=active]:bg-blue-600 h-12 flex-col gap-1"
            >
              <img src={CHAIN_CONFIGS.xrp.icon} alt="XRP" className="w-5 h-5" />
              <span className="text-xs">{CHAIN_CONFIGS.xrp.name}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="eth" 
              className="data-[state=active]:bg-green-600 h-12 flex-col gap-1"
            >
              <img src={CHAIN_CONFIGS.eth.icon} alt="ETH" className="w-5 h-5" />
              <span className="text-xs">{CHAIN_CONFIGS.eth.name}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sol" 
              className="data-[state=active]:bg-purple-600 h-12 flex-col gap-1"
            >
              <img src={CHAIN_CONFIGS.sol.icon} alt="SOL" className="w-5 h-5" />
              <span className="text-xs">{CHAIN_CONFIGS.sol.name}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="btc" 
              className="data-[state=active]:bg-orange-600 h-12 flex-col gap-1"
            >
              <img src={CHAIN_CONFIGS.btc.icon} alt="BTC" className="w-5 h-5" />
              <span className="text-xs">{CHAIN_CONFIGS.btc.name}</span>
            </TabsTrigger>
          </TabsList>

          {/* Token Lists per Chain */}
          <TabsContent value="xrp" className="mt-6">
            <TokenListCard 
              chainConfig={CHAIN_CONFIGS.xrp}
              chainData={getChainData('xrp')}
              onViewDetails={() => {
                setDetailsChain('xrp');
                setShowWalletDetails(true);
              }}
            />
          </TabsContent>

          <TabsContent value="eth" className="mt-6">
            <TokenListCard 
              chainConfig={CHAIN_CONFIGS.eth}
              chainData={getChainData('eth')}
              onViewDetails={() => {
                setDetailsChain('eth');
                setShowWalletDetails(true);
              }}
            />
          </TabsContent>

          <TabsContent value="sol" className="mt-6">
            <TokenListCard 
              chainConfig={CHAIN_CONFIGS.sol}
              chainData={getChainData('sol')}
              onViewDetails={() => {
                setDetailsChain('sol');
                setShowWalletDetails(true);
              }}
            />
          </TabsContent>

          <TabsContent value="btc" className="mt-6">
            <TokenListCard 
              chainConfig={CHAIN_CONFIGS.btc}
              chainData={getChainData('btc')}
              onViewDetails={() => {
                setDetailsChain('btc');
                setShowWalletDetails(true);
              }}
            />
          </TabsContent>
        </Tabs>

        {/* NFT Gallery Section */}
        <div className="mt-8 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Multi-Chain NFT Gallery
          </h2>
          <Card className="bg-gray-800/30 border-gray-700">
            <CardContent className="p-6">
              <div className="text-center py-12 text-gray-400">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-3 font-semibold">Aggregated NFT Display</p>
                <p className="text-sm mb-4 max-w-md mx-auto">
                  Multi-chain NFT aggregation requires integrating separate APIs for each blockchain (XRPL, EVM chains, Solana). 
                  This feature is planned for future implementation.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Button 
                    onClick={() => setLocation('/inquisition-profile')}
                    className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    View XRPL Inquisition NFTs
                  </Button>
                  <Button 
                    onClick={() => setLocation('/nft-wallet')}
                    variant="outline"
                    className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                  >
                    NFT Marketplace
                  </Button>
                </div>
                <p className="text-xs mt-4 text-gray-500">
                  Currently available: XRPL NFTs via Inquisition profile • NFT trading on marketplace
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comprehensive Token List Section */}
        <div className="mt-8 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5" />
            All Tokens ({Object.keys(CHAIN_CONFIGS).length} Chains)
          </h2>
          <Card className="bg-gray-800/30 border-gray-700">
            <CardContent className="p-6">
              <div className="space-y-3">
                {/* Primary Tokens (XRP, ETH, SOL, BTC) */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Primary Assets</h3>
                  <div className="space-y-2">
                    {['xrp', 'eth', 'sol', 'btc'].map((chainId) => {
                      const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
                      const data = getChainData(chainId as any);
                      const balance = parseFloat(data.balance);
                      const usdValue = parseFloat(data.usdValue);
                      
                      return (
                        <div 
                          key={chainId}
                          onClick={() => setLocation(config.route)}
                          className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-700 hover:border-orange-500/50 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <img src={config.icon} alt={config.symbol} className="w-10 h-10 rounded-full" />
                            <div>
                              <div className="font-semibold">{config.symbol}</div>
                              <div className="text-sm text-gray-400">{balance.toFixed(6)} {config.symbol}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${usdValue.toFixed(2)}</div>
                            <div className="text-xs text-green-400">+0.00%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* EVM Chain Tokens */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">EVM Chains (14 Networks)</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Click any chain to view detailed balances and tokens on its dedicated wallet page
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(CHAIN_CONFIGS)
                      .filter(([id]) => !['xrp', 'sol', 'btc', 'eth'].includes(id))
                      .map(([chainId, config]) => (
                        <div 
                          key={chainId}
                          onClick={() => setLocation(config.route)}
                          className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-700 hover:border-orange-500/50 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <img src={config.icon} alt={config.symbol} className="w-8 h-8 rounded-full" />
                            <div>
                              <div className="text-sm font-semibold">{config.name}</div>
                              <div className="text-xs text-gray-400">{config.fullName}</div>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Wallet Details Dialog */}
      <Dialog open={showWalletDetails} onOpenChange={setShowWalletDetails}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <img 
                src={CHAIN_CONFIGS[detailsChain].icon} 
                alt={CHAIN_CONFIGS[detailsChain].name}
                className="w-8 h-8 rounded-full"
              />
              {CHAIN_CONFIGS[detailsChain].fullName} Wallet
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Complete wallet information and details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 border border-orange-600/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Balance</p>
              <p className="text-3xl font-bold">{parseFloat(getChainData(detailsChain).balance).toFixed(4)} {CHAIN_CONFIGS[detailsChain].symbol}</p>
              <p className="text-lg text-gray-300 mt-1">${parseFloat(getChainData(detailsChain).usdValue).toFixed(2)} USD</p>
            </div>

            {/* Wallet Address */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Wallet Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-900 p-2 rounded break-all">
                  {getChainData(detailsChain).address || 'Not connected'}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 bg-gray-800 border-gray-700 hover:bg-gray-700"
                  onClick={() => {
                    navigator.clipboard.writeText(getChainData(detailsChain).address);
                    toast({
                      title: "Address Copied!",
                      description: `${CHAIN_CONFIGS[detailsChain].name} address copied to clipboard`,
                    });
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chain Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Network</p>
                <p className="font-semibold">{CHAIN_CONFIGS[detailsChain].fullName}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Symbol</p>
                <p className="font-semibold">{CHAIN_CONFIGS[detailsChain].symbol}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                onClick={() => {
                  // Use the route from chain config instead of hardcoded routes
                  setLocation(CHAIN_CONFIGS[detailsChain].route);
                  setShowWalletDetails(false);
                }}
                className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Full Wallet
              </Button>
              <Button
                onClick={() => setShowWalletDetails(false)}
                variant="outline"
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
