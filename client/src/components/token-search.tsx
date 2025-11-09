import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price?: number;
  marketCap?: number;
  volume24h?: number;
}

interface TokenSearchProps {
  tokens: Token[];
  selectedToken: string;
  onTokenSelect: (tokenAddress: string) => void;
  placeholder?: string;
  chain: 'evm' | 'solana';
  loading?: boolean;
}

export default function TokenSearch({ 
  tokens, 
  selectedToken, 
  onTokenSelect, 
  placeholder = "Search tokens...", 
  chain,
  loading = false 
}: TokenSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return tokens.slice(0, 50); // Show top 50 by default
    
    const query = searchQuery.toLowerCase();
    return tokens.filter(token => 
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    ).slice(0, 100); // Limit to 100 results
  }, [tokens, searchQuery]);

  const selectedTokenData = tokens.find(token => token.address === selectedToken);

  const handleTokenSelect = (tokenAddress: string) => {
    onTokenSelect(tokenAddress);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative">
      <div 
        className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedTokenData ? (
          <div className="flex items-center gap-2 flex-1">
            {selectedTokenData.logoURI && (
              <img 
                src={selectedTokenData.logoURI} 
                alt={selectedTokenData.symbol} 
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="flex flex-col">
              <span className="font-medium">{selectedTokenData.symbol}</span>
              <span className="text-xs text-gray-500 truncate max-w-32">
                {selectedTokenData.name}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500 flex-1">{placeholder}</span>
        )}
        <Search className="w-4 h-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={`Search ${chain.toUpperCase()} tokens...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Token List */}
          <div className="overflow-y-auto max-h-60">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Loading {chain.toUpperCase()} tokens...
              </div>
            ) : filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <div
                  key={token.address}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleTokenSelect(token.address)}
                >
                  {token.logoURI && (
                    <img 
                      src={token.logoURI} 
                      alt={token.symbol} 
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.symbol}</span>
                      {token.price && (
                        <span className="text-xs text-gray-500">
                          ${Number(token.price).toFixed(6)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {token.name}
                    </div>
                    <div className="text-xs text-gray-400 truncate font-mono">
                      {token.address.slice(0, 8)}...{token.address.slice(-6)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                No tokens found for "{searchQuery}"
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="p-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
