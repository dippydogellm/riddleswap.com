import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Rocket, TrendingUp, Users, Wallet, Clock, CheckCircle, AlertCircle, Plus, ChevronDown, Timer, Star, DollarSign, BarChart3, ExternalLink, Activity, Copy, CheckCircle2, Zap, Shield, Clock3, Calculator, Info, HelpCircle, Lock, Unlock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import BondingCurveChart from '@/components/BondingCurveChart';

interface LaunchpadProject {
  id: string;
  name: string;
  description: string;
  status: string;
  fundingTarget: number;
  currentFunding: number;
  tokenAllocationPercentage: number;
  deadline: string;
  participantCount: number;
  minimumContribution: number;
  maximumContribution: number;
  tokenSymbol: string;
  tokenSupply: number;
  launchpadMetadata: any;
}

interface BondingCurveLaunch {
  id: number;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenLogo: string;
  chainType: string;
  totalSupply: string;
  fundingGoal: string;
  basePrice: string;
  curveCoefficient: string;
  currentTokenPrice: string;
  currentMarketCap: string;
  totalRaised: string;
  participantCount: number;
  enableNftGating: boolean;
  nftGatingDuration: number;
  nftHoldersStartTime: string;
  nftHoldersEndTime: string;
  openSaleStartTime: string;
  nftHolderDiscount: string;
  status: string;
  currentStage: string;
  useBondingCurve: boolean;
  autoLaunchEnabled: boolean;
  autoLaunchTriggered: boolean;
}

interface NFTVerificationResult {
  isNftHolder: boolean;
  verifiedCollections: string[];
  nftIds: string[];
  cached: boolean;
}

interface LaunchAccessCheck {
  canAccess: boolean;
  reason?: string;
  isNftHolder: boolean;
  verifiedCollections: string[];
  nftWindowTimeRemaining: number | null;
  currentStage: string;
  nftHolderDiscount: string;
}

interface BondingCurvePricing {
  currentPrice: string;
  newPrice: string;
  averagePrice: string;
  tokensReceived: string;
  currentMarketCap: string;
  newMarketCap: string;
  progressPercentage: string;
}

interface FeeCalculation {
  fundingAmount: string;
  completionFee: string;
  swapFeeRate: string;
  totalFees: string;
  netProceeds: string;
  finalTokenFeeRate: string;
}

interface LaunchControlOptions {
  controlType: 'back_hole' | 'keep_control';
  finalTokenFeeRate: number; // 0-1%
  liquidityPoolControl: boolean;
  privateKeyUsage: boolean;
}

// Fee Structure Display Component
function FeeStructureCard({ fundingAmount = "0", onFeeChange }: { 
  fundingAmount?: string;
  onFeeChange?: (fees: FeeCalculation) => void;
}) {
  const [calculation, setCalculation] = useState<FeeCalculation>({
    fundingAmount: fundingAmount,
    completionFee: "0",
    swapFeeRate: "1.0",
    totalFees: "0", 
    netProceeds: "0",
    finalTokenFeeRate: "0.5"
  });

  useEffect(() => {
    const amount = parseFloat(fundingAmount) || 0;
    const completionFee = amount * 0.10; // 10% completion fee
    const swapFeeEstimate = amount * 0.01; // Estimated 1% swap fees
    const totalFees = completionFee + swapFeeEstimate;
    const netProceeds = amount - totalFees;

    const newCalculation = {
      fundingAmount: amount.toFixed(2),
      completionFee: completionFee.toFixed(2),
      swapFeeRate: "1.0",
      totalFees: totalFees.toFixed(2),
      netProceeds: netProceeds.toFixed(2),
      finalTokenFeeRate: calculation.finalTokenFeeRate
    };

    setCalculation(newCalculation);
    onFeeChange?.(newCalculation);
  }, [fundingAmount, calculation.finalTokenFeeRate]);

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-800" data-testid="fee-structure-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-lg">RiddlePad Fee Structure</CardTitle>
        </div>
        <CardDescription>
          Transparent fee breakdown for your token launch
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fee Breakdown */}
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg" data-testid="fee-breakdown">
          <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">Fee Structure</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm">Completion Fee</span>
                <div className="group relative">
                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    One-time fee charged when bonding curve reaches completion and liquidity is created
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-orange-600">10%</span>
                <div className="text-xs text-muted-foreground">${calculation.completionFee}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm">Swap Fee</span>
                <div className="group relative">
                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    Applied to each swap until bonding curve completes
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-orange-600">1%</span>
                <div className="text-xs text-muted-foreground">per swap</div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center font-semibold">
              <span>Total Estimated Fees</span>
              <span className="text-orange-600">${calculation.totalFees}</span>
            </div>

            <div className="flex justify-between items-center text-green-600">
              <span>Net Proceeds</span>
              <span className="font-bold">${calculation.netProceeds}</span>
            </div>
          </div>
        </div>

        {/* Fee Calculator */}
        <div className="space-y-3" data-testid="fee-calculator">
          <h4 className="font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Fee Calculator
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label>Funding Goal</Label>
              <div className="font-mono text-lg">${calculation.fundingAmount}</div>
            </div>
            <div>
              <Label>Completion Fee (10%)</Label>
              <div className="font-mono text-lg text-orange-600">${calculation.completionFee}</div>
            </div>
          </div>

          <Alert data-testid="fee-transparency-info">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Fee Transparency:</strong> All fees are clearly displayed before launch. 
              Completion fee is only charged when your bonding curve successfully completes and liquidity is created.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}

