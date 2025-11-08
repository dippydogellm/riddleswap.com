import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wallet, Coins, Image, TrendingUp, Eye, Clock, History } from "lucide-react";
import { TransactionHistory } from "@/components/transaction-history";

interface TokenData {
  currency: string;
  currencyCode: string;
  issuer: string;
  balance: string;
  name: string;
  logo: string;
  price_usd: number;
  usd_value: string;
}

interface NFTData {
  NFTokenID: string;
  name: string;
  description: string;
  imageUrl: string;
  collection: string;
  rarity: string;
  floor_price: string;
  last_sale_price: string;
  traits: any[];
  owner: string;
  issuer: string;
}

interface WalletDetails {
  xrp: {
    address: string;
    balance: string;
    usdValue: string;
    totalTokens: number;
    totalNFTs: number;
    tokens: TokenData[];
    nfts: NFTData[];
    marketplaceData: {
      offersReceived: number;
      offersMade: number;
      incomingTransfers: number;
      outgoingTransfers: number;
      listedItems: number;
      auctions: number;
    };
  };
  ethereum: {
    address: string;
    balance: string;
    usdValue: string;
    tokens: any[];
    nfts: any[];
  };
  solana: {
    address: string;
    balance: string;
    usdValue: string;
    tokens: any[];
    nfts: any[];
  };
  bitcoin: {
    address: string;
    balance: string;
    usdValue: string;
    transactions: number;
  };
}

