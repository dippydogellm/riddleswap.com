import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuickBridgeProps {
  currentChain: string;
  onBridgeComplete?: () => void;
}

const SUPPORTED_CHAINS = [
  { id: 'xrp', name: 'XRPL', symbol: 'XRP' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
  { id: 'sol', name: 'Solana', symbol: 'SOL' },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB' },
  { id: 'base', name: 'Base', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' }
];

export function QuickBridge({ currentChain, onBridgeComplete }: QuickBridgeProps) {
  const { toast } = useToast();
  const [fromChain, setFromChain] = useState(currentChain);
  const [toChain, setToChain] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [bridgeQuote, setBridgeQuote] = useState<any>(null);

  const getBridgeQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    if (!toChain || toChain === fromChain) {
      toast({
        title: "Invalid Destination",
        description: "Please select a different destination chain",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch('/api/bridge/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          fromChain,
          toChain,
          amount,
          token: 'RDL' // Default to RDL token for bridge
        })
      });

      if (!response.ok) throw new Error('Failed to get bridge quote');
      
      const data = await response.json() as any;
      setBridgeQuote(data);
      
      toast({
        title: "Bridge Quote Ready",
        description: `You'll receive ~${data.estimatedOutput} on ${toChain.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Quote Failed",
        description: error instanceof Error ? error.message : "Failed to get bridge quote",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeBridge = async () => {
    if (!bridgeQuote) {
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
      const response = await fetch('/api/bridge/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          ...bridgeQuote
        })
      });

      if (!response.ok) throw new Error('Bridge failed');
      
      const result = await response.json() as any;
      
      toast({
        title: "Bridge Initiated!",
        description: `Bridging ${amount} from ${fromChain.toUpperCase()} to ${toChain.toUpperCase()}`
      });

      // Track bridge transaction
      if (result.transactionId) {
        toast({
          title: "Transaction ID",
          description: result.transactionId
        });
      }

      // Reset form
      setAmount('');
      setBridgeQuote(null);
      
      if (onBridgeComplete) {
        onBridgeComplete();
      }
    } catch (error) {
      toast({
        title: "Bridge Failed",
        description: error instanceof Error ? error.message : "Failed to execute bridge",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Quick Bridge
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* From Chain */}
          <div className="space-y-2">
            <label className="text-sm font-medium">From Chain</label>
            <Select value={fromChain} onValueChange={setFromChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CHAINS.map(chain => (
                  <SelectItem key={chain.id} value={chain.id}>
                    {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-gray-400" />
          </div>

          {/* To Chain */}
          <div className="space-y-2">
            <label className="text-sm font-medium">To Chain</label>
            <Select value={toChain} onValueChange={setToChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CHAINS.filter(c => c.id !== fromChain).map(chain => (
                  <SelectItem key={chain.id} value={chain.id}>
                    {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (RDL)</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Bridge Quote Info */}
          {bridgeQuote && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span>Bridge Fee:</span>
                <span>{bridgeQuote.fee} RDL</span>
              </div>
              <div className="flex justify-between">
                <span>Est. Time:</span>
                <span>{bridgeQuote.estimatedTime || '2-5 minutes'}</span>
              </div>
              <div className="flex justify-between">
                <span>You'll Receive:</span>
                <span className="font-semibold">{bridgeQuote.estimatedOutput} RDL</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={getBridgeQuote}
              disabled={loading || !amount || !toChain}
              className="flex-1"
              variant="outline"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Get Quote
            </Button>
            <Button
              onClick={executeBridge}
              disabled={loading || !bridgeQuote}
              className="flex-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Bridge Now
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-500 text-center">
            Bridge RDL tokens across chains with minimal fees
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
