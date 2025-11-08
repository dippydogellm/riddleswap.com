/**
 * Liquidity Vault Page - Multi-chain native token liquidity provision
 * Users can deposit native tokens across all 17 chains and earn rewards
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, TrendingUp, Lock, CheckCircle, Clock, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import RewardsManager from '@/components/vault/RewardsManager';

interface ChainStats {
  chain: string;
  nativeToken: string;
  totalLiquidity: string;
  totalLiquidityUsd: string;
  activeContributors: number;
  currentApy: string;
  minDeposit: string;
  bankWalletAddress: string;
}

interface Contribution {
  id: number;
  chain: string;
  nativeToken: string;
  amount: string;
  amountUsd: string;
  rewardsEarned: string;
  rewardsEarnedUsd: string;
  currentApy: string;
  status: string;
  depositTxHash: string;
  createdAt: string;
}

interface VaultStats {
  totalLiquidityUsd: string;
  totalChains: number;
  totalContributors: number;
  totalContributions: number;
}

export default function VaultPage() {
  const [chains, setChains] = useState<ChainStats[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainStats | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [xrpDepositAmount, setXrpDepositAmount] = useState('');
  const [solDepositAmount, setSolDepositAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [depositMemo, setDepositMemo] = useState('');
  const [contributionId, setContributionId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('deposit');
  const { toast } = useToast();

  useEffect(() => {
    loadChains();
    loadVaultStats();
    loadMyContributions();
  }, []);

  const loadChains = async () => {
    try {
      const response = await fetch('/api/vault/chains');
      const data = await response.json() as any;
      if (data.success) {
        setChains(data.chains);
      }
    } catch (error) {
      console.error('Error loading chains:', error);
    }
  };

  const loadVaultStats = async () => {
    try {
      const response = await fetch('/api/vault/stats');
      const data = await response.json() as any;
      if (data.success) {
        setVaultStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading vault stats:', error);
    }
  };

  const loadMyContributions = async () => {
    try {
      const response = await fetch('/api/vault/my-contributions', {
        credentials: 'include'
      });
      const data = await response.json() as any;
      if (data.success) {
        setContributions(data.contributions);
      }
    } catch (error) {
      console.error('Error loading contributions:', error);
    }
  };

  const handlePrepareDeposit = async () => {
    if (!selectedChain || !depositAmount || !walletAddress) {
      toast({
        title: 'Missing Information',
        description: 'Please select a chain, enter amount and wallet address',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/vault/prepare-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chain: selectedChain.chain,
          amount: depositAmount,
          walletAddress
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        setDepositMemo(data.contribution.memo);
        setContributionId(data.contribution.id);
        toast({
          title: 'Deposit Prepared',
          description: 'Follow the instructions to complete your deposit'
        });
        setActiveTab('verify');
      } else {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDeposit = async () => {
    if (!contributionId || !txHash) {
      toast({
        title: 'Missing Information',
        description: 'Please enter the transaction hash',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/vault/verify-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contributionId,
          txHash
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: 'Success!',
          description: data.message
        });
        loadMyContributions();
        loadVaultStats();
        setActiveTab('my-deposits');
        // Reset form
        setDepositAmount('');
        setWalletAddress('');
        setDepositMemo('');
        setContributionId(null);
        setTxHash('');
      } else {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCachedWalletDeposit = async (chain: 'xrpl' | 'solana') => {
    const amount = chain === 'xrpl' ? xrpDepositAmount : solDepositAmount;
    
    if (!amount) {
      toast({
        title: 'Missing Information',
        description: 'Please enter deposit amount',
        variant: 'destructive'
      });
      return;
    }

    const minAmount = chain === 'xrpl' ? 1 : 0.1;
    if (parseFloat(amount) < minAmount) {
      toast({
        title: 'Amount Too Small',
        description: `Minimum deposit is ${minAmount} ${chain === 'xrpl' ? 'XRP' : 'SOL'}`,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/liquidity-vault/deposit-from-wallet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('riddleWalletToken')}`
        },
        credentials: 'include',
        body: JSON.stringify({
          chain,
          amount
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: 'Deposit Successful! 🎉',
          description: `Deposited ${amount} ${data.contribution.nativeToken} to vault. TX: ${data.contribution.txHash.substring(0, 10)}...`
        });
        
        // Refresh data
        await Promise.all([
          loadMyContributions(),
          loadVaultStats()
        ]);
        
        // Reset form - clear the appropriate deposit amount
        if (chain === 'xrpl') {
          setXrpDepositAmount('');
        } else {
          setSolDepositAmount('');
        }
        setActiveTab('my-deposits');
      } else {
        // Handle specific error codes
        if (data.errorCode === 'SESSION_EXPIRED' && data.needsRenewal) {
          toast({
            title: 'Session Expired',
            description: 'Please renew your session to make deposits. Redirecting...',
            variant: 'destructive'
          });
          // Could trigger session renewal modal here
        } else if (data.errorCode === 'INSUFFICIENT_BALANCE') {
          toast({
            title: 'Insufficient Balance',
            description: data.error,
            variant: 'destructive'
          });
        } else if (data.errorCode === 'VAULT_NOT_CONFIGURED') {
          toast({
            title: 'Vault Not Ready',
            description: data.error,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Deposit Failed',
            description: data.error || 'Unknown error occurred',
            variant: 'destructive'
          });
        }
      }
    } catch (error: any) {
      console.error('Error making cached wallet deposit:', error);
      toast({
        title: 'Network Error',
        description: 'Failed to process deposit. Please check your connection and try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard'
    });
  };

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      ethereum: 'bg-blue-500',
      bsc: 'bg-yellow-500',
      polygon: 'bg-purple-500',
      xrpl: 'bg-gray-700',
      solana: 'bg-green-500',
      bitcoin: 'bg-orange-500',
      arbitrum: 'bg-blue-400',
      optimism: 'bg-red-400',
      base: 'bg-blue-600',
      avalanche: 'bg-red-500'
    };
    return colors[chain] || 'bg-gray-500';
  };

  const totalDeposited = contributions.reduce((sum, c) => sum + parseFloat(c.amountUsd || '0'), 0);
  const totalRewards = contributions.reduce((sum, c) => sum + parseFloat(c.rewardsEarnedUsd || '0'), 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Liquidity Vault
        </h1>
        <p className="text-muted-foreground">
          Provide native token liquidity across all 17 chains and earn rewards
        </p>
      </div>

      {/* Vault Stats */}
      {vaultStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Liquidity</p>
                  <p className="text-2xl font-bold text-green-500">
                    ${parseFloat(vaultStats.totalLiquidityUsd || '0').toLocaleString()}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Chains</p>
                  <p className="text-2xl font-bold text-blue-500">{vaultStats.totalChains}</p>
                </div>
                <Wallet className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contributors</p>
                  <p className="text-2xl font-bold text-purple-500">{vaultStats.totalContributors}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deposits</p>
                  <p className="text-2xl font-bold text-yellow-500">{vaultStats.totalContributions}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Cached Wallet Deposits */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle className="text-foreground">Quick Deposit from Riddle Wallet</CardTitle>
          <CardDescription>Use your cached wallet keys for instant deposits (requires active session)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* XRP Quick Deposit */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-medium text-foreground">XRP</span>
                <Badge variant="outline">XRPL</Badge>
              </div>
              <Input
                type="number"
                step="0.000001"
                placeholder="Amount (min 1 XRP)"
                value={xrpDepositAmount}
                onChange={(e) => setXrpDepositAmount(e.target.value)}
                className="bg-background border-border text-foreground"
              />
              <Button
                onClick={() => handleCachedWalletDeposit('xrpl')}
                disabled={loading || !xrpDepositAmount}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {loading ? 'Processing...' : 'Deposit XRP'}
              </Button>
            </div>

            {/* SOL Quick Deposit */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="font-medium text-foreground">SOL</span>
                <Badge variant="outline">Solana</Badge>
              </div>
              <Input
                type="number"
                step="0.000001"
                placeholder="Amount (min 0.1 SOL)"
                value={solDepositAmount}
                onChange={(e) => setSolDepositAmount(e.target.value)}
                className="bg-background border-border text-foreground"
              />
              <Button
                onClick={() => handleCachedWalletDeposit('solana')}
                disabled={loading || !solDepositAmount}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              >
                {loading ? 'Processing...' : 'Deposit SOL'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="deposit">New Deposit</TabsTrigger>
          <TabsTrigger value="verify">Verify Deposit</TabsTrigger>
          <TabsTrigger value="my-deposits">My Deposits</TabsTrigger>
          <TabsTrigger value="rewards">My Rewards</TabsTrigger>
        </TabsList>

        {/* New Deposit Tab */}
        <TabsContent value="deposit">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chain Selection */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Select Chain</CardTitle>
                <CardDescription>Choose a blockchain to provide liquidity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                  {chains.map((chain) => (
                    <button
                      key={chain.chain}
                      onClick={() => setSelectedChain(chain)}
                      className={`p-4 rounded-lg border transition-all ${
                        selectedChain?.chain === chain.chain
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-border hover:border-blue-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getChainColor(chain.chain)}`} />
                          <span className="font-medium capitalize text-foreground">{chain.chain}</span>
                          <Badge variant="outline">{chain.nativeToken}</Badge>
                        </div>
                        <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                          {chain.currentApy}% APY
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Min: {chain.minDeposit} {chain.nativeToken}</span>
                        <span>{chain.activeContributors} Contributors</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Deposit Form */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Deposit Details</CardTitle>
                <CardDescription>
                  {selectedChain
                    ? `Provide ${selectedChain.nativeToken} liquidity on ${selectedChain.chain}`
                    : 'Select a chain to continue'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedChain && (
                  <>
                    <Alert className="bg-blue-500/10 border-blue-500/50">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <AlertDescription className="text-blue-500">
                        Current APY: <strong>{selectedChain.currentApy}%</strong> • 
                        Min Deposit: <strong>{selectedChain.minDeposit} {selectedChain.nativeToken}</strong>
                      </AlertDescription>
                    </Alert>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Your Wallet Address</label>
                      <Input
                        type="text"
                        placeholder="Enter your wallet address"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        className="bg-background border-border text-foreground"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Deposit Amount ({selectedChain.nativeToken})
                      </label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder={`Min: ${selectedChain.minDeposit}`}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="bg-background border-border text-foreground"
                      />
                    </div>

                    <Button
                      onClick={handlePrepareDeposit}
                      disabled={loading || !depositAmount || !walletAddress}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      {loading ? 'Preparing...' : 'Prepare Deposit'}
                    </Button>
                  </>
                )}

                {!selectedChain && (
                  <Alert>
                    <AlertDescription>
                      Please select a chain from the list to begin your deposit
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Verify Deposit Tab */}
        <TabsContent value="verify">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Verify Your Deposit</CardTitle>
              <CardDescription>Complete the payment and verify your transaction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {depositMemo ? (
                <>
                  <Alert className="bg-yellow-500/10 border-yellow-500/50">
                    <AlertDescription className="text-yellow-500">
                      <strong>Important:</strong> Include the memo below in your transaction
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Bank Wallet Address</label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={selectedChain?.bankWalletAddress || ''}
                          className="bg-background border-border font-mono text-sm text-foreground"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(selectedChain?.bankWalletAddress || '')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Memo (REQUIRED)</label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={depositMemo}
                          className="bg-background border-border font-mono text-sm text-foreground"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(depositMemo)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Transaction Hash</label>
                      <Input
                        type="text"
                        placeholder="Enter your transaction hash after sending"
                        value={txHash}
                        onChange={(e) => setTxHash(e.target.value)}
                        className="bg-background border-border font-mono text-sm text-foreground"
                      />
                    </div>

                    <Button
                      onClick={handleVerifyDeposit}
                      disabled={loading || !txHash}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    >
                      {loading ? 'Verifying...' : 'Verify Deposit'}
                    </Button>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    Please prepare a deposit first in the "New Deposit" tab
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Deposits Tab */}
        <TabsContent value="my-deposits">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Total Deposited</p>
                <p className="text-3xl font-bold text-foreground">${totalDeposited.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Total Rewards</p>
                <p className="text-3xl font-bold text-green-500">${totalRewards.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Active Deposits</p>
                <p className="text-3xl font-bold text-purple-500">
                  {contributions.filter(c => c.status === 'verified').length}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {contributions.map((contribution) => (
              <Card key={contribution.id} className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-3 h-3 rounded-full ${getChainColor(contribution.chain)}`} />
                        <span className="font-medium capitalize text-foreground">{contribution.chain}</span>
                        <Badge variant="outline">{contribution.nativeToken}</Badge>
                        <Badge
                          variant={contribution.status === 'verified' ? 'default' : 'secondary'}
                          className={contribution.status === 'verified' ? 'bg-green-500' : ''}
                        >
                          {contribution.status === 'verified' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Deposited</p>
                          <p className="font-medium text-foreground">
                            {parseFloat(contribution.amount).toFixed(6)} {contribution.nativeToken}
                          </p>
                          <p className="text-muted-foreground">${parseFloat(contribution.amountUsd || '0').toFixed(2)}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Rewards Earned</p>
                          <p className="font-medium text-green-500">
                            {parseFloat(contribution.rewardsEarned || '0').toFixed(6)} {contribution.nativeToken}
                          </p>
                          <p className="text-muted-foreground">${parseFloat(contribution.rewardsEarnedUsd || '0').toFixed(2)}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Current APY</p>
                          <p className="font-medium text-blue-500">{contribution.currentApy}%</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-medium text-foreground">
                            {new Date(contribution.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {contribution.depositTxHash && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{contribution.depositTxHash.slice(0, 20)}...</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(contribution.depositTxHash)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {contributions.length === 0 && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No deposits yet. Start by creating your first deposit!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* My Rewards Tab */}
        <TabsContent value="rewards">
          <RewardsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
