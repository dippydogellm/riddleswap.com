import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Star, Wallet, X } from 'lucide-react';

interface EVMToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price_usd?: number;
  balance?: string;
  balanceUsd?: number;
  verified?: boolean;
}

interface FromTokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: EVMToken) => void;
  chainId: number;
  chainName: string;
  walletAddress: string | null;
  riddleWalletAddress?: string | null;
}

export default function FromTokenSelector({
  isOpen,
  onClose,
  onSelect,
  chainId,
  chainName,
  walletAddress,
  riddleWalletAddress
}: FromTokenSelectorProps) {
  const [walletTokens, setWalletTokens] = useState<EVMToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch wallet tokens with balances
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchWalletTokens = async () => {
      setIsLoading(true);
      try {
        // Use Riddle wallet address if available, otherwise use connected wallet
        const addressToUse = riddleWalletAddress || walletAddress;
        
        if (!addressToUse) {
          console.log('❌ No wallet address available');
          setIsLoading(false);
          return;
        }

        console.log(`🔍 Fetching ALL tokens from 1inch API for chain ${chainId}`);
        
        // Fetch ALL tokens from 1inch API (no wallet-specific filtering on backend)
        const response = await fetch(`/api/swap/evm/tokens/${chainId}`);
        const data = await response.json() as any;
        
        if (data.success && data.tokens) {
          // 1inch API returns tokens as object, convert to array
          const tokensArray = Object.values(data.tokens).map((token: any) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals,
            logoURI: token.logoURI,
            chainId: chainId,
            verified: true // 1inch tokens are verified
          }));
          console.log(`✅ Found ${tokensArray.length} tokens from 1inch API`);
          setWalletTokens(tokensArray);
        }
      } catch (error) {
        console.error('❌ Error fetching wallet tokens:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWalletTokens();
  }, [isOpen, chainId, walletAddress, riddleWalletAddress]);

  // Filter tokens based on search
  const filteredTokens = walletTokens.filter(token => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
          setSearchQuery("");
        }
      }}
    >
      <Card className="w-full max-w-xs sm:max-w-md max-h-[85vh] overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Select Token (Your Wallet)
            </CardTitle>
            <button
              onClick={() => {
                onClose();
                setSearchQuery("");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input
            placeholder={`Search your ${chainName} tokens...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2"
            autoFocus
          />
          {isLoading && (
            <div className="text-xs text-muted-foreground flex items-center mt-1">
              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              Loading your wallet tokens...
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
          {filteredTokens.map((token) => (
            <button
              key={`${token.symbol}_${token.address}`}
              onClick={() => {
                onSelect(token);
                onClose();
                setSearchQuery("");
              }}
              className="w-full flex items-center space-x-3 p-3 hover:bg-secondary transition-colors border-b last:border-b-0"
            >
              {/* Token Logo */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                {token.logoURI ? (
                  <img 
                    src={token.logoURI} 
                    alt={token.symbol}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      // Fallback to symbol text
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = token.symbol.substring(0, 2).toUpperCase();
                    }}
                  />
                ) : (
                  token.symbol.substring(0, 2).toUpperCase()
                )}
              </div>

              {/* Token Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {token.symbol}
                  {token.verified && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {token.name}
                </div>
              </div>

              {/* Balance & Price */}
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-sm">
                  {token.balance ? parseFloat(token.balance).toFixed(4) : '0.0000'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {token.balanceUsd ? `$${token.balanceUsd.toFixed(2)}` : 
                   token.price_usd ? `$${token.price_usd.toFixed(4)}` : '$0.00'}
                </div>
              </div>
            </button>
          ))}
          
          {filteredTokens.length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">
              {searchQuery ? (
                <>No tokens found matching "{searchQuery}"</>
              ) : (
                <>No tokens found in your wallet</>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
