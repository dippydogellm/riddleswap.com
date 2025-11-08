import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuickSwapProps {
  chain: 'xrp' | 'sol' | 'eth' | 'bsc' | 'base' | 'polygon';
  onSwapComplete?: () => void;
  availableTokens?: any[];
}

const CHAIN_TOKENS = {
  xrp: ['XRP', 'RDL', 'SOLO', 'COREUM'],
  sol: ['SOL', 'USDC', 'USDT', 'BONK'],
  eth: ['ETH', 'USDC', 'USDT', 'WETH'],
  bsc: ['BNB', 'USDT', 'BUSD', 'CAKE'],
  base: ['ETH', 'USDC', 'DAI'],
  polygon: ['MATIC', 'USDC', 'USDT', 'WETH']
};

export function QuickSwap({ chain, onSwapComplete, availableTokens = [] }: QuickSwapProps) {
  const { toast } = useToast();
  
  // Use wallet tokens if available, fallback to hardcoded list
  const tokens = availableTokens.length > 0 
    ? ['XRP', ...availableTokens.map(t => t.currency || t.name).filter(t => t !== 'XRP')]
    : CHAIN_TOKENS[chain];
    
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1] || tokens[0]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  const getSwapQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const endpoint = chain === 'xrp' ? '/api/xrpl/swap/quote' : 
                      chain === 'sol' ? '/api/solana/swap/quote' :
                      `/api/ethereum/swap/quote`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          fromToken,
          toToken,
          amount,
          network: chain === 'eth' || chain === 'bsc' || chain === 'base' || chain === 'polygon' ? chain : undefined
        })
      });

      if (!response.ok) throw new Error('Failed to get quote');
      
      const data = await response.json() as any;
      setQuote(data);
      
      toast({
        title: "Quote Ready",
        description: `You'll receive ~${data.estimatedOutput} ${toToken}`
      });
    } catch (error) {
      toast({
        title: "Quote Failed",
        description: error instanceof Error ? error.message : "Failed to get swap quote",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!quote) {
      toast({
        title: "No Quote",
        description: "Please get a quote first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const endpoint = chain === 'xrp' ? '/api/xrpl/swap/execute' : 
                      chain === 'sol' ? '/api/solana/swap/execute' :
                      `/api/ethereum/swap/execute`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          ...quote
        })
      });

      if (!response.ok) throw new Error('Swap failed');
      
      const result = await response.json() as any;
      
      toast({
        title: "Swap Successful!",
        description: `Swapped ${amount} ${fromToken} for ${result.received} ${toToken}`
      });

      // Reset form
      setAmount('');
      setQuote(null);
      
      if (onSwapComplete) {
        onSwapComplete();
      }
    } catch (error) {
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Failed to execute swap",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setQuote(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5" />
          Quick Swap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* From Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium">From</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
              />
              <Select value={fromToken} onValueChange={setFromToken}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAIN_TOKENS[chain].map(token => (
                    <SelectItem key={token} value={token}>{token}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={switchTokens}
              className="rounded-full"
            >
              <ArrowDownUp className="w-4 h-4" />
            </Button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={quote?.estimatedOutput || ''}
                readOnly
                className="flex-1"
              />
              <Select value={toToken} onValueChange={setToToken}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAIN_TOKENS[chain].filter(t => t !== fromToken).map(token => (
                    <SelectItem key={token} value={token}>{token}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quote Info */}
          {quote && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span>Rate:</span>
                <span>1 {fromToken} = {quote.rate} {toToken}</span>
              </div>
              <div className="flex justify-between">
                <span>Fee:</span>
                <span>{quote.fee} {fromToken}</span>
              </div>
              <div className="flex justify-between">
                <span>Min Received:</span>
                <span>{quote.minimumReceived} {toToken}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={getSwapQuote}
              disabled={loading || !amount}
              className="flex-1"
              variant="outline"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Get Quote
            </Button>
            <Button
              onClick={executeSwap}
              disabled={loading || !quote}
              className="flex-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Swap Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
