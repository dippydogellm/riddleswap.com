import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Coins, 
  Loader2,
  Rocket,
  Info,
  Droplets,
  Settings
} from 'lucide-react';

export default function LaunchToken() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Token Details
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [totalSupply, setTotalSupply] = useState('1000000');
  const [decimals, setDecimals] = useState('18');
  const [chain, setChain] = useState('ethereum');
  const [description, setDescription] = useState('');

  // Liquidity Setup
  const [enableLiquidity, setEnableLiquidity] = useState(false);
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [dexPlatform, setDexPlatform] = useState('uniswap');

  // Process State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const chains = [
    // Layer 1
    { value: 'ethereum', label: 'Ethereum', icon: '⟠', type: 'evm', requiresDecimals: true },
    { value: 'bitcoin', label: 'Bitcoin', icon: '₿', type: 'utxo', requiresDecimals: false },
    { value: 'solana', label: 'Solana', icon: '🟣', type: 'spl', requiresDecimals: true },
    { value: 'xrpl', label: 'XRPL', icon: '🔷', type: 'xrpl', requiresDecimals: false },
    { value: 'avalanche', label: 'Avalanche', icon: '🔺', type: 'evm', requiresDecimals: true },
    // Layer 2 & Side Chains
    { value: 'polygon', label: 'Polygon', icon: '🟣', type: 'evm', requiresDecimals: true },
    { value: 'arbitrum', label: 'Arbitrum', icon: '🔷', type: 'evm', requiresDecimals: true },
    { value: 'optimism', label: 'Optimism', icon: '🔴', type: 'evm', requiresDecimals: true },
    { value: 'base', label: 'Base', icon: '🔵', type: 'evm', requiresDecimals: true },
    { value: 'mantle', label: 'Mantle', icon: '🟦', type: 'evm', requiresDecimals: true },
    { value: 'metis', label: 'Metis', icon: '🌈', type: 'evm', requiresDecimals: true },
    { value: 'scroll', label: 'Scroll', icon: '📜', type: 'evm', requiresDecimals: true },
    { value: 'zksync', label: 'zkSync', icon: '⚡', type: 'evm', requiresDecimals: true },
    { value: 'linea', label: 'Linea', icon: '📏', type: 'evm', requiresDecimals: true },
    { value: 'taiko', label: 'Taiko', icon: '🥁', type: 'evm', requiresDecimals: true },
    // BSC & Alternative
    { value: 'bsc', label: 'BNB Chain', icon: '🟡', type: 'evm', requiresDecimals: true },
    { value: 'fantom', label: 'Fantom', icon: '👻', type: 'evm', requiresDecimals: true },
  ];

  const dexPlatforms = {
    // EVM chains with DEX support
    ethereum: [
      { value: 'uniswap', label: 'Uniswap V3' },
      { value: 'sushiswap', label: 'SushiSwap' }
    ],
    bsc: [
      { value: 'pancakeswap', label: 'PancakeSwap' }
    ],
    polygon: [
      { value: 'quickswap', label: 'QuickSwap' },
      { value: 'uniswap', label: 'Uniswap V3' }
    ],
    base: [
      { value: 'baseswap', label: 'BaseSwap' },
      { value: 'uniswap', label: 'Uniswap V3' }
    ],
    arbitrum: [
      { value: 'camelot', label: 'Camelot' },
      { value: 'uniswap', label: 'Uniswap V3' }
    ],
    optimism: [
      { value: 'velodrome', label: 'Velodrome' },
      { value: 'uniswap', label: 'Uniswap V3' }
    ],
    avalanche: [
      { value: 'traderjoe', label: 'Trader Joe' },
      { value: 'pangolin', label: 'Pangolin' }
    ],
    fantom: [
      { value: 'spookyswap', label: 'SpookySwap' },
      { value: 'spiritswap', label: 'SpiritSwap' }
    ],
    // Solana
    solana: [
      { value: 'raydium', label: 'Raydium' },
      { value: 'orca', label: 'Orca' }
    ]
    // Note: Bitcoin, XRPL, and some L2s (Mantle, Metis, Scroll, zkSync, Linea, Taiko) 
    // don't have DEX support - validation will properly reject liquidity for these
  };

  const validateForm = () => {
    const selectedChain = chains.find(c => c.value === chain);
    
    if (!tokenName || !tokenSymbol) {
      toast({ title: 'Name and symbol required', variant: 'destructive' });
      return false;
    }
    if (!totalSupply || parseFloat(totalSupply) <= 0) {
      toast({ title: 'Invalid supply', variant: 'destructive' });
      return false;
    }

    // Chain-specific validation
    if (selectedChain?.type === 'xrpl') {
      // XRPL requires issuer address for tokens (handled server-side)
      if (enableLiquidity) {
        toast({ 
          title: 'XRPL liquidity not supported', 
          description: 'Disable liquidity or choose an EVM chain',
          variant: 'destructive' 
        });
        return false;
      }
    }

    if (selectedChain?.type === 'utxo') {
      // Bitcoin token creation requires special consideration
      if (enableLiquidity) {
        toast({ 
          title: 'Bitcoin liquidity not supported', 
          description: 'Bitcoin tokens have limited DeFi features. Disable liquidity to proceed.',
          variant: 'destructive' 
        });
        return false;
      }
    }

    if (selectedChain?.type === 'spl' && enableLiquidity) {
      // Solana requires SPL token program
      if (!dexPlatform || !['raydium', 'orca'].includes(dexPlatform)) {
        toast({ 
          title: 'Invalid Solana DEX', 
          description: 'Select Raydium or Orca for Solana',
          variant: 'destructive' 
        });
        return false;
      }
    }

    // Validate DEX platform exists for chain if liquidity enabled
    if (enableLiquidity) {
      const availableDexes = dexPlatforms[chain as keyof typeof dexPlatforms];
      if (!availableDexes || availableDexes.length === 0) {
        toast({ 
          title: 'Liquidity not available', 
          description: `No DEX platforms available for ${selectedChain?.label}. Disable liquidity or choose another chain.`,
          variant: 'destructive' 
        });
        return false;
      }
      if (!dexPlatform || !availableDexes.find(d => d.value === dexPlatform)) {
        toast({ 
          title: 'Invalid DEX selection', 
          description: 'Please select a valid DEX platform for this chain',
          variant: 'destructive' 
        });
        return false;
      }
    }

    if (selectedChain?.type === 'evm') {
      // EVM chains require decimals
      const decimalsNum = parseInt(decimals);
      if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
        toast({ 
          title: 'Invalid decimals', 
          description: 'EVM tokens require decimals between 0-18',
          variant: 'destructive' 
        });
        return false;
      }
    }

    if (enableLiquidity && (!liquidityAmount || !initialPrice)) {
      toast({ title: 'Complete liquidity details', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleDeploy = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Step 1: Create token launch record
      setCurrentStep('Creating token launch...');
      setProgress(20);

      const launchPayload = {
        tokenName,
        tokenSymbol,
        totalSupply,
        decimals: parseInt(decimals),
        chainType: chain,
        description,
        enableLiquidity,
        liquidityAmount: enableLiquidity ? liquidityAmount : null,
        initialPrice: enableLiquidity ? initialPrice : null,
        dexPlatform: enableLiquidity ? dexPlatform : null
      };

      const createResponse = await fetch('/api/launchpad/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(launchPayload)
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create token launch');
      }

      const launchData = await createResponse.json();
      setProgress(40);

      // Step 2: Deploy token to blockchain
      setCurrentStep('Deploying token to blockchain...');

      const deployResponse = await fetch(`/api/launchpad/deploy/${launchData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!deployResponse.ok) {
        throw new Error('Token deployment failed');
      }

      const deployData = await deployResponse.json();
      setProgress(70);

      // Step 3: Setup liquidity if enabled
      if (enableLiquidity) {
        setCurrentStep('Setting up liquidity pool...');

        const liquidityPayload = {
          tokenAddress: deployData.contractAddress,
          amount: liquidityAmount,
          initialPrice,
          dexPlatform
        };

        const liquidityResponse = await fetch('/api/launchpad/setup-liquidity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(liquidityPayload)
        });

        if (!liquidityResponse.ok) {
          console.error('Liquidity setup failed (non-blocking)');
        }

        setProgress(90);
      }

      // Step 4: Finalize
      setCurrentStep('Finalizing...');
      setProgress(100);

      toast({
        title: 'Token Deployed Successfully! 🎉',
        description: `${tokenSymbol} is now live on ${chain.toUpperCase()}`
      });

      setTimeout(() => {
        setLocation(`/token/${deployData.contractAddress}`);
      }, 2000);

    } catch (error) {
      console.error('Token deployment error:', error);
      toast({
        title: 'Deployment Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const selectedChain = chains.find(c => c.value === chain);
  const availableDexPlatforms = dexPlatforms[chain as keyof typeof dexPlatforms] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6 text-slate-400 hover:text-white"
          onClick={() => setLocation('/launch')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Launch Options
        </Button>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                <Coins className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-2xl">Token Launch</CardTitle>
                <CardDescription>Deploy your token across 17 blockchains</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger value="details">
                  <Settings className="mr-2 h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="liquidity" disabled={!enableLiquidity}>
                  <Droplets className="mr-2 h-4 w-4" />
                  Liquidity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-6">
                {/* Chain Selection */}
                <div className="space-y-2">
                  <Label className="text-white">Blockchain *</Label>
                  <Select value={chain} onValueChange={setChain}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {chains.map(c => (
                        <SelectItem key={c.value} value={c.value} className="text-white">
                          {c.icon} {c.label}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {c.type.toUpperCase()}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Token Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Token Name *</Label>
                    <Input
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="My Token"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Symbol *</Label>
                    <Input
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder="MTK"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Total Supply *</Label>
                    <Input
                      type="number"
                      value={totalSupply}
                      onChange={(e) => setTotalSupply(e.target.value)}
                      placeholder="1000000"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Decimals</Label>
                    <Input
                      type="number"
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value)}
                      placeholder="18"
                      className="bg-slate-800 border-slate-700 text-white"
                      disabled={selectedChain?.type !== 'evm'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your token..."
                    className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                  />
                </div>

                {/* Feature Toggles */}
                <div className="space-y-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Enable Liquidity Pool</Label>
                      <p className="text-sm text-slate-400">Setup initial liquidity on DEX</p>
                    </div>
                    <Switch
                      checked={enableLiquidity}
                      onCheckedChange={setEnableLiquidity}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="liquidity" className="space-y-4 mt-6">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                    <p className="text-blue-300 text-sm">
                      Initial liquidity will be locked for 30 days. Ensure you have sufficient {selectedChain?.label} native tokens for gas fees.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">DEX Platform</Label>
                  <Select value={dexPlatform} onValueChange={setDexPlatform}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {availableDexPlatforms.map(dex => (
                        <SelectItem key={dex.value} value={dex.value} className="text-white">
                          {dex.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Liquidity Amount ({tokenSymbol || 'Tokens'})</Label>
                  <Input
                    type="number"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    placeholder="100000"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Initial Price (in {selectedChain?.label} native token)</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={initialPrice}
                    onChange={(e) => setInitialPrice(e.target.value)}
                    placeholder="0.001"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{currentStep}</span>
                  <span className="text-green-400">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-slate-700">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300"
                onClick={() => setLocation('/launch')}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                onClick={handleDeploy}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Deploy Token
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
