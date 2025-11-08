import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Wallet, 
  ExternalLink,
  Image,
  Coins,
  TrendingUp,
  RefreshCw,
  Copy
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface WalletSearchProps {
  onWalletSelect?: (address: string) => void;
}

interface SearchedWallet {
  address: string;
  balance: string;
  tokens: Array<{
    symbol: string;
    balance: string;
    name?: string;
    issuer?: string;
  }>;
  nfts: Array<{
    nft_id: string;
    name: string;
    image?: string;
  }>;
  transactions: number;
  account_data?: any;
}

export function WalletSearch({ onWalletSelect }: WalletSearchProps) {
  const [searchAddress, setSearchAddress] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedWallet | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchWallet = async () => {
    if (!searchAddress || !searchAddress.startsWith('r')) {
      return;
    }

    setIsSearching(true);
    try {
      // Fetch wallet data
      const accountResponse = await fetch(`/api/xrpl/account-data/${searchAddress}`);
      const accountData = await accountResponse.json();

      if (accountData.error) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      // Fetch NFTs
      const nftResponse = await fetch(`/api/bithomp/wallet/${searchAddress}/nfts`);
      const nftData = await nftResponse.json();

      // Fetch recent transactions count
      const txResponse = await fetch(`/api/transactions/xrp/${searchAddress}?limit=5`);
      const txData = await txResponse.json();

      const walletData: SearchedWallet = {
        address: searchAddress,
        balance: accountData.balance || "0",
        tokens: accountData.tokens || [],
        nfts: nftData.data?.nfts?.slice(0, 6) || [], // Show first 6 NFTs
        transactions: txData.transactions?.length || 0,
        account_data: accountData
      };

      setSearchResults(walletData);
    } catch (error) {
      console.error('Wallet search error:', error);
      setSearchResults(null);
    }
    setIsSearching(false);
  };

  const formatAmount = (amount: string, symbol: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return `0 ${symbol}`;
    
    // Handle zero amounts properly
    if (num === 0) {
      return `0 ${symbol}`;
    }
    
    // For very small amounts, show more decimal places instead of scientific notation
    if (num < 0.0001) {
      return `${num.toFixed(8).replace(/\.?0+$/, '')} ${symbol}`;
    }
    return `${num.toFixed(4)} ${symbol}`;
  };

  const copyAddress = () => {
    if (searchResults?.address) {
      navigator.clipboard.writeText(searchResults.address);
    }
  };

  return (
    <Card className="card-enhanced">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4" />
          Wallet Explorer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="space-y-2">
          <Label className="text-xs">Search XRPL Address</Label>
          <div className="flex gap-2">
            <Input
              placeholder="rEVrTKUKSLx5nxdfV8SAFTxS9FGFr..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="h-8 text-xs font-mono"
              onKeyDown={(e) => e.key === 'Enter' && searchWallet()}
            />
            <Button
              size="sm"
              onClick={searchWallet}
              disabled={isSearching || !searchAddress.startsWith('r')}
              className="h-8 px-3"
            >
              <Search className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Searching wallet...</span>
          </div>
        )}

        {searchResults && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
            {/* Wallet Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                <span className="text-sm font-medium">Wallet Found</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={copyAddress}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://livenet.xrpl.org/accounts/${searchResults.address}`, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Address */}
            <div className="text-xs font-mono bg-muted/50 p-2 rounded truncate">
              {searchResults.address}
            </div>

            {/* Balance */}
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">
                {formatAmount(searchResults.balance, 'XRP')}
              </span>
              {searchResults.tokens.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{searchResults.tokens.length} tokens
                </Badge>
              )}
            </div>

            {/* Top Tokens */}
            {searchResults.tokens.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Top Tokens:</div>
                <div className="grid grid-cols-2 gap-1">
                  {searchResults.tokens.slice(0, 4).map((token, index) => (
                    <div key={index} className="text-xs bg-muted/30 p-1 rounded">
                      {formatAmount(token.balance, token.symbol)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NFTs */}
            {searchResults.nfts.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Image className="w-3 h-3" />
                  <span className="text-xs text-muted-foreground">
                    NFTs ({searchResults.nfts.length})
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {searchResults.nfts.slice(0, 6).map((nft, index) => (
                    <div key={index} className="relative aspect-square bg-muted/30 rounded overflow-hidden">
                      {nft.image ? (
                        <img 
                          src={nft.image} 
                          alt={nft.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs p-1 truncate">
                        {nft.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs text-muted-foreground">
                Recent transactions: {searchResults.transactions}
              </span>
            </div>

            {/* Action Button */}
            {onWalletSelect && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => onWalletSelect(searchResults.address)}
              >
                View Full Wallet
              </Button>
            )}
          </div>
        )}

        {searchAddress && !searchResults && !isSearching && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No wallet found or wallet not activated
          </div>
        )}
      </CardContent>
    </Card>
  );
}
