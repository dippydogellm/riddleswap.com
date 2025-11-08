import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import BondingCurveChart from '@/components/BondingCurveChart';
import LaunchChatRoom from '@/components/LaunchChatRoom';
import LiveStreamBroadcast from '@/components/LiveStreamBroadcast';
import LiveStreamPlayer from '@/components/LiveStreamPlayer';
import { 
  ArrowLeft,
  Rocket, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Star,
  Target,
  Zap,
  Globe,
  Twitter,
  Send,
  Info,
  Activity,
  BarChart3,
  Coins,
  Shield,
  Calendar,
  Video,
  MessageCircle,
  Wallet,
  Percent,
  AlertTriangle
} from 'lucide-react';

interface TokenLaunchDetail {
  id: number;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenLogo: string;
  chainType: string;
  totalSupply: string;
  presaleAmount: string;
  presalePrice: string;
  fundingGoal: string;
  basePrice: string;
  curveCoefficient: string;
  currentTokenPrice: string;
  currentMarketCap: string;
  totalRaised: string;
  participantCount: number;
  useBondingCurve: boolean;
  enableNftGating: boolean;
  nftGatingDuration: number;
  nftHoldersStartTime: string;
  nftHoldersEndTime: string;
  openSaleStartTime: string;
  nftHolderDiscount: string;
  status: string;
  currentStage: string;
  autoLaunchEnabled: boolean;
  autoLaunchTriggered: boolean;
  creatorWallet: string;
  createdAt: string;
  liquidityPercentage: string;
  dexPlatform: string;
}

interface ContributionRecord {
  id: number;
  contributorWallet: string;
  amount: string;
  tokenAmount: string;
  stage: string;
  isNftHolder: boolean;
  nftHolderDiscount: string;
  tokenPriceAtPurchase: string;
  transactionHash: string;
  createdAt: string;
}

interface LaunchStats {
  totalContributions: string;
  contributorCount: number;
  recentContributions: ContributionRecord[];
}

// RiddlePad Fee Structure Component
function FeeStructureSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-orange-500" />
          RiddlePad Fee Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            RiddlePad operates on a transparent fee model to ensure platform sustainability and reward mechanisms.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Curve Completion Fee</h4>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">10%</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">Collected when bonding curve reaches funding goal</p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-green-900 dark:text-green-100">Swap Fee</h4>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">1%</p>
            <p className="text-sm text-green-600 dark:text-green-400">Applied to all token swap transactions</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <Wallet className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div>
            <h5 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Fee Collection</h5>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              All fees are automatically sent to the RiddlePad treasury wallet with transaction memos for full transparency.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Token Information Component
