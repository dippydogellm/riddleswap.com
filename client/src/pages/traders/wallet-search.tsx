import React, { useState, useCallback } from 'react';
import { Search, Wallet, ExternalLink, DollarSign, Coins, Copy, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface WalletData {
  address: string;
  chain: string;
  balance: string;
  usdValue: string;
  tokens: Array<{
    symbol: string;
    balance: string;
    usdValue: string;
    price: string;
  }>;
  nfts: Array<{
    id: string;
    name: string;
    collection: string;
    image?: string;
  }>;
  recentTxs: number;
  lastActivity: string;
}

export default function WalletSearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<WalletData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const { toast } = useToast();

  // Chain configurations
  const supportedChains = [
    { name: 'XRPL', color: 'bg-black' },
    { name: 'Ethereum', color: 'bg-blue-600' },
    { name: 'Solana', color: 'bg-purple-600' },
    { name: 'Bitcoin', color: 'bg-orange-500' },
    { name: 'BSC', color: 'bg-yellow-500' },
    { name: 'Polygon', color: 'bg-purple-500' },
    { name: 'Base', color: 'bg-blue-500' },
    { name: 'Arbitrum', color: 'bg-blue-400' }
  ];

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Empty Search",
        description: "Please enter a wallet address to search",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      // Search across all supported chains
      const results: WalletData[] = [];
      
      for (const chain of supportedChains) {
        try {
          let endpoint = '';
          
          switch (chain.name) {
            case 'XRPL':
              endpoint = `/xrp/balance/${searchTerm}`;
              break;
            case 'Ethereum':
            case 'BSC':
            case 'Polygon':
            case 'Base':
            case 'Arbitrum':
              endpoint = `/eth/balance/${searchTerm}`;
              break;
            case 'Solana':
              endpoint = `/sol/balance/${searchTerm}`;
              break;
            case 'Bitcoin':
              endpoint = `/btc/balance/${searchTerm}`;
              break;
          }

          if (endpoint) {
            const response = await fetch(endpoint);
            if (response.ok) {
              const data = await response.json() as any;
              if (data.success && data.data) {
                results.push({
                  ...data.data,
                  chain: chain.name,
                  recentTxs: data.data.totalTxs || 0,
                  lastActivity: new Date().toISOString()
                });
              }
            }
          }
        } catch (error) {
          console.log(`Error searching ${chain.name}:`, error);
        }
      }

      setSearchResults(results);
      
      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "No wallet data found for this address across supported chains",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Search Complete",
          description: `Found wallet data on ${results.length} chain(s)`
        });
      }
      
    } catch (error) {
      toast({
        title: "Search Error",
        description: "Failed to search wallet data",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance || '0');
    if (num === 0) return '0';
    if (num < 0.001) return '< 0.001';
    if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(6);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Wallet Search</h1>
            <p className="text-muted-foreground">Search any wallet address across all supported blockchains</p>
          </div>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter wallet address (XRPL, Ethereum, Solana, Bitcoin, etc.)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching}
                className="min-w-[120px]"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search All Chains
                  </>
                )}
              </Button>
            </div>

            {/* Supported Chains */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Supported chains:</p>
              <div className="flex flex-wrap gap-2">
                {supportedChains.map((chain) => (
                  <Badge key={chain.name} className={`${chain.color} text-white`}>
                    {chain.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Search Results</h2>
          
          <div className="grid gap-6">
            {searchResults.map((wallet, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        supportedChains.find(c => c.name === wallet.chain)?.color || 'bg-gray-500'
                      }`}>
                        <Wallet className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{wallet.chain} Wallet</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{formatAddress(wallet.address)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(wallet.address)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWallet(wallet)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Balance</p>
                      <p className="font-semibold">{formatBalance(wallet.balance)} {wallet.chain === 'XRPL' ? 'XRP' : wallet.chain === 'Ethereum' ? 'ETH' : wallet.chain === 'Solana' ? 'SOL' : wallet.chain === 'Bitcoin' ? 'BTC' : 'Native'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">USD Value</p>
                      <p className="font-semibold text-green-600">${parseFloat(wallet.usdValue || '0').toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tokens</p>
                      <p className="font-semibold">{wallet.tokens?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">NFTs</p>
                      <p className="font-semibold">{wallet.nfts?.length || 0}</p>
                    </div>
                  </div>

                  {/* Quick Trade Button */}
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      className="w-full"
                      onClick={() => {
                        const swapPath = wallet.chain === 'XRPL' ? '/xrpl-swap' :
                                       wallet.chain === 'Solana' ? '/solana-swap' :
                                       '/evm-swap';
                        window.location.href = swapPath;
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Quick Trade on {wallet.chain}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Wallet View Modal-like section */}
      {selectedWallet && (
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detailed View - {selectedWallet.chain} Wallet</CardTitle>
              <Button variant="outline" onClick={() => setSelectedWallet(null)}>
                Close Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tokens">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tokens">Tokens ({selectedWallet.tokens?.length || 0})</TabsTrigger>
                <TabsTrigger value="nfts">NFTs ({selectedWallet.nfts?.length || 0})</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tokens" className="space-y-4">
                {selectedWallet.tokens?.length > 0 ? (
                  selectedWallet.tokens.map((token, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-sm text-muted-foreground">{formatBalance(token.balance)} tokens</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${parseFloat(token.usdValue || '0').toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">${parseFloat(token.price || '0').toFixed(6)}/token</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">No tokens found</p>
                )}
              </TabsContent>
              
              <TabsContent value="nfts" className="space-y-4">
                {selectedWallet.nfts?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedWallet.nfts.map((nft, index) => (
                      <div key={index} className="p-4 bg-muted rounded-lg">
                        {nft.image && (
                          <img src={nft.image} alt={nft.name} className="w-full h-32 object-cover rounded mb-2" />
                        )}
                        <p className="font-semibold">{nft.name}</p>
                        <p className="text-sm text-muted-foreground">{nft.collection}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No NFTs found</p>
                )}
              </TabsContent>
              
              <TabsContent value="activity">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Transaction history coming soon</p>
                  <p className="text-sm text-muted-foreground mt-2">Recent transactions: {selectedWallet.recentTxs}</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
