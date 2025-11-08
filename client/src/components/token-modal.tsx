import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Search, RefreshCw } from 'lucide-react';
import { TokenSearchResult, searchTokens, getPopularTokens } from '@/lib/token-api';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: TokenSearchResult) => void;
  selectedChain: string;
  walletAddress?: string;
}

export function TokenModal({
  isOpen,
  onClose,
  onSelectToken,
  selectedChain,
  walletAddress
}: TokenModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<TokenSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Default XRPL tokens
  const defaultTokens: TokenSearchResult[] = [
    {
      symbol: 'XRP',
      currency_code: 'XRP',
      name: 'XRP',
      issuer: '',
      icon_url: '/images/chains/xrp-logo.png',
      verified: true,
      source: 'native'
    }
  ];

  useEffect(() => {
    if (isOpen) {
      // Start with empty token list - user must search to find tokens
      setTokens([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Removed wallet token loading - user searches for what they need

  const performTokenSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      // Show XRP only when no search query
      setTokens(defaultTokens);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log(`🔍 Searching tokens: "${searchQuery}"`);
      
      // Always check if XRP matches the search first
      const filteredXRP = defaultTokens.filter(token => 
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      const searchResults = await searchTokens(searchQuery);
      console.log(`✅ Found ${searchResults.length} tokens matching "${searchQuery}":`, searchResults);
      
      // Combine: XRP (if matches) + search results
      const allTokens = [...filteredXRP, ...searchResults];
      console.log(`✅ Total tokens (including XRP filter): ${allTokens.length}`, allTokens);
      setTokens(allTokens);
    } catch (error) {
      console.error(`❌ Token search failed:`, error);
      // Fallback to filtered XRP only
      const filteredXRP = defaultTokens.filter(token => 
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setTokens(filteredXRP);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(performTokenSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleTokenSelect = (token: TokenSearchResult) => {
    onSelectToken(token);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="token-modal max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
          <DialogDescription>
            Choose a token for your swap transaction
          </DialogDescription>
        </DialogHeader>
        
        <div className="token-modal-content">
          <div className="search-container">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Type to search for tokens (e.g., ARMY, RDL, BTC)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {isLoading && (
                <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
          </div>

          <div className="token-grid">
            {tokens.length > 0 ? (
              tokens.map((token, index) => (
                <div
                  key={`${token.symbol}-${token.issuer || 'native'}-${index}`}
                  className="token-card"
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="token-card-header">
                    <div className="token-logo-container">
                      {token.icon_url ? (
                        <img 
                          src={token.icon_url} 
                          alt={token.symbol}
                          className="token-logo w-24 h-24 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                    {token.verified && (
                      <div className="verified-badge-card">✓</div>
                    )}
                  </div>
                  <div className="token-card-content">
                    <div className="token-symbol-large">{token.symbol}</div>
                    <div className="token-name-small">{token.name}</div>
                    {token.issuer && (
                      <div className="token-issuer-small">
                        {token.issuer.slice(0, 8)}...{token.issuer.slice(-6)}
                      </div>
                    )}
                    {token.price_usd && token.price_usd > 0 && (
                      <div className="token-price">
                        ${token.price_usd.toFixed(6)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : searchQuery.length >= 2 ? (
              <div className="no-tokens-found">
                <p>No tokens found for "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground mt-2">Try searching for ARMY, RDL, BTC, or other token symbols</p>
              </div>
            ) : (
              <div className="no-tokens-found">
                <p className="text-muted-foreground">Type to search for tokens...</p>
                <p className="text-sm text-muted-foreground mt-2">Examples: ARMY, RDL, BTC</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