function TokenInfoSection({ launch }: { launch: TokenLaunchDetail }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {launch.tokenLogo && (
            <img 
              src={launch.tokenLogo} 
              alt={launch.tokenName}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <div>
            <CardTitle className="text-2xl">{launch.tokenName}</CardTitle>
            <p className="text-gray-600 font-mono">${launch.tokenSymbol}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
        <div>
          <h4 className="font-medium mb-2">Description</h4>
          <p className="text-gray-600 leading-relaxed">
            {launch.tokenDescription || 'No description provided for this token launch.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">Total Supply</p>
              <p className="font-medium">{parseFloat(launch.totalSupply).toLocaleString()} {launch.tokenSymbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Current Price</p>
              <p className="font-medium">${parseFloat(launch.currentTokenPrice).toFixed(6)} XRP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Market Cap</p>
              <p className="font-medium">${parseFloat(launch.currentMarketCap).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {launch.useBondingCurve && (
          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              This token uses a bonding curve pricing model. The price automatically increases as more tokens are purchased, creating a fair launch mechanism.
            </AlertDescription>
          </Alert>
        )}

        {launch.enableNftGating && (
          <Alert>
            <Star className="h-4 w-4" />
            <AlertDescription>
              NFT holders get priority access and {launch.nftHolderDiscount}% discount during the initial phase.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Launch Progress Component
function LaunchProgressSection({ launch, stats }: { launch: TokenLaunchDetail; stats: LaunchStats | undefined }) {
  const raised = parseFloat(launch.totalRaised);
  const goal = parseFloat(launch.fundingGoal);
  const progress = goal > 0 ? (raised / goal) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          Launch Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Funding Progress</span>
            <span className="text-sm font-medium">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-600">{raised.toFixed(2)} XRP raised</span>
            <span className="text-gray-600">Goal: {goal.toFixed(2)} XRP</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-600">Contributors</span>
            </div>
            <p className="text-lg font-bold">{launch.participantCount}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600">Total Raised</span>
            </div>
            <p className="text-lg font-bold">{raised.toFixed(2)} XRP</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-gray-600">Avg. Size</span>
            </div>
            <p className="text-lg font-bold">
              {launch.participantCount > 0 ? (raised / launch.participantCount).toFixed(2) : '0'} XRP
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Rocket className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-gray-600">Stage</span>
            </div>
            <p className="text-lg font-bold capitalize">{launch.currentStage.replace('_', ' ')}</p>
          </div>
        </div>

        {launch.autoLaunchTriggered && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              🎉 Funding goal reached! Auto-launch has been triggered and liquidity will be created on {launch.dexPlatform}.
              <br /><strong>Note:</strong> A 10% curve completion fee has been collected as part of the RiddlePad fee structure.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Fee Warning for Near Completion */}
        {progress >= 90 && !launch.autoLaunchTriggered && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              ⚠️ <strong>Approaching Goal:</strong> When the funding goal is reached, a 10% curve completion fee will be automatically collected from the total raised amount.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Contributions Component
function RecentContributionsSection({ contributions }: { contributions: ContributionRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          Recent Contributions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contributions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No contributions yet</p>
        ) : (
          <div className="space-y-3">
            {contributions.map((contribution) => (
              <div key={contribution.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium font-mono text-sm">
                      {contribution.contributorWallet.slice(0, 6)}...{contribution.contributorWallet.slice(-4)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{new Date(contribution.createdAt).toLocaleString()}</span>
                      {contribution.isNftHolder && (
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          <Star className="h-2 w-2 mr-1" />
                          NFT
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs h-4 px-1 capitalize">
                        {contribution.stage.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{parseFloat(contribution.amount).toFixed(2)} XRP</p>
                  <p className="text-xs text-gray-600">
                    {parseFloat(contribution.tokenAmount).toFixed(2)} tokens
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Investment Component
function InvestmentSection({ launch }: { launch: TokenLaunchDetail }) {
  const [amount, setAmount] = useState('');
  const [isInvesting, setIsInvesting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch fee configuration
  const { data: feeConfig } = useQuery({
    queryKey: ['/api/launchpad/fee-config'],
    enabled: true
  });

  const investMutation = useMutation({
    mutationFn: async (investmentData: { amount: string; transactionHash: string }) => {
      const response = await apiRequest(`/api/launchpad/contribute/${launch.id}`, {
        method: 'POST',
        body: JSON.stringify(investmentData),
      });
      if (!response.ok) throw new Error('Investment failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Investment Successful!',
        description: 'Your contribution has been recorded and tokens allocated.',
      });
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['token-launch', launch.id] });
    },
    onError: (error: any) => {
      toast({
        title: 'Investment Failed',
        description: error.message || 'Failed to process investment',
        variant: 'destructive',
      });
    },
  });

  const handleInvest = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid investment amount',
        variant: 'destructive',
      });
      return;
    }

    // In a real implementation, this would trigger wallet connection and transaction
    setIsInvesting(true);
    setTimeout(() => {
      investMutation.mutate({
        amount,
        transactionHash: `0x${Math.random().toString(16).slice(2)}` // Mock transaction hash
      });
      setIsInvesting(false);
    }, 2000);
  };

  const estimatedTokens = amount ? 
    (parseFloat(amount) / parseFloat(launch.currentTokenPrice)).toFixed(2) : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-green-500" />
          Invest in {launch.tokenSymbol}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Investment Fee Notice */}
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Trading Fee Notice:</strong> A 1% swap fee will be applied to your investment transaction as part of the RiddlePad platform fee structure.
          </AlertDescription>
        </Alert>
        
        <div>
          <label className="block text-sm font-medium mb-2">Investment Amount (XRP)</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter XRP amount"
            disabled={launch.status !== 'active' || isInvesting}
            data-testid="input-investment-amount"
          />
        </div>

        {amount && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span>Investment amount:</span>
                <p className="font-medium text-gray-900">
                  {amount || '0'} XRP
                </p>
              </div>
              <div>
                <span>Swap fee (1%):</span>
                <p className="font-medium text-red-600">
                  -{amount ? (parseFloat(amount) * 0.01).toFixed(4) : '0'} XRP
                </p>
              </div>
              <div>
                <span>Net investment:</span>
                <p className="font-medium text-gray-900">
                  {amount ? (parseFloat(amount) * 0.99).toFixed(4) : '0'} XRP
                </p>
              </div>
              <div>
                <span>You'll receive:</span>
                <p className="font-medium text-green-600">
                  {amount ? ((parseFloat(amount) * 0.99) / parseFloat(launch.currentTokenPrice)).toFixed(4) : '0'} {launch.tokenSymbol}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span>Token price:</span>
              <span className="font-medium">${parseFloat(launch.currentTokenPrice).toFixed(6)} XRP</span>
            </div>
          </div>
        )}

        <Button 
          onClick={handleInvest}
          disabled={!amount || launch.status !== 'active' || isInvesting}
          className="w-full"
          data-testid="button-invest"
        >
          {isInvesting ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing Investment...
            </div>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Invest {amount ? `${amount} XRP` : 'Now'}
            </>
          )}
        </Button>

        {launch.status !== 'active' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This token launch is not currently active for investments.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Launch Timing Component
function LaunchTimingSection({ launch }: { launch: TokenLaunchDetail }) {
  const now = new Date();
  const nftStart = launch.nftHoldersStartTime ? new Date(launch.nftHoldersStartTime) : null;
  const nftEnd = launch.nftHoldersEndTime ? new Date(launch.nftHoldersEndTime) : null;
  const publicStart = launch.openSaleStartTime ? new Date(launch.openSaleStartTime) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-purple-500" />
          Launch Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {launch.enableNftGating && nftStart && nftEnd && (
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-purple-500" />
              <span className="font-medium">NFT Holders Phase</span>
              {now >= nftStart && now <= nftEnd && (
                <Badge variant="default" className="bg-purple-500">ACTIVE</Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Start: {nftStart.toLocaleString()}</p>
              <p>End: {nftEnd.toLocaleString()}</p>
              <p>Duration: {Math.round((nftEnd.getTime() - nftStart.getTime()) / (1000 * 60 * 60))} hours</p>
              <p>Discount: {launch.nftHolderDiscount}% off regular price</p>
            </div>
          </div>
        )}

        {publicStart && (
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-green-500" />
              <span className="font-medium">Public Sale Phase</span>
              {now >= publicStart && (
                <Badge variant="default" className="bg-green-500">ACTIVE</Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Start: {publicStart.toLocaleString()}</p>
              <p>Open to all participants</p>
            </div>
          </div>
        )}

        {launch.autoLaunchEnabled && (
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Auto-Launch</span>
              {launch.autoLaunchTriggered && (
                <Badge variant="default" className="bg-orange-500">TRIGGERED</Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Triggers when funding goal is reached</p>
              <p>Liquidity: {launch.liquidityPercentage}% on {launch.dexPlatform}</p>
              <p>Status: {launch.autoLaunchTriggered ? 'Triggered' : 'Waiting for goal'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TokenLaunchDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'stream' | 'chat'>('stream');
  const [isStreaming, setIsStreaming] = useState(false);
  const launchId = parseInt(id!);

  // Get user session for chat
  const getCurrentUser = () => {
    // Try to get session from localStorage or use demo data
    const savedSession = localStorage.getItem('wallet-session');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        if (parsedSession.wallet && parsedSession.sessionToken) {
          return {
            wallet: parsedSession.wallet,
            sessionToken: parsedSession.sessionToken,
            handle: parsedSession.handle || `${parsedSession.wallet.slice(0, 6)}...${parsedSession.wallet.slice(-4)}`
          };
        }
      } catch (error) {
        console.error('❌ Error parsing session:', error);
      }
    }
    
    // Fallback demo session for testing
    return {
      wallet: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      sessionToken: 'demo-session-' + Math.random().toString(36).substr(2, 9),
      handle: 'Demo User'
    };
  };
  
  const currentUser = getCurrentUser();

  // Fetch launch details
  const { data: launch, isLoading, error } = useQuery({
    queryKey: ['token-launch', launchId],
    queryFn: async () => {
      const response = await apiRequest(`/api/launchpad/launch/${launchId}`);
      if (!response.ok) throw new Error('Failed to fetch launch details');
      return response.json() as { launch: TokenLaunchDetail; stats: LaunchStats };
    },
    enabled: !!launchId && !isNaN(launchId),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !launch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Launch Not Found</h2>
            <p className="text-gray-600 mb-4">
              The token launch you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => setLocation('/riddlepad')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Launches
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { launch: launchDetails, stats } = launch;

  // Determine if current user is the creator
  const isCreator = currentUser.wallet === launchDetails.creatorWallet;

  // Handle stream state changes
  const handleStreamStateChange = (streaming: boolean, streamId?: string) => {
    setIsStreaming(streaming);
    if (streaming && streamId) {
      console.log('🎥 Stream started:', streamId);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => setLocation('/riddlepad')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Launches
        </Button>
        <h1 className="text-2xl font-bold">Token Launch Details</h1>
        {isStreaming && (
          <Badge variant="destructive" className="animate-pulse">
            🔴 LIVE
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Information */}
          <TokenInfoSection launch={launchDetails} />
          
          {/* Fee Structure */}
          <FeeStructureSection />

          {/* Chart */}
          <BondingCurveChart
            launchId={launchDetails.id}
            tokenSymbol={launchDetails.tokenSymbol}
            fundingGoal={launchDetails.fundingGoal}
            useBondingCurve={launchDetails.useBondingCurve}
            height={500}
            showFullControls={true}
          />

          {/* Recent Contributions */}
          <RecentContributionsSection contributions={stats.recentContributions || []} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Launch Progress */}
          <LaunchProgressSection launch={launchDetails} stats={stats} />

          {/* Investment Section */}
          <InvestmentSection launch={launchDetails} />

          {/* Launch Timing */}
          <LaunchTimingSection launch={launchDetails} />
        </div>

        {/* Stream & Chat Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Community Hub</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={activeTab === 'stream' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('stream')}
                      className="px-2 py-1 h-8"
                      data-testid="button-tab-stream"
                    >
                      <Video className="h-3 w-3 mr-1" />
                      Stream
                      {isStreaming && (
                        <div className="w-2 h-2 bg-red-500 rounded-full ml-1 animate-pulse"></div>
                      )}
                    </Button>
                    <Button
                      variant={activeTab === 'chat' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('chat')}
                      className="px-2 py-1 h-8"
                      data-testid="button-tab-chat"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Chat
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                {activeTab === 'stream' && (
                  <div className="p-4">
                    {isCreator ? (
                      <LiveStreamBroadcast
                        launchId={launchDetails.id}
                        creatorWallet={launchDetails.creatorWallet}
                        onStreamStateChange={handleStreamStateChange}
                        className="w-full"
                      />
                    ) : (
                      <LiveStreamPlayer
                        launchId={launchDetails.id}
                        currentUser={currentUser}
                        className="w-full"
                      />
                    )}
                  </div>
                )}
                
                {activeTab === 'chat' && (
                  <LaunchChatRoom
                    launchId={launchDetails.id}
                    currentUser={currentUser}
                    isCollapsed={false}
                    onToggleCollapse={() => {}}
                    className="w-full border-0 shadow-none"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
