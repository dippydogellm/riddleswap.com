import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Star, TrendingUp, X } from 'lucide-react';

interface EVMToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price_usd?: number;
  price_change_24h?: number;
  volume_24h?: number;
  verified?: boolean;
}

interface ToTokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: EVMToken) => void;
  chainId: number;
  chainName: string;
}

export default function ToTokenSelector({
  isOpen,
  onClose,
  onSelect,
  chainId,
  chainName
}: ToTokenSelectorProps) {
  const [allTokens, setAllTokens] = useState<EVMToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch featured tokens or search
  useEffect(() => {
    if (!isOpen) {
      setAllTokens([]);
      return;
    }
    
    const fetchTokens = async () => {
      setIsLoading(true);
      try {
        // Fetch ALL tokens from 1inch API
        console.log(`🌐 Loading ALL tokens for chain ${chainId} from 1inch API`);
        
        const response = await fetch(`/api/swap/evm/tokens/${chainId}`);
        const data = await response.json() as any;
        
        if (data.success && data.tokens) {
          // 1inch API returns tokens as object, convert to array
          const tokens = Object.values(data.tokens).map((token: any) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals,
            logoURI: token.logoURI,
            chainId: chainId,
            price_usd: token.price_usd,
            verified: true
          }));
          console.log(`✅ Loaded ${tokens.length} tokens from 1inch API`);
          
          // Filter by search query on frontend if user is searching
          if (searchQuery && searchQuery.trim().length >= 2) {
            const queryLower = searchQuery.toLowerCase();
            const filtered = tokens.filter((token: any) => 
              token.symbol?.toLowerCase().includes(queryLower) ||
              token.name?.toLowerCase().includes(queryLower) ||
              token.address?.toLowerCase().includes(queryLower)
            );
            console.log(`🔍 Filtered to ${filtered.length} tokens matching "${searchQuery}"`);
            setAllTokens(filtered.slice(0, 200)); // Show top 200 matches
          } else {
            // No search - show ALL available tokens from 1inch
            console.log(`📋 Showing all ${tokens.length} tokens from 1inch API`);
            setAllTokens(tokens);
          }
        } else {
          console.log('⚠️ No tokens available from API');
          setAllTokens([]);
        }
      } catch (error) {
        console.error('❌ Error fetching tokens:', error);
        setAllTokens([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search, load featured immediately
    const timeout = setTimeout(fetchTokens, searchQuery ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [isOpen, searchQuery, chainId]);

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
              <Search className="h-4 w-4" />
              Select Token
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
            placeholder={`Search ${chainName} tokens...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2"
            autoFocus
          />
          {isLoading && (
            <div className="text-xs text-muted-foreground flex items-center mt-1">
              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              Searching 1inch tokens...
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
          {allTokens.map((token) => (
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
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

              {/* Price & Stats */}
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-sm">
                  ${token.price_usd?.toFixed(6) || '0.000000'}
                </div>
                {token.price_change_24h !== undefined && token.price_change_24h !== 0 && (
                  <div className={`text-xs ${
                    token.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {token.price_change_24h >= 0 ? '+' : ''}{token.price_change_24h.toFixed(2)}%
                  </div>
                )}
              </div>
            </button>
          ))}
          
          {allTokens.length === 0 && searchQuery && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">
              No tokens found matching "{searchQuery}"
            </div>
          )}
          
          {!searchQuery && allTokens.length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <div>No featured tokens available</div>
              <div className="text-xs mt-1">Search to find more tokens</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