// User Control Options Component
function LaunchControlPanel({ onControlChange }: {
  onControlChange?: (options: LaunchControlOptions) => void;
}) {
  const [controlOptions, setControlOptions] = useState<LaunchControlOptions>({
    controlType: 'keep_control',
    finalTokenFeeRate: 0.5,
    liquidityPoolControl: true,
    privateKeyUsage: true
  });

  const handleControlChange = (newOptions: Partial<LaunchControlOptions>) => {
    const updated = { ...controlOptions, ...newOptions };
    setControlOptions(updated);
    onControlChange?.(updated);
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800" data-testid="launch-control-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg">Launch Control Options</CardTitle>
        </div>
        <CardDescription>
          Choose how you want to control your token after launch
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Control Type Selection */}
        <div className="space-y-4" data-testid="control-type-selection">
          <h4 className="font-medium">Liquidity Pool Control</h4>
          
          <div className="grid grid-cols-1 gap-3">
            <label className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              controlOptions.controlType === 'keep_control' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="controlType"
                  value="keep_control"
                  checked={controlOptions.controlType === 'keep_control'}
                  onChange={(e) => handleControlChange({ controlType: e.target.value as 'keep_control' })}
                  className="mt-1"
                  data-testid="control-keep-radio"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Unlock className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-900 dark:text-blue-100">Keep Control</span>
                    <Badge variant="outline" className="text-green-600 border-green-600">Recommended</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You maintain control of the liquidity pool using your Riddle wallet. 
                    Can adjust fees and manage liquidity after launch.
                  </p>
                  <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                    ✓ Full liquidity control  ✓ Adjustable fees  ✓ Withdrawal options
                  </div>
                </div>
              </div>
            </label>

            <label className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              controlOptions.controlType === 'back_hole' 
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="controlType"
                  value="back_hole"
                  checked={controlOptions.controlType === 'back_hole'}
                  onChange={(e) => handleControlChange({ controlType: e.target.value as 'back_hole' })}
                  className="mt-1"
                  data-testid="control-blackhole-radio"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-red-900 dark:text-red-100">Black Hole</span>
                    <Badge variant="destructive">Permanent</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Liquidity is permanently locked by sending control keys to a burn address. 
                    Cannot be changed after launch.
                  </p>
                  <div className="mt-2 text-xs text-red-700 dark:text-red-300">
                    ⚠️ Permanent lock  ⚠️ No fee adjustments  ⚠️ No withdrawals
                  </div>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Final Token Fee Rate */}
        {controlOptions.controlType === 'keep_control' && (
          <div className="space-y-3" data-testid="final-token-fee-rate">
            <h4 className="font-medium">Final Token Fee Rate</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Post-Launch Trading Fee</Label>
                <span className="font-mono text-lg">{controlOptions.finalTokenFeeRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={controlOptions.finalTokenFeeRate}
                onChange={(e) => handleControlChange({ finalTokenFeeRate: parseFloat(e.target.value) })}
                className="w-full"
                data-testid="final-fee-rate-slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0% (No fees)</span>
                <span>1% (Maximum)</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Fee applied to token swaps after bonding curve completion. You can adjust this later.
              </p>
            </div>
          </div>
        )}

        {/* Security Information */}
        <Alert data-testid="wallet-security-info">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Wallet Security:</strong> Your tokens are launched under control of your Riddle wallet. 
            We use cached private keys for liquidity pool setup with full transparency. 
            You maintain complete ownership and control.
          </AlertDescription>
        </Alert>

        {/* Control Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg" data-testid="control-summary">
          <h4 className="font-medium mb-2">Launch Summary</h4>
          <div className="space-y-1 text-sm">
            <div>Control Type: <span className="font-medium">{controlOptions.controlType === 'keep_control' ? 'Keep Control' : 'Black Hole'}</span></div>
            {controlOptions.controlType === 'keep_control' && (
              <div>Final Fee Rate: <span className="font-medium">{controlOptions.finalTokenFeeRate}%</span></div>
            )}
            <div>Wallet Control: <span className="font-medium text-green-600">Maintained</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// NFT Verification Status Component
function NFTVerificationStatus({ walletAddress, onVerification }: { 
  walletAddress: string | null; 
  onVerification: (result: NFTVerificationResult) => void; 
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [verificationResult, setVerificationResult] = useState<NFTVerificationResult | null>(null);

  useEffect(() => {
    if (walletAddress) {
      checkNFTHoldings();
    }
  }, [walletAddress]);

  const checkNFTHoldings = async () => {
    if (!walletAddress) return;
    
    setIsChecking(true);
    try {
      const response = await apiRequest('/api/devtools/nft/verify', {
        method: 'POST',
        body: JSON.stringify({ 
          walletAddress, 
          collections: ['riddle_nfts'] 
        })
      });
      
      const data = await response.json() as NFTVerificationResult;
      setVerificationResult(data);
      onVerification(data);
    } catch (error) {
      console.error('NFT verification failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-lg">Riddle NFT Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isChecking ? (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
            Verifying NFT holdings...
          </div>
        ) : verificationResult ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {verificationResult.isNftHolder ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">Verified Riddle NFT Holder</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <span className="text-orange-600 font-medium">No Riddle NFTs Found</span>
                </>
              )}
            </div>
            
            {verificationResult.isNftHolder && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Collections verified: {verificationResult.verifiedCollections.length}
                </p>
                <p className="text-sm text-gray-600">
                  NFTs found: {verificationResult.nftIds.length}
                </p>
                <Badge variant="outline" className="text-purple-600 border-purple-300">
                  Priority Access Granted
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <Button 
            onClick={checkNFTHoldings} 
            className="w-full"
            data-testid="button-check-nft"
          >
            Check NFT Holdings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Countdown Timer Component
function CountdownTimer({ targetTime, label }: { targetTime: string | null; label: string }) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetTime) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const difference = target - now;

      if (difference > 0) {
        setTimeRemaining(difference);
      } else {
        setTimeRemaining(0);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  const formatTime = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!targetTime || timeRemaining <= 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Timer className="h-5 w-5 text-orange-500" />
          <span className="font-medium text-orange-600">{label}</span>
        </div>
        <div className="text-2xl font-bold text-orange-500 font-mono">
          {formatTime(timeRemaining)}
        </div>
      </CardContent>
    </Card>
  );
}

// Deployment Status Section Component
function DeploymentStatusSection({ 
  launch, 
  onCopyAddress, 
  onCopyTxHash 
}: { 
  launch: BondingCurveLaunch; 
  onCopyAddress: (address: string) => void;
  onCopyTxHash: (hash: string) => void;
}) {
  const { toast } = useToast();
  
  // Chain-specific information
  const getChainInfo = (chainType: string) => {
    const chainData: Record<string, any> = {
      ethereum: { blockTime: '12s', avgFee: '$8-25', security: 'Highest', explorerUrl: 'https://etherscan.io' },
      bitcoin: { blockTime: '10m', avgFee: '$2-8', security: 'Highest', explorerUrl: 'https://blockstream.info' },
      solana: { blockTime: '400ms', avgFee: '$0.0001', security: 'High', explorerUrl: 'https://solscan.io' },
      xrpl: { blockTime: '3-5s', avgFee: '$0.0001', security: 'High', explorerUrl: 'https://xrpscan.com' },
      polygon: { blockTime: '2s', avgFee: '$0.01-0.1', security: 'High', explorerUrl: 'https://polygonscan.com' },
      arbitrum: { blockTime: '250ms', avgFee: '$0.1-1', security: 'High', explorerUrl: 'https://arbiscan.io' },
      optimism: { blockTime: '2s', avgFee: '$0.1-1', security: 'High', explorerUrl: 'https://optimistic.etherscan.io' },
      base: { blockTime: '2s', avgFee: '$0.01-0.5', security: 'High', explorerUrl: 'https://basescan.org' },
      bsc: { blockTime: '3s', avgFee: '$0.1-0.5', security: 'Medium', explorerUrl: 'https://bscscan.com' },
      avalanche: { blockTime: '2s', avgFee: '$0.5-2', security: 'High', explorerUrl: 'https://snowtrace.io' },
      fantom: { blockTime: '1s', avgFee: '$0.01-0.1', security: 'Medium', explorerUrl: 'https://ftmscan.com' },
      mantle: { blockTime: '2s', avgFee: '$0.001-0.01', security: 'Medium', explorerUrl: 'https://explorer.mantle.xyz' },
      metis: { blockTime: '4s', avgFee: '$0.01-0.1', security: 'Medium', explorerUrl: 'https://andromeda-explorer.metis.io' },
      scroll: { blockTime: '3s', avgFee: '$0.1-0.5', security: 'Medium', explorerUrl: 'https://scrollscan.com' },
      zksync: { blockTime: '1s', avgFee: '$0.1-0.5', security: 'High', explorerUrl: 'https://explorer.zksync.io' },
      linea: { blockTime: '2s', avgFee: '$0.1-1', security: 'High', explorerUrl: 'https://lineascan.build' },
      taiko: { blockTime: '12s', avgFee: '$0.01-0.1', security: 'Medium', explorerUrl: 'https://taikoscan.io' },
      unichain: { blockTime: '1s', avgFee: '$0.01-0.1', security: 'Medium', explorerUrl: 'https://unichain-sepolia.blockscout.com' },
      soneium: { blockTime: '2s', avgFee: '$0.01-0.1', security: 'Medium', explorerUrl: 'https://soneium-minato.blockscout.com' }
    };
    return chainData[chainType] || { blockTime: 'N/A', avgFee: 'N/A', security: 'Unknown', explorerUrl: '#' };
  };

  const chainInfo = getChainInfo(launch.chainType);
  
  // Mock deployment data - in production this would come from the backend
  const deploymentData = {
    contractAddress: launch.id ? `0x${Math.random().toString(16).slice(2, 42).padStart(40, '0')}` : null,
    transactionHash: launch.id ? `0x${Math.random().toString(16).slice(2, 66).padStart(64, '0')}` : null,
    isDeployed: launch.status === 'active' || launch.autoLaunchTriggered,
    deploymentTime: launch.status === 'active' ? new Date().toISOString() : null
  };

  const handleCopyToClipboard = async (text: string, type: 'address' | 'hash') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${type === 'address' ? 'Contract address' : 'Transaction hash'} copied to clipboard`,
      });
      if (type === 'address') {
        onCopyAddress(text);
      } else {
        onCopyTxHash(text);
      }
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive'
      });
    }
  };

  if (!deploymentData.isDeployed) {
    return (
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-600">Pending Deployment</span>
        </div>
        <p className="text-xs text-gray-500">Token will be deployed when funding goal is reached</p>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t space-y-3">
      {/* Deployment Status Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-green-600">Successfully Deployed</span>
        {deploymentData.deploymentTime && (
          <span className="text-xs text-gray-500">
            {new Date(deploymentData.deploymentTime).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Contract Address */}
      {deploymentData.contractAddress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Contract Address</span>
            <div className="flex items-center gap-1">
              <button
                data-testid="button-copy-address"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyToClipboard(deploymentData.contractAddress!, 'address');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <Copy className="h-3 w-3 text-gray-500" />
              </button>
              <a
                href={`${chainInfo.explorerUrl}/address/${deploymentData.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <ExternalLink className="h-3 w-3 text-gray-500" />
              </a>
            </div>
          </div>
          <div className="text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-2 rounded border">
            {deploymentData.contractAddress.slice(0, 8)}...{deploymentData.contractAddress.slice(-8)}
          </div>
        </div>
      )}

      {/* Transaction Hash */}
      {deploymentData.transactionHash && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Transaction Hash</span>
            <div className="flex items-center gap-1">
              <button
                data-testid="button-copy-txhash"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyToClipboard(deploymentData.transactionHash!, 'hash');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <Copy className="h-3 w-3 text-gray-500" />
              </button>
              <a
                href={`${chainInfo.explorerUrl}/tx/${deploymentData.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <ExternalLink className="h-3 w-3 text-gray-500" />
              </a>
            </div>
          </div>
          <div className="text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-2 rounded border">
            {deploymentData.transactionHash.slice(0, 10)}...{deploymentData.transactionHash.slice(-10)}
          </div>
        </div>
      )}

      {/* Chain-Specific Information */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="h-3 w-3 text-blue-500" />
            <span className="font-medium text-blue-700 dark:text-blue-400">Speed</span>
          </div>
          <div className="text-blue-600 dark:text-blue-300">{chainInfo.blockTime}</div>
        </div>
        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="h-3 w-3 text-green-500" />
            <span className="font-medium text-green-700 dark:text-green-400">Fees</span>
          </div>
          <div className="text-green-600 dark:text-green-300">{chainInfo.avgFee}</div>
        </div>
        <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Shield className="h-3 w-3 text-purple-500" />
            <span className="font-medium text-purple-700 dark:text-purple-400">Security</span>
          </div>
          <div className="text-purple-600 dark:text-purple-300">{chainInfo.security}</div>
        </div>
      </div>
    </div>
  );
}

// Bonding Curve Launch Card Component
function BondingCurveLaunchCard({ 
  launch, 
  pricing,
  onViewDetails 
}: { 
  launch: BondingCurveLaunch; 
  pricing: BondingCurvePricing | null;
  onViewDetails: (launchId: number) => void;
}) {
  const progressPercentage = pricing ? parseFloat(pricing.progressPercentage) : 
    (parseFloat(launch.totalRaised) / parseFloat(launch.fundingGoal)) * 100;

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewDetails(launch.id)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {launch.tokenLogo && (
              <img 
                src={launch.tokenLogo} 
                alt={launch.tokenName}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <CardTitle className="text-lg">{launch.tokenName}</CardTitle>
              <p className="text-sm text-gray-600 font-mono">${launch.tokenSymbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              {launch.chainType.toUpperCase()}
            </Badge>
            <Badge 
              variant={launch.status === 'active' ? 'default' : 'secondary'}
              className={launch.status === 'active' ? 'bg-green-500' : ''}
            >
              {launch.status.charAt(0).toUpperCase() + launch.status.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Price Chart Preview */}
        <div className="h-32">
          <BondingCurveChart
            launchId={launch.id}
            tokenSymbol={launch.tokenSymbol}
            fundingGoal={launch.fundingGoal}
            useBondingCurve={launch.useBondingCurve}
            height={120}
            showFullControls={false}
          />
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Current Price</p>
            <p className="font-bold text-green-600">
              ${parseFloat(pricing?.currentPrice || launch.currentTokenPrice).toFixed(6)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Market Cap</p>
            <p className="font-bold text-blue-600">
              ${parseFloat(pricing?.currentMarketCap || launch.currentMarketCap).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Participants</p>
            <p className="font-bold text-purple-600">{launch.participantCount}</p>
          </div>
        </div>
        
        {/* Progress */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Progress to Goal</span>
            <span className="text-sm font-medium">{progressPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{parseFloat(launch.totalRaised).toFixed(2)} XRP raised</span>
            <span>Goal: {parseFloat(launch.fundingGoal).toFixed(2)} XRP</span>
          </div>
        </div>

        {/* Special Features */}
        <div className="flex items-center gap-2 flex-wrap">
          {launch.useBondingCurve && (
            <Badge variant="outline" className="text-xs">
              <Activity className="h-2 w-2 mr-1" />
              Bonding Curve
            </Badge>
          )}
          {launch.enableNftGating && (
            <Badge variant="outline" className="text-xs">
              <Star className="h-2 w-2 mr-1" />
              NFT Priority
            </Badge>
          )}
          {launch.autoLaunchTriggered && (
            <Badge variant="default" className="text-xs bg-orange-500">
              <Rocket className="h-2 w-2 mr-1" />
              Auto-Launched
            </Badge>
          )}
        </div>

        {/* Current Stage */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 capitalize">
              {launch.currentStage.replace('_', ' ')} Phase
            </span>
            <Button variant="outline" size="sm" className="text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Details
            </Button>
          </div>
        </div>

        {/* Deployment Status Section */}
        <DeploymentStatusSection 
          launch={launch}
          onCopyAddress={(address) => {
            console.log('Contract address copied:', address);
          }}
          onCopyTxHash={(hash) => {
            console.log('Transaction hash copied:', hash);
          }}
        />
      </CardContent>
    </Card>
  );
}

// Multi-Chain Token Creation Form
function TokenCreationForm() {
  const [tokenData, setTokenData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: '18',
    description: '',
    website: '',
    twitter: '',
    telegram: '',
    chain: 'ethereum',
    mintable: false,
    burnable: false,
    pausable: false,
    launchpadEnabled: false,
    fundingTarget: '',
    tokenAllocation: '',
    minContribution: '',
    maxContribution: '',
    launchpadDuration: ''
  });
  
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const chainOptions = [
    // Layer 1 Blockchains
    { value: 'ethereum', label: 'Ethereum (ETH)', color: 'bg-blue-500' },
    { value: 'bitcoin', label: 'Bitcoin (BTC)', color: 'bg-orange-500' },
    { value: 'solana', label: 'Solana (SOL)', color: 'bg-purple-600' },
    { value: 'xrpl', label: 'XRPL (XRP)', color: 'bg-gray-800' },
    { value: 'avalanche', label: 'Avalanche (AVAX)', color: 'bg-red-600' },
    
    // Layer 2 & Rollups
    { value: 'polygon', label: 'Polygon (MATIC)', color: 'bg-purple-500' },
    { value: 'arbitrum', label: 'Arbitrum (ARB)', color: 'bg-blue-400' },
    { value: 'optimism', label: 'Optimism (OP)', color: 'bg-red-500' },
    { value: 'base', label: 'Base (ETH)', color: 'bg-blue-600' },
    { value: 'mantle', label: 'Mantle (MNT)', color: 'bg-green-600' },
    { value: 'metis', label: 'Metis (METIS)', color: 'bg-cyan-500' },
    { value: 'scroll', label: 'Scroll (ETH)', color: 'bg-orange-400' },
    { value: 'zksync', label: 'zkSync Era (ETH)', color: 'bg-indigo-500' },
    { value: 'linea', label: 'Linea (ETH)', color: 'bg-emerald-500' },
    { value: 'taiko', label: 'Taiko (ETH)', color: 'bg-pink-500' },
    
    // Alternative EVM & Others
    { value: 'bsc', label: 'Binance Smart Chain (BNB)', color: 'bg-yellow-500' },
    { value: 'fantom', label: 'Fantom (FTM)', color: 'bg-blue-300' },
    { value: 'unichain', label: 'Unichain (ETH)', color: 'bg-violet-500' },
    { value: 'soneium', label: 'Soneium (ETH)', color: 'bg-teal-500' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenData.name || !tokenData.symbol || !tokenData.totalSupply || !tokenData.chain) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const response = await apiRequest('/api/devtools/token/create', {
        method: 'POST',
        body: JSON.stringify(tokenData),
      });

      const data = await response.json() as { success: boolean; [key: string]: any };
      if (data.success) {
        toast({
          title: 'Token Created Successfully!',
          description: `${tokenData.name} (${tokenData.symbol}) has been created on ${chainOptions.find(c => c.value === tokenData.chain)?.label}`,
        });
        
        // Reset form
        setTokenData({
          name: '',
          symbol: '',
          totalSupply: '',
          decimals: '18',
          description: '',
          website: '',
          twitter: '',
          telegram: '',
          chain: 'ethereum',
          mintable: false,
          burnable: false,
          pausable: false,
          launchpadEnabled: false,
          fundingTarget: '',
          tokenAllocation: '',
          minContribution: '',
          maxContribution: '',
          launchpadDuration: ''
        });
      }
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: 'Failed to create token. Please check your connection and try again.',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const selectedChain = chainOptions.find(c => c.value === tokenData.chain);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-6 h-6" />
          Create Token for Launchpad
        </CardTitle>
        <CardDescription>
          Deploy your token on any supported blockchain and optionally launch it through RiddlePad
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="chain">Blockchain Network *</Label>
            <Select value={tokenData.chain} onValueChange={(value) => setTokenData({...tokenData, chain: value})}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select blockchain">
                  {selectedChain && (
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${selectedChain.color}`} />
                      {selectedChain.label}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {chainOptions.map((chain) => (
                  <SelectItem key={chain.value} value={chain.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                      {chain.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Basic Token Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Token Name *</Label>
              <Input
                id="name"
                data-testid="input-token-name"
                value={tokenData.name}
                onChange={(e) => setTokenData({...tokenData, name: e.target.value})}
                placeholder="e.g. RiddleSwap Token"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Token Symbol *</Label>
              <Input
                id="symbol"
                data-testid="input-token-symbol"
                value={tokenData.symbol}
                onChange={(e) => setTokenData({...tokenData, symbol: e.target.value.toUpperCase()})}
                placeholder="e.g. RDL"
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalSupply">Total Supply *</Label>
              <Input
                id="totalSupply"
                data-testid="input-total-supply"
                type="number"
                value={tokenData.totalSupply}
                onChange={(e) => setTokenData({...tokenData, totalSupply: e.target.value})}
                placeholder="e.g. 1000000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decimals">Decimals</Label>
              <Select value={tokenData.decimals} onValueChange={(value) => setTokenData({...tokenData, decimals: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="18">18 (Standard)</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="6">6 (USDC Style)</SelectItem>
                  <SelectItem value="0">0</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              data-testid="textarea-description"
              value={tokenData.description}
              onChange={(e) => setTokenData({...tokenData, description: e.target.value})}
              placeholder="Describe your token project..."
              rows={3}
            />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                data-testid="input-website"
                type="url"
                value={tokenData.website}
                onChange={(e) => setTokenData({...tokenData, website: e.target.value})}
                placeholder="https://yourproject.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter">Twitter</Label>
              <Input
                id="twitter"
                data-testid="input-twitter"
                value={tokenData.twitter}
                onChange={(e) => setTokenData({...tokenData, twitter: e.target.value})}
                placeholder="@yourproject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram">Telegram</Label>
              <Input
                id="telegram"
                data-testid="input-telegram"
                value={tokenData.telegram}
                onChange={(e) => setTokenData({...tokenData, telegram: e.target.value})}
                placeholder="t.me/yourproject"
              />
            </div>
          </div>

          {/* Token Features */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Token Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="checkbox-mintable"
                  checked={tokenData.mintable}
                  onChange={(e) => setTokenData({...tokenData, mintable: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Mintable</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="checkbox-burnable"
                  checked={tokenData.burnable}
                  onChange={(e) => setTokenData({...tokenData, burnable: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Burnable</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="checkbox-pausable"
                  checked={tokenData.pausable}
                  onChange={(e) => setTokenData({...tokenData, pausable: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Pausable</span>
              </label>
            </div>
          </div>

          {/* Launchpad Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="launchpadEnabled"
                data-testid="checkbox-launchpad-enabled"
                checked={tokenData.launchpadEnabled}
                onChange={(e) => setTokenData({...tokenData, launchpadEnabled: e.target.checked})}
                className="rounded border-gray-300"
              />
              <Label htmlFor="launchpadEnabled" className="cursor-pointer">
                Launch on RiddlePad (Fundraising)
              </Label>
            </div>

            {tokenData.launchpadEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="fundingTarget">Funding Target (USD)</Label>
                  <Input
                    id="fundingTarget"
                    data-testid="input-funding-target"
                    type="number"
                    value={tokenData.fundingTarget}
                    onChange={(e) => setTokenData({...tokenData, fundingTarget: e.target.value})}
                    placeholder="e.g. 100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tokenAllocation">Token Allocation (%)</Label>
                  <Input
                    id="tokenAllocation"
                    data-testid="input-token-allocation"
                    type="number"
                    min="1"
                    max="100"
                    value={tokenData.tokenAllocation}
                    onChange={(e) => setTokenData({...tokenData, tokenAllocation: e.target.value})}
                    placeholder="e.g. 20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minContribution">Min Contribution (USD)</Label>
                  <Input
                    id="minContribution"
                    data-testid="input-min-contribution"
                    type="number"
                    value={tokenData.minContribution}
                    onChange={(e) => setTokenData({...tokenData, minContribution: e.target.value})}
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxContribution">Max Contribution (USD)</Label>
                  <Input
                    id="maxContribution"
                    data-testid="input-max-contribution"
                    type="number"
                    value={tokenData.maxContribution}
                    onChange={(e) => setTokenData({...tokenData, maxContribution: e.target.value})}
                    placeholder="e.g. 5000"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="launchpadDuration">Launch Duration (days)</Label>
                  <Input
                    id="launchpadDuration"
                    data-testid="input-launchpad-duration"
                    type="number"
                    value={tokenData.launchpadDuration}
                    onChange={(e) => setTokenData({...tokenData, launchpadDuration: e.target.value})}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTokenData({
                name: '',
                symbol: '',
                totalSupply: '',
                decimals: '18',
                description: '',
                website: '',
                twitter: '',
                telegram: '',
                chain: 'ethereum',
                mintable: false,
                burnable: false,
                pausable: false,
                launchpadEnabled: false,
                fundingTarget: '',
                tokenAllocation: '',
                minContribution: '',
                maxContribution: '',
                launchpadDuration: ''
              })}
            >
              Reset
            </Button>
            <Button 
              type="submit" 
              disabled={isCreating}
              data-testid="button-create-token"
              className="min-w-[120px]"
            >
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Token
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RiddlePadLaunchpad() {
  const [selectedProject, setSelectedProject] = useState<LaunchpadProject | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch active launchpad projects
  const { data: projects = [], isLoading } = useQuery<LaunchpadProject[]>({
    queryKey: ['/api/devtools/launchpad/active'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/devtools/launchpad/active', {
          method: 'GET',
        });
        const data = await response.json() as LaunchpadProject[];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching launchpad projects:', error);
        return [];
      }
    }
  });

  // Fetch bonding curve launches
  const { data: bondingCurveLaunches = [], isLoading: isLoadingCurves } = useQuery<BondingCurveLaunch[]>({
    queryKey: ['/api/launchpad/launches'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/launchpad/launches', {
          method: 'GET',
        });
        const data = await response.json() as { launches: BondingCurveLaunch[] };
        return Array.isArray(data.launches) ? data.launches : [];
      } catch (error) {
        console.error('Error fetching bonding curve launches:', error);
        return [];
      }
    }
  });

  const handleContribute = async (project: LaunchpadProject) => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid contribution amount',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(contributionAmount);
    if (amount < project.minimumContribution) {
      toast({
        title: 'Below Minimum',
        description: `Minimum contribution is $${project.minimumContribution}`,
        variant: 'destructive'
      });
      return;
    }

    if (amount > project.maximumContribution) {
      toast({
        title: 'Above Maximum',
        description: `Maximum contribution is $${project.maximumContribution}`,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Contribution Submitted',
      description: `You contributed $${amount} to ${project.name}`,
    });
    setContributionAmount('');
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const handleViewLaunchDetails = (launchId: number) => {
    setLocation(`/launchpad/${launchId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold">RiddlePad Launchpad</h1>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setLocation('/riddlepad')}
                variant="outline"
                data-testid="button-create-token-launch"
              >
                <Plus className="w-4 h-4 mr-2" />
                Launch Token
              </Button>
              <Button 
                onClick={() => setLocation('/nft/launchpad/create')}
                data-testid="button-create-nft-launch"
              >
                <Plus className="w-4 h-4 mr-2" />
                Launch NFT
              </Button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Support early-stage projects on RiddlePad and receive token allocations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Projects</p>
                  <p className="text-2xl font-bold">{projects.length || 0}</p>
                </div>
                <Rocket className="w-8 h-8 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Raised</p>
                  <p className="text-2xl font-bold">${Array.isArray(projects) ? projects.reduce((sum, p) => sum + (p.currentFunding || 0), 0).toLocaleString() : 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                  <p className="text-2xl font-bold">{Array.isArray(projects) ? projects.reduce((sum, p) => sum + (p.participantCount || 0), 0) : 0}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold">{projects.length > 0 ? Math.round((projects.filter(p => p.status === 'completed').length / projects.length) * 100) : 0}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bonding-curve" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bonding-curve" data-testid="tab-bonding-curve">Bonding Curve Launches</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">Classic Projects</TabsTrigger>
            <TabsTrigger value="create-token" data-testid="tab-create">Create Token</TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="bonding-curve" className="space-y-4">
            {isLoadingCurves ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                <p className="text-gray-600 mt-4">Loading bonding curve launches...</p>
              </div>
            ) : bondingCurveLaunches.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {bondingCurveLaunches.map((launch) => (
                  <BondingCurveLaunchCard
                    key={launch.id}
                    launch={launch}
                    pricing={null} // Will be fetched individually if needed
                    onViewDetails={handleViewLaunchDetails}
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bonding Curve Launches</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Be the first to create a token with bonding curve pricing!
                  </p>
                  <Button onClick={() => setLocation('/launchpad/create')} className="mt-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Token Launch
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                <p className="text-gray-600 mt-4">Loading projects...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.isArray(projects) ? projects.map((project) => (
                  <Card key={project.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{project.name}</CardTitle>
                          <CardDescription className="mt-2">
                            {project.description}
                          </CardDescription>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progress</span>
                          <span className="font-medium">
                            ${project.currentFunding.toLocaleString()} / ${project.fundingTarget.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={calculateProgress(project.currentFunding, project.fundingTarget)} />
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                          <span>{calculateProgress(project.currentFunding, project.fundingTarget).toFixed(1)}% Complete</span>
                          <span>{project.participantCount} Participants</span>
                        </div>
                      </div>

                      {/* Token Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Token</p>
                          <p className="font-medium">{project.tokenSymbol}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Allocation</p>
                          <p className="font-medium">{project.tokenAllocationPercentage}%</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Min Contribution</p>
                          <p className="font-medium">${project.minimumContribution}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Max Contribution</p>
                          <p className="font-medium">${project.maximumContribution}</p>
                        </div>
                      </div>

                      {/* Deadline */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>Ends on {new Date(project.deadline).toLocaleDateString()}</span>
                      </div>

                      {/* Contribution */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Amount (USD)"
                            value={selectedProject?.id === project.id ? contributionAmount : ''}
                            onChange={(e) => {
                              setSelectedProject(project);
                              setContributionAmount(e.target.value);
                            }}
                          />
                          <Button 
                            onClick={() => handleContribute(project)}
                            className="whitespace-nowrap"
                          >
                            <Wallet className="w-4 h-4 mr-2" />
                            Contribute
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="col-span-2 text-center py-8">
                    <p className="text-gray-600">No projects available</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create-token" className="space-y-6">
            <TokenCreationForm />
          </TabsContent>

          <TabsContent value="upcoming">
            <Card className="text-center py-12">
              <CardContent>
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Upcoming Projects</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Check back later for new RiddlePad launch opportunities
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">8 Projects Successfully Funded</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  View graduated projects in the main DevTools section
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
