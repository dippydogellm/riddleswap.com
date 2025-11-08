import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";
import type { Token } from "@shared/schema";

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelectToken: (token: Token) => void;
  tokens: Token[];
  excludeToken?: Token | null;
  walletAddress?: string | null;
}

interface TokenBalance {
  [key: string]: string;
}

export default function TokenSelector({ 
  selectedToken, 
  onSelectToken, 
  tokens, 
  excludeToken,
  walletAddress 
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [balances, setBalances] = useState<TokenBalance>({});

  // Format price with appropriate decimal places
  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return price.toFixed(4);
    } else if (price >= 0.01) {
      return price.toFixed(6);
    } else if (price >= 0.0001) {
      return price.toFixed(8);
    } else {
      return price.toExponential(4);
    }
  };

  // Fetch wallet balances when wallet is connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (!walletAddress) {
        setBalances({});
        return;
      }
      
      try {
        // Try XRPL-specific balance endpoint first
        const response = await fetch(`/api/xrpl/balances/${walletAddress}`);
        if (response.ok) {
          const data = await response.json() as any;
          // Convert array of balances to object
          const balanceMap: TokenBalance = {};
          if (Array.isArray(data.balances)) {
            data.balances.forEach((balance: any) => {
              const currency = balance.currency || 'XRP';
              balanceMap[currency] = balance.value || balance.balance || "0";
            });
          }
          // Add XRP balance from account info
          if (data.xrpBalance) {
            balanceMap['XRP'] = data.xrpBalance;
          }
          setBalances(balanceMap);
        } else {
          // Fallback to generic wallet balance endpoint
          const fallbackResponse = await fetch(`/api/wallet/balances/${walletAddress}`);
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            setBalances(data);
          }
        }
      } catch (error) {
        // Removed console statement for production
        setBalances({});
      }
    };

    fetchBalances();
    
    // Refresh balances every 15 seconds when dialog is open
    const interval = isOpen ? setInterval(fetchBalances, 15000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [walletAddress, isOpen]);

  // Filter and sort tokens
  const filteredTokens = tokens
    .filter(token => {
      // Exclude the currently selected token from the other selector
      if (excludeToken && token.id === excludeToken.id) return false;
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return token.symbol.toLowerCase().includes(query) ||
               token.name.toLowerCase().includes(query) ||
               (token.issuer && token.issuer.toLowerCase().includes(query));
      }
      return true;
    })
    .sort((a, b) => {
      // Priority 1: Wallet has balance (if connected)
      if (walletAddress) {
        const aBalance = parseFloat(balances[a.symbol] || "0");
        const bBalance = parseFloat(balances[b.symbol] || "0");
        const aHasBalance = aBalance > 0;
        const bHasBalance = bBalance > 0;
        
        if (aHasBalance && !bHasBalance) return -1;
        if (!aHasBalance && bHasBalance) return 1;
      }
      
      // Priority 2: XRP always first
      if (a.symbol === 'XRP') return -1;
      if (b.symbol === 'XRP') return 1;
      
      // Priority 3: Tokens with logos
      const aHasLogo = a.icon_url && a.icon_url !== '';
      const bHasLogo = b.icon_url && b.icon_url !== '';
      
      if (aHasLogo && !bHasLogo) return -1;
      if (!aHasLogo && bHasLogo) return 1;
      
      // Priority 4: Alphabetical order
      return a.symbol.localeCompare(b.symbol);
    });

  const handleSelectToken = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="token-selector-button">
          {selectedToken ? (
            <>
              <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                {selectedToken.icon_url ? (
                  <img 
                    src={selectedToken.icon_url} 
                    alt={selectedToken.symbol}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallbackDiv = document.createElement('div');
                        fallbackDiv.className = 'w-full h-full bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold';
                        fallbackDiv.textContent = selectedToken.symbol.charAt(0);
                        parent.appendChild(fallbackDiv);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {selectedToken.symbol.charAt(0)}
                  </div>
                )}
              </div>
              <span className="font-medium text-primary">{selectedToken.symbol}</span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 bg-muted-foreground rounded-full"></div>
              <span className="font-medium text-primary">Select token</span>
            </>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] flex flex-col p-0 fixed top-[5vh] left-1/2 transform -translate-x-1/2 z-[9999]" style={{ position: 'fixed', top: '5vh' }}>
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="mb-4">Select a token</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredTokens.length > 0 ? (
              filteredTokens.map((token) => {
                const balance = balances[token.symbol] || "0";
                const hasBalance = parseFloat(balance) > 0;
                let priceUsd = 0;
                let trustlineStatus = '';
                
                // Get live price data - PRODUCTION READY (no hardcoded fallbacks)
                if (token.metadata && typeof token.metadata === 'object' && 'price_usd' in token.metadata) {
                  priceUsd = parseFloat(String(token.metadata.price_usd)) || 0;
                }
                // Only show price if it's from live API data (> 0)
                const showPrice = priceUsd > 0;

                // Determine trustline status
                if (token.symbol === 'XRP') {
                  trustlineStatus = 'Native';
                } else if (hasBalance) {
                  trustlineStatus = 'Active';
                } else {
                  trustlineStatus = 'No trustline';
                }

                return (
                  <div
                    key={token.id}
                    onClick={() => handleSelectToken(token)}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  >
                    {/* Token Icon */}
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center relative shrink-0">
                      {token.icon_url ? (
                        <img 
                          src={token.icon_url} 
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallbackDiv = document.createElement('div');
                              fallbackDiv.className = 'w-full h-full bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold';
                              fallbackDiv.textContent = token.symbol.charAt(0);
                              parent.appendChild(fallbackDiv);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {token.symbol.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-primary">{token.symbol}</h3>
                        {walletAddress && (
                          <div className="text-right">
                            <div className="text-sm font-medium text-primary">
                              {hasBalance ? parseFloat(balance).toFixed(6) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs">No balance</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">{token.name}</p>
                        {priceUsd > 0 && (
                          <p className="text-xs text-muted-foreground">${formatPrice(priceUsd)}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground/70 truncate">
                          {token.issuer ? `${token.issuer.substring(0, 8)}...${token.issuer.substring(token.issuer.length - 4)}` : 'Native'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          trustlineStatus === 'Native' ? 'bg-green-100 text-green-800' :
                          trustlineStatus === 'Active' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {trustlineStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-1">No tokens found</p>
                <p className="text-sm">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
