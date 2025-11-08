import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, Loader2, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchTokens, getPopularTokens, type TokenSearchResult } from "@/lib/token-api";
import { useToast } from "@/hooks/use-toast";

// Simple debounce implementation
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface ApiTokenSelectorProps {
  selectedToken: TokenSearchResult | null;
  onTokenSelect: (token: TokenSearchResult) => void;
  placeholder?: string;
  isWalletConnected?: boolean;
  walletAddress?: string | null;
  tokenBalances?: {[key: string]: string};
  usdPrices?: {[key: string]: number};
  standalone?: boolean; // New prop to control dialog wrapper
}

export default function ApiTokenSelector({ 
  selectedToken, 
  onTokenSelect, 
  placeholder = "Select token",
  isWalletConnected = false,
  walletAddress = null,
  tokenBalances = {},
  usdPrices = {},
  standalone = true
}: ApiTokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false); // Default to closed
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTokenAnimation, setSelectedTokenAnimation] = useState(false);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { toast } = useToast();

  // Helper function to calculate USD value
  const calculateUSDValue = (amount: string, tokenSymbol: string): string => {
    if (!amount || !tokenSymbol || parseFloat(amount) <= 0) return "";
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "";
    
    // Use authentic price data only
    const price = usdPrices[tokenSymbol] || 0;
    if (!price || price === 0) return "";
    
    const value = numAmount * price;
    if (value < 0.01) return "< $0.01";
    
    return `$${value.toFixed(2)}`;
  };

  // Helper function to get token balance
  const getTokenBalance = (token: TokenSearchResult): string => {
    if (!isWalletConnected || !tokenBalances) return "";
    const key = `${token.currency_code}:${token.issuer}`;
    const balance = tokenBalances[key] || "";
    // Debug logging
    if (token.symbol === 'RDL') {

    }
    return balance;
  };

  // Helper function to get token USD price
  const getTokenUSDPrice = (token: TokenSearchResult): number => {
    const price = usdPrices[token.symbol] || token.price_usd || 0;
    // Debug logging
    if (token.symbol === 'RDL') {

    }
    return price;
  };

  // Query for search results only
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['/api/tokens/search', debouncedSearch],
    queryFn: () => searchTokens(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Featured tokens - show when no search
  const [featuredTokens, setFeaturedTokens] = useState<TokenSearchResult[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);

  // Load featured tokens on mount
  useEffect(() => {
    const loadFeaturedTokens = async () => {
      setIsLoadingFeatured(true);
      try {
        // Load popular tokens by volume
        const tokens = ['XRP', 'SOLO', 'CSC', 'COREUM', 'RDL'];
        const allResults: TokenSearchResult[] = [];
        
        for (const symbol of tokens) {
          const response = await fetch(`/api/tokens/search?query=${symbol}`);
          if (response.ok) {
            const results = await response.json() as any;
            const token = results.find((t: TokenSearchResult) => t.symbol === symbol);
            if (token) {
              allResults.push(token);
            }
          }
        }
        
        // Sort by trading volume (highest first)
        allResults.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
        
        setFeaturedTokens(allResults);
      } catch (error) {
        // Removed console statement for production
      } finally {
        setIsLoadingFeatured(false);
      }
    };
    
    loadFeaturedTokens();
  }, []);

  const handleTokenSelect = (token: TokenSearchResult) => {
    // Trigger selection animation
    setSelectedTokenAnimation(true);
    
    // Reset animation after completion
    setTimeout(() => setSelectedTokenAnimation(false), 600);
    
    // Only show low volume warning for very high volume trades (>1000 tokens) as per user request
    // Low volume warnings removed for small amounts per user preference
    
    onTokenSelect(token);
    setIsOpen(false);
    setSearchQuery("");
    setHoveredToken(null); // Clear hover state
  };

  // Sort tokens by market cap (highest first), then by volume
  const filterAndSortTokens = (tokens: TokenSearchResult[]) => {
    return tokens
      .filter(token => token.symbol) // Just basic validation
      .sort((a, b) => {
        // First priority: Market cap (highest first)
        const aMarketCap = a.market_cap || 0;
        const bMarketCap = b.market_cap || 0;
        if (bMarketCap !== aMarketCap) {
          return bMarketCap - aMarketCap;
        }
        
        // Second priority: Volume (highest first)
        return (b.volume_24h || 0) - (a.volume_24h || 0);
      });
  };

  const tokensToShow = searchQuery.length >= 2 ? filterAndSortTokens(searchResults) : featuredTokens;

  // Check if token has low volume (exclude XRP)
  const isLowVolume = (token: TokenSearchResult) => {
    // XRP never has low volume warning
    if (token.symbol === 'XRP') return false;
    return !token.volume_24h || token.volume_24h < 1000;
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clear search and hover state when dialog closes
      setSearchQuery("");
      setHoveredToken(null);
    }
  };

  // Render different UI based on standalone prop
  if (!standalone) {
    // When used inside existing overlay, just render the content without Dialog wrapper
    return (
      <div className="token-dialog-content token-dialog-enter" style={{maxWidth: '500px', width: '90vw'}}>
        <div className="token-dialog-header">
          <h2 className="token-dialog-title">Select Token</h2>
        </div>
        <p id="token-selector-description" className="sr-only">
          Select a token for your swap transaction
        </p>
        
        <div className="token-dialog-body space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, symbol or issuer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input token-search-input"
              autoFocus
            />
          </div>

          {/* Featured Tokens Header */}
          {searchQuery.length < 2 && featuredTokens.length > 0 && (
            <div className="featured-tokens-header">
              <span className="featured-tokens-label">Featured Tokens</span>
              <Badge variant="secondary" className="volume-badge">
                By Volume
              </Badge>
            </div>
          )}

          {/* Results */}
          <ScrollArea className="h-[60vh] sm:h-80">
            <div className="space-y-1">
              {searchQuery.length < 2 && featuredTokens.length === 0 && !isLoadingFeatured ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Type at least 2 characters to search
                </div>
              ) : tokensToShow.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {searchQuery.length >= 2 ? 'No tokens found' : 'No featured tokens available'}
                </div>
              ) : (
                tokensToShow.map((token) => (
                  <Button
                    key={`${token.currency_code}-${token.issuer}`}
                    variant="ghost"
                    className={`token-list-item group ${hoveredToken === `${token.currency_code}-${token.issuer}` ? 'hovered' : ''}`}
                    onClick={() => handleTokenSelect(token)}
                    onMouseEnter={() => setHoveredToken(`${token.currency_code}-${token.issuer}`)}
                    onMouseLeave={() => setHoveredToken(null)}
                  >
                    <div className="token-list-content">
                      <div className="token-list-icon token-logo-container">
                        {token.symbol === 'XRP' ? (
                          <img 
                            src="/images/chains/xrp-logo.png" 
                            alt="XRP" 
                            className="token-image image-md"
                          />
                        ) : token.icon_url ? (
                          <img 
                            src={token.icon_url} 
                            alt={token.symbol}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className="token-image image-md"
                          />
                        ) : (
                          <div className="token-placeholder-icon"></div>
                        )}
                        {token.symbol === 'XRP' && (
                          <div className="token-list-icon-verified"></div>
                        )}
                      </div>
                      <div className="token-info-container">
                        <div className="token-name-row">
                          <span className="token-symbol">{token.symbol}</span>
                          {(token.verified || (token.symbol === 'RDL' && token.issuer === 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9')) && (
                            <Badge variant="secondary" className="verified-badge">
                              ✓
                            </Badge>
                          )}
                          {isLowVolume(token) && token.symbol !== 'RDL' && (
                            <Badge variant="destructive" className="low-volume-badge">
                              ⚠️
                            </Badge>
                          )}
                        </div>
                        {isLowVolume(token) && (
                          <span className="issuer-warning">
                            Verify: {token.issuer?.slice(0, 12)}...
                          </span>
                        )}
                        
                        {/* Balance and Price Display */}
                        {isWalletConnected && getTokenBalance(token) && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Balance: {parseFloat(getTokenBalance(token)).toLocaleString()} {token.symbol}
                          </div>
                        )}
                        
                        {getTokenUSDPrice(token) > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            ${getTokenUSDPrice(token) >= 1 ? getTokenUSDPrice(token).toFixed(2) : getTokenUSDPrice(token).toFixed(6)} USD
                            {isWalletConnected && getTokenBalance(token) && (
                              <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                ≈ {calculateUSDValue(getTokenBalance(token), token.symbol)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {token.volume_24h && (
                          <div className={`text-xs ${isLowVolume(token) ? 'text-red-500' : 'text-gray-500'}`}>
                            Vol: {token.volume_24h < 1000 ? `$${token.volume_24h.toFixed(0)}` : `$${(token.volume_24h / 1000).toFixed(1)}k`}
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  // When standalone, render with full Dialog wrapper
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={`token-selector-button ${selectedTokenAnimation ? 'token-selected' : ''}`}
        >
          <div className="token-selector-content">
            <div className="token-selector-icon">
              {selectedToken?.symbol === 'XRP' ? (
                <img 
                  src="/images/chains/xrp-logo.png" 
                  alt="XRP" 
                  className="token-image image-sm"
                />
              ) : selectedToken?.icon_url ? (
                <img 
                  src={selectedToken.icon_url} 
                  alt={selectedToken.symbol} 
                  className="token-image image-sm"
                />
              ) : null}
              {selectedToken?.symbol === 'XRP' && (
                <div className="token-verified-badge"></div>
              )}
              {selectedTokenAnimation && (
                <div className="token-action-feedback">
                  <CheckCircle className="w-3 h-3" />
                </div>
              )}
            </div>
            <div className="token-selector-info">
              <span className="token-selector-text">
                {selectedToken?.symbol || placeholder}
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="token-dialog-content token-dialog-enter" aria-describedby="token-selector-description">
        <DialogHeader className="token-dialog-header">
          <DialogTitle className="token-dialog-title">Select Token</DialogTitle>
        </DialogHeader>
        <p id="token-selector-description" className="sr-only">
          Select a token for your swap transaction
        </p>
        
        <div className="token-dialog-body space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, symbol or issuer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input token-search-input"
              autoFocus
            />
          </div>

          {/* Featured Tokens Header */}
          {searchQuery.length < 2 && featuredTokens.length > 0 && (
            <div className="featured-tokens-header">
              <span className="featured-tokens-label">Featured Tokens</span>
              <Badge variant="secondary" className="volume-badge">
                By Volume
              </Badge>
            </div>
          )}

          {/* Results */}
          <ScrollArea className="h-[60vh] sm:h-80">
            <div className="space-y-1">
              {searchQuery.length < 2 && featuredTokens.length === 0 && !isLoadingFeatured ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Type at least 2 characters to search
                </div>
              ) : tokensToShow.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {searchQuery.length >= 2 ? 'No tokens found' : 'No featured tokens available'}
                </div>
              ) : (
                tokensToShow.map((token) => (
                  <Button
                    key={`${token.currency_code}-${token.issuer}`}
                    variant="ghost"
                    className={`token-list-item group ${hoveredToken === `${token.currency_code}-${token.issuer}` ? 'hovered' : ''}`}
                    onClick={() => handleTokenSelect(token)}
                    onMouseEnter={() => setHoveredToken(`${token.currency_code}-${token.issuer}`)}
                    onMouseLeave={() => setHoveredToken(null)}
                  >
                    <div className="token-list-content">
                      <div className="token-list-icon token-logo-container">
                        {token.symbol === 'XRP' ? (
                          <img 
                            src="/images/chains/xrp-logo.png" 
                            alt="XRP" 
                            className="token-image image-md"
                          />
                        ) : token.icon_url ? (
                          <img 
                            src={token.icon_url} 
                            alt={token.symbol}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className="token-image image-md"
                          />
                        ) : (
                          <div className="token-placeholder-icon"></div>
                        )}
                        {token.symbol === 'XRP' && (
                          <div className="token-list-icon-verified"></div>
                        )}
                      </div>
                      <div className="token-info-container">
                        <div className="token-name-row">
                          <span className="token-symbol">{token.symbol}</span>
                          {(token.verified || (token.symbol === 'RDL' && token.issuer === 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9')) && (
                            <Badge variant="secondary" className="verified-badge">
                              ✓
                            </Badge>
                          )}
                          {isLowVolume(token) && token.symbol !== 'RDL' && (
                            <Badge variant="destructive" className="low-volume-badge">
                              ⚠️
                            </Badge>
                          )}
                        </div>
                        {isLowVolume(token) && (
                          <span className="issuer-warning">
                            Verify: {token.issuer?.slice(0, 12)}...
                          </span>
                        )}
                        
                        {/* Balance and Price Display */}
                        {isWalletConnected && getTokenBalance(token) && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Balance: {parseFloat(getTokenBalance(token)).toLocaleString()} {token.symbol}
                          </div>
                        )}
                        
                        {getTokenUSDPrice(token) > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            ${getTokenUSDPrice(token) >= 1 ? getTokenUSDPrice(token).toFixed(2) : getTokenUSDPrice(token).toFixed(6)} USD
                            {isWalletConnected && getTokenBalance(token) && (
                              <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                ≈ {calculateUSDValue(getTokenBalance(token), token.symbol)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {token.volume_24h && (
                          <div className={`text-xs ${isLowVolume(token) ? 'text-red-500' : 'text-gray-500'}`}>
                            Vol: {token.volume_24h < 1000 ? `$${token.volume_24h.toFixed(0)}` : `$${(token.volume_24h / 1000).toFixed(1)}k`}
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