export default function WalletDetails() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [walletData, setWalletData] = useState<WalletDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    if (!sessionData) {
      setLocation('/wallet-login');
      return;
    }

    try {
      const session = JSON.parse(sessionData);
      setCurrentUser(session.handle);
    } catch (error) {
      setLocation('/wallet-login');
    }
  }, [setLocation]);

  // Load comprehensive wallet data
  useEffect(() => {
    if (!currentUser) return;

    const loadWalletData = async () => {
      try {
        setIsLoading(true);
        const sessionData = sessionStorage.getItem('riddle_wallet_session');
        if (!sessionData) return;

        const session = JSON.parse(sessionData);
        const sessionToken = session.sessionToken;

        // Fetch comprehensive portfolio data
        const [xrpResponse, ethResponse, solResponse, btcResponse] = await Promise.all([
          fetch('/api/xrpl/wallet/nfts', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }),
          fetch('/api/ethereum/wallet/tokens', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }),
          fetch('/api/solana/wallet/tokens', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }),
          fetch('/api/bitcoin/wallet/balance', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          })
        ]);

        const [xrpData, ethData, solData, btcData] = await Promise.all([
          xrpResponse.json(),
          ethResponse.json(),
          solResponse.json(),
          btcResponse.json()
        ]);

        setWalletData({
          xrp: xrpData.data || {},
          ethereum: ethData.data || {},
          solana: solData.data || {},
          bitcoin: btcData.data || {}
        });

      } catch (error) {
        console.error('Failed to load wallet data:', error);
        toast({
          title: "Error",
          description: "Failed to load wallet data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadWalletData();
  }, [currentUser, toast]);

  const formatCurrency = (amount: string | number, currency = 'USD') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6
    }).format(num);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Authentication Required</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Please sign in to view wallet details</p>
          <Button onClick={() => setLocation('/wallet-login')}>
            Sign In to Riddle Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalUSDValue = walletData ? (
    parseFloat(walletData.xrp?.usdValue || '0') +
    parseFloat(walletData.ethereum?.usdValue || '0') +
    parseFloat(walletData.solana?.usdValue || '0') +
    parseFloat(walletData.bitcoin?.usdValue || '0')
  ) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation('/profile')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Wallet Details</h1>
              <p className="text-gray-600 dark:text-gray-300">Complete overview of your cryptocurrency holdings</p>
            </div>
          </div>
        </div>

        {/* Total Portfolio Value */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Total Portfolio Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalUSDValue)}
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Across all blockchains</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="xrp" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="xrp">XRPL</TabsTrigger>
            <TabsTrigger value="ethereum">Ethereum</TabsTrigger>
            <TabsTrigger value="solana">Solana</TabsTrigger>
            <TabsTrigger value="bitcoin">Bitcoin</TabsTrigger>
          </TabsList>

          {/* XRPL Wallet Details */}
          <TabsContent value="xrp" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* XRP Balance */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    XRP Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.xrp?.balance || '0.000000'}</div>
                  <p className="text-xs text-gray-600">{formatCurrency(parseFloat(walletData?.xrp?.usdValue || '0'))}</p>
                  <p className="text-xs text-gray-500 mt-1">{walletData?.xrp?.address}</p>
                </CardContent>
              </Card>

              {/* Token Count */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.xrp?.totalTokens || 0}</div>
                  <p className="text-xs text-gray-600">Token holdings</p>
                </CardContent>
              </Card>

              {/* NFT Count */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    NFTs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.xrp?.totalNFTs || 0}</div>
                  <p className="text-xs text-gray-600">NFT collection</p>
                </CardContent>
              </Card>
            </div>

            {/* Marketplace Activity */}
            {walletData?.xrp?.marketplaceData && (
              <Card>
                <CardHeader>
                  <CardTitle>Marketplace Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold">{walletData.xrp.marketplaceData.offersReceived}</div>
                      <div className="text-sm text-gray-600">Offers Received</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{walletData.xrp.marketplaceData.offersMade}</div>
                      <div className="text-sm text-gray-600">Offers Made</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{walletData.xrp.marketplaceData.incomingTransfers}</div>
                      <div className="text-sm text-gray-600">Incoming</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{walletData.xrp.marketplaceData.outgoingTransfers}</div>
                      <div className="text-sm text-gray-600">Outgoing</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{walletData.xrp.marketplaceData.listedItems}</div>
                      <div className="text-sm text-gray-600">Listed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{walletData.xrp.marketplaceData.auctions}</div>
                      <div className="text-sm text-gray-600">Auctions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* XRPL Tokens */}
            {walletData?.xrp?.tokens && walletData.xrp.tokens.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>XRPL Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {walletData.xrp.tokens.map((token, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {token.logo && (
                            <img 
                              src={token.logo} 
                              alt={token.name}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <div>
                            <div className="font-medium">{token.name}</div>
                            <div className="text-sm text-gray-600">{token.currency}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(parseFloat(token.balance))}</div>
                          <div className="text-sm text-gray-600">{formatCurrency(parseFloat(token.usd_value))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* XRPL Transaction History */}
            {walletData?.xrp?.address && (
              <TransactionHistory
                address={walletData.xrp.address}
                chainType="xrp"
                explorerUrl="https://livenet.xrpl.org/transactions/"
              />
            )}

            {/* XRPL NFTs */}
            {walletData?.xrp?.nfts && walletData.xrp.nfts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>XRPL NFTs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {walletData.xrp.nfts.map((nft, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow dark:border-gray-700 dark:bg-gray-800">
                        {nft.imageUrl ? (
                          <img 
                            src={nft.imageUrl}
                            alt={nft.name}
                            className="w-full h-48 object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                        ) : (
                          <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">No Image</span>
                          </div>
                        )}
                        <div className="p-4">
                          <div className="font-bold text-lg truncate text-gray-900 dark:text-gray-100">{nft.name}</div>
                          {nft.collection && (
                            <Badge variant="secondary" className="mt-1 text-xs dark:bg-gray-700 dark:text-gray-200">
                              {nft.collection}
                            </Badge>
                          )}
                          {nft.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                              {nft.description}
                            </p>
                          )}
                          {nft.rarity && (
                            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-2">
                              Rarity: {nft.rarity}
                            </div>
                          )}
                          {(nft.floor_price || nft.last_sale_price) && (
                            <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">
                              {nft.floor_price && (
                                <span>Floor: {nft.floor_price} XRP</span>
                              )}
                              {nft.last_sale_price && (
                                <span>Last: {nft.last_sale_price} XRP</span>
                              )}
                            </div>
                          )}
                          <Button 
                            size="sm" 
                            className="w-full mt-3"
                            onClick={() => setLocation(`/nft/${nft.NFTokenID}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Ethereum Wallet Details */}
          <TabsContent value="ethereum" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    ETH Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.ethereum?.balance || '0.000000'}</div>
                  <p className="text-xs text-gray-600">{formatCurrency(parseFloat(walletData?.ethereum?.usdValue || '0'))}</p>
                  <p className="text-xs text-gray-500 mt-1">{walletData?.ethereum?.address}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    ERC-20 Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.ethereum?.tokens?.length || 0}</div>
                  <p className="text-xs text-gray-600">Token holdings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    ERC-721 NFTs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.ethereum?.nfts?.length || 0}</div>
                  <p className="text-xs text-gray-600">NFT collection</p>
                </CardContent>
              </Card>
            </div>

            {walletData?.ethereum?.tokens && walletData.ethereum.tokens.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>ERC-20 Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {walletData.ethereum.tokens.map((token: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{token.symbol || 'Unknown'}</div>
                            <div className="text-sm text-gray-600">{token.name || 'ERC-20 Token'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(parseFloat(token.balance || '0'))}</div>
                          <div className="text-sm text-gray-600">{formatCurrency(parseFloat(token.usd_value || '0'))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ethereum Transaction History */}
            {walletData?.ethereum?.address && (
              <TransactionHistory
                address={walletData.ethereum.address}
                chainType="eth"
                explorerUrl="https://etherscan.io/tx/"
              />
            )}
          </TabsContent>

          {/* Solana Wallet Details */}
          <TabsContent value="solana" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    SOL Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.solana?.balance || '0.000000'}</div>
                  <p className="text-xs text-gray-600">{formatCurrency(parseFloat(walletData?.solana?.usdValue || '0'))}</p>
                  <p className="text-xs text-gray-500 mt-1">{walletData?.solana?.address}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    SPL Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.solana?.tokens?.length || 0}</div>
                  <p className="text-xs text-gray-600">Token holdings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Solana NFTs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.solana?.nfts?.length || 0}</div>
                  <p className="text-xs text-gray-600">NFT collection</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bitcoin Wallet Details */}
          <TabsContent value="bitcoin" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    BTC Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.bitcoin?.balance || '0.00000000'}</div>
                  <p className="text-xs text-gray-600">{formatCurrency(parseFloat(walletData?.bitcoin?.usdValue || '0'))}</p>
                  <p className="text-xs text-gray-500 mt-1">{walletData?.bitcoin?.address}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{walletData?.bitcoin?.transactions || 0}</div>
                  <p className="text-xs text-gray-600">Total transactions</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
