// Bridge Token Selector Dialog Component
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronDown } from 'lucide-react';

interface BridgeTokenSelectorDialogProps {
  tokens: any[];
  selectedToken?: any;
  onSelectToken: (token: any) => void;
  label: string;
}

export function BridgeTokenSelectorDialog({ 
  tokens, 
  selectedToken, 
  onSelectToken, 
  label 
}: BridgeTokenSelectorDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = tokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectToken = (token: any) => {
    onSelectToken(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="token-selector-button"
      >
        <div className="token-selector-content">
          <div className="token-selector-icon">
            {selectedToken ? (
              <img 
                src={selectedToken.logo} 
                alt={selectedToken.symbol} 
                className="token-image image-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="token-placeholder-icon"></div>
            )}
          </div>
          <div className="token-selector-info">
            <span className="token-selector-text">
              {selectedToken?.symbol || "Select Token"}
            </span>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="token-dialog-content token-dialog-enter" aria-describedby="bridge-token-selector-description">
          <DialogHeader className="token-dialog-header">
            <DialogTitle className="token-dialog-title">{label}</DialogTitle>
          </DialogHeader>
          <p id="bridge-token-selector-description" className="sr-only">
            Select a token for your bridge transaction
          </p>
          
          <div className="space-y-4">
            <div className="token-search-container">
              <Search className="token-search-icon" />
              <Input
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="token-search-input"
                autoFocus
              />
            </div>

            <ScrollArea className="token-list-container">
              <div className="token-list">
                {filteredTokens.map((token) => (
                  <button
                    key={`${token.symbol}-${token.chainId}`}
                    onClick={() => handleSelectToken(token)}
                    className="token-list-item"
                  >
                    <div className="token-list-icon">
                      <img 
                        src={token.logo} 
                        alt={token.symbol} 
                        className="token-image image-md"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="token-list-info">
                      <div className="token-list-name">{token.symbol}</div>
                      <div className="token-list-description">{token.name}</div>
                    </div>
                    <div className="token-list-chain">
                      {token.chainId}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
