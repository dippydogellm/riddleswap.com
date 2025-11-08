import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShoppingCart, Wallet, ExternalLink } from "lucide-react";
import { WalletSelectionDialog } from "@/components/nft/WalletSelectionDialog";
import { WalletSelector, WalletOption } from "@/utils/walletSelector";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BrokerNFT {
  NFTokenID: string;
  URI?: string;
  Flags: number;
  Issuer: string;
  NFTokenTaxon: number;
  nft_serial: number;
}

interface BrokerInfo {
  address: string;
  balance: {
    xrp: string;
    drops: string;
  };
  status?: 'active' | 'unfunded';
  message?: string;
}

interface SellOffer {
  amount: string;
  flags: number;
  nft_offer_index: string;
  owner: string;
}

interface NFTWithOffer extends BrokerNFT {
  sellOffer?: SellOffer;
  priceXRP?: string;
}

export default function BrokerMarketplace() {
  const { toast } = useToast();
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFTWithOffer | null>(null);
  const [buyingNFT, setBuyingNFT] = useState<string | null>(null);
  const [nftsWithOffers, setNftsWithOffers] = useState<NFTWithOffer[]>([]);

  const { data: brokerInfo } = useQuery<BrokerInfo>({
    queryKey: ['/api/broker/info'],
  });

  const { data: brokerNFTs, isLoading: nftsLoading } = useQuery<{ count: number; nfts: BrokerNFT[] }>({
    queryKey: ['/api/broker/nfts'],
    enabled: true,
  });

  useQuery({
    queryKey: ['/api/broker/nfts-with-offers', brokerNFTs?.nfts],
    queryFn: async () => {
      if (!brokerNFTs?.nfts) return [];
      
      const nftsWithOffersData = await Promise.all(
        brokerNFTs.nfts.map(async (nft) => {
          try {
            const offersResponse = await fetch(`/api/broker/nft/${nft.NFTokenID}/sell-offers`);
            if (!offersResponse.ok) return { ...nft };
            
            const offersData = await offersResponse.json();
            const sellOffer = offersData.offers?.[0];
            
            if (sellOffer) {
              const priceInDrops = sellOffer.amount;
              const priceXRP = (parseInt(priceInDrops) / 1000000).toString();
              
              return {
                ...nft,
                sellOffer,
                priceXRP
              };
            }
            
            return { ...nft };
          } catch {
            return { ...nft };
          }
        })
      );
      
      setNftsWithOffers(nftsWithOffersData);
      return nftsWithOffersData;
    },
    enabled: !!brokerNFTs?.nfts && brokerNFTs.nfts.length > 0,
  });

  const handleBuyClick = (nft: NFTWithOffer) => {
    if (!nft.sellOffer) {
      toast({
        variant: "destructive",
        title: "No Sell Offer",
        description: "This NFT doesn't have an active sell offer",
      });
      return;
    }

    const hasMultipleWallets = WalletSelector.hasMultipleWallets();
    
    if (hasMultipleWallets) {
      setSelectedNFT(nft);
      setShowWalletDialog(true);
    } else {
      const preferredWallet = WalletSelector.getPreferredWallet();
      if (preferredWallet) {
        handleBuyNFT(nft, preferredWallet);
      } else {
        toast({
          variant: "destructive",
          title: "No Wallet Connected",
          description: "Please connect a wallet to purchase NFTs",
        });
      }
    }
  };

  const handleBuyNFT = async (nft: NFTWithOffer, wallet: WalletOption) => {
    setBuyingNFT(nft.NFTokenID);
    
    try {
      toast({
        title: "Processing Purchase",
        description: `Using ${wallet.name} to buy this NFT...`,
      });

      if (!nft.sellOffer) {
        throw new Error('No sell offer available for this NFT');
      }

      const result = await apiRequest(`/api/broker/buy/${nft.NFTokenID}`, {
        method: 'POST',
        body: JSON.stringify({
          buyOfferId: nft.sellOffer.nft_offer_index,
          walletType: wallet.type
        })
      }) as { success?: boolean; txHash?: string; error?: string };

      if (result.success) {
        toast({
          title: "Purchase Successful!",
          description: `NFT purchased successfully. TX: ${result.txHash?.slice(0, 8)}...`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to purchase NFT",
      });
    } finally {
      setBuyingNFT(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">NFT Broker Marketplace</h1>
          <p className="text-gray-400">Purchase NFTs directly from the RiddleSwap broker</p>
        </div>

        {brokerInfo && (
          <Card className="bg-gray-800/50 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Broker Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400 text-sm">Broker Address</Label>
                  <p className="text-white font-mono text-sm">{brokerInfo.address}</p>
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Balance</Label>
                  <p className="text-white font-semibold">{brokerInfo.balance.xrp} XRP</p>
                </div>
              </div>
              
              {brokerInfo.status === 'unfunded' && brokerInfo.message && (
                <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                  <p className="text-yellow-400 text-sm">{brokerInfo.message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">Broker NFT Inventory</h2>
          <p className="text-gray-400">
            {nftsWithOffers.filter(n => n.sellOffer).length} of {nftsWithOffers.length} NFTs listed for sale
          </p>
        </div>

        {nftsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : nftsWithOffers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nftsWithOffers.map((nft) => (
              <Card key={nft.NFTokenID} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    NFT #{nft.nft_serial}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-400 text-xs">Token ID</Label>
                      <p className="text-white text-xs font-mono break-all">
                        {nft.NFTokenID.slice(0, 16)}...{nft.NFTokenID.slice(-8)}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-gray-400 text-xs">Issuer</Label>
                      <p className="text-white text-xs font-mono">
                        {nft.Issuer.slice(0, 12)}...
                      </p>
                    </div>

                    {nft.sellOffer && nft.priceXRP && (
                      <div className="bg-blue-900/30 border border-blue-600/50 p-3 rounded-lg">
                        <Label className="text-blue-400 text-xs font-medium">For Sale</Label>
                        <p className="text-white font-bold text-xl">{nft.priceXRP} XRP</p>
                      </div>
                    )}

                    {!nft.sellOffer && (
                      <div className="bg-gray-700/50 border border-gray-600 p-3 rounded-lg">
                        <p className="text-gray-400 text-sm text-center">Not Listed</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {nft.sellOffer && nft.priceXRP ? (
                        <Button
                          onClick={() => handleBuyClick(nft)}
                          disabled={buyingNFT === nft.NFTokenID}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          data-testid={`button-buy-nft-${nft.NFTokenID}`}
                        >
                          {buyingNFT === nft.NFTokenID ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Buying...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Buy for {nft.priceXRP} XRP
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          disabled
                          className="flex-1 bg-gray-700 text-gray-400 cursor-not-allowed"
                        >
                          Not For Sale
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => window.open(`https://livenet.xrpl.org/nft/${nft.NFTokenID}`, '_blank')}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 mb-4">No NFTs currently available</p>
              <p className="text-sm text-gray-500">
                Check back later for new listings
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <WalletSelectionDialog
        isOpen={showWalletDialog}
        onClose={() => {
          setShowWalletDialog(false);
          setSelectedNFT(null);
        }}
        onSelectWallet={(wallet) => {
          if (selectedNFT) {
            handleBuyNFT(selectedNFT, wallet);
          }
        }}
        title="Select Wallet for Purchase"
        description="Choose which wallet you want to use to buy this NFT"
      />
    </div>
  );
}
