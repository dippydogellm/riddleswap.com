import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Clock, 
  Users, 
  Target, 
  Coins, 
  TrendingUp,
  Timer,
  Star,
  Shield,
  CheckCircle,
  ExternalLink,
  Rocket,
  AlertCircle,
  Copy,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ChainLogo } from "@/components/ChainLogo";
import { getChainInfo } from "@/utils/chains";

interface TokenLaunch {
  id: number;
  creatorWallet: string;
  chainType: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenLogo: string;
  totalSupply: string;
  presaleAmount: string;
  presalePrice: string;
  liquidityThreshold: string;
  softCap: string;
  hardCap: string;
  setupFeePaid: boolean;
  status: string;
  currentStage: string;
  totalRaised: string;
  fundingGoal: string;
  participantCount: number;
  whitelistStartTime: string;
  whitelistEndTime: string;
  nftHoldersStartTime: string;
  nftHoldersEndTime: string;
  openWlStartTime: string;
  openWlEndTime: string;
  openSaleStartTime: string;
  openSaleEndTime: string;
  // Deployment-related fields
  autoLaunchEnabled: boolean;
  autoLaunchTriggered: boolean;
  contractAddress?: string;
  autoLaunchTransaction?: string;
  createdAt: string;
}

interface LaunchpadCardProps {
  launch: TokenLaunch;
}

export function LaunchpadCard({ launch }: LaunchpadCardProps) {
  const [contributionAmount, setContributionAmount] = useState("");
  const [showContributeForm, setShowContributeForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Deployment status mutation
  const deployToken = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/launchpad/deploy/${launch.id}`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Deployment Started!",
        description: `Token deployment initiated on ${launch.chainType}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/launches'] });
    },
    onError: (error: any) => {
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy token",
        variant: "destructive",
      });
    }
  });

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  // Check if launch is eligible for graduation/deployment
  const isGraduationEligible = () => {
    const totalRaised = parseFloat(launch.totalRaised || "0");
    const fundingGoal = parseFloat(launch.fundingGoal || launch.hardCap || "0");
    return totalRaised >= fundingGoal && launch.status === "active";
  };

  // Get deployment status display
  const getDeploymentStatus = () => {
    if (launch.autoLaunchTriggered && launch.contractAddress) {
      return { status: "deployed", label: "Deployed", color: "bg-green-500" };
    } else if (isGraduationEligible() && launch.autoLaunchEnabled) {
      return { status: "ready", label: "Ready to Deploy", color: "bg-yellow-500" };
    } else if (launch.autoLaunchEnabled) {
      return { status: "pending", label: "Auto-Deploy Enabled", color: "bg-blue-500" };
    } else {
      return { status: "manual", label: "Manual Deploy Only", color: "bg-gray-500" };
    }
  };


  const getStageInfo = (stage: string) => {
    const stages = {
      setup: { label: "Setup", color: "bg-gray-500", description: "Initial setup phase" },
      whitelist: { label: "Whitelist", color: "bg-blue-500", description: "Whitelist members only" },
      nft_holders: { label: "NFT Holders", color: "bg-purple-500", description: "NFT holders priority" },
      open_wl: { label: "Open WL", color: "bg-orange-500", description: "Open whitelist" },
      open_sale: { label: "Open Sale", color: "bg-green-500", description: "Public sale" },
      completed: { label: "Completed", color: "bg-green-600", description: "Launch completed" }
    };
    return stages[stage as keyof typeof stages] || stages.setup;
  };

  const getTimeRemaining = (endTime: string) => {
    if (!endTime) return null;
    
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getCurrentPhaseEndTime = () => {
    switch (launch.currentStage) {
      case "whitelist": return launch.whitelistEndTime;
      case "nft_holders": return launch.nftHoldersEndTime;
      case "open_wl": return launch.openWlEndTime;
      case "open_sale": return launch.openSaleEndTime;
      default: return null;
    }
  };

  const progressPercentage = Math.min(
    (parseFloat(launch.totalRaised) / parseFloat(launch.hardCap)) * 100,
    100
  );

  const isLive = ["whitelist", "nft_holders", "open_wl", "open_sale"].includes(launch.currentStage);
  const canContribute = isLive && parseFloat(launch.totalRaised) < parseFloat(launch.hardCap);

  const contributeToLaunch = useMutation({
    mutationFn: async ({ amount }: { amount: string }) => {
      return apiRequest(`/api/launchpad/contribute/${launch.id}`, {
        method: 'POST',
        body: JSON.stringify({
          contributorWallet: "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo", // User wallet
          amount,
          stage: launch.currentStage,
          transactionHash: `mock_${Date.now()}`, // TODO: Real transaction
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Contribution Successful!",
        description: `Successfully contributed ${contributionAmount} ${getChainInfo(launch.chainType)?.nativeCurrency || 'tokens'} to ${launch.tokenName}`,
      });
      setContributionAmount("");
      setShowContributeForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/launches'] });
    },
    onError: (error: any) => {
      toast({
        title: "Contribution Failed",
        description: error.message || "Failed to contribute to launch",
        variant: "destructive",
      });
    }
  });

  const handleContribute = () => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid contribution amount",
        variant: "destructive",
      });
      return;
    }

    contributeToLaunch.mutate({ amount: contributionAmount });
  };

  const stageInfo = getStageInfo(launch.currentStage);
  const timeRemaining = getCurrentPhaseEndTime() ? getTimeRemaining(getCurrentPhaseEndTime()!) : null;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {launch.tokenLogo && (
              <img 
                src={launch.tokenLogo} 
                alt={`${launch.tokenName} logo`} 
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <CardTitle className="text-lg">{launch.tokenName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">${launch.tokenSymbol}</Badge>
                <ChainLogo 
                  chainId={launch.chainType} 
                  size="sm" 
                  data-testid={`chain-logo-${launch.chainType}`}
                />
                <span className="text-sm text-muted-foreground capitalize">{launch.chainType}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge className={stageInfo.color}>
              {stageInfo.label}
            </Badge>
            {isLive && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Timer className="h-3 w-3" />
                {timeRemaining || "Live"}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        {launch.tokenDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {launch.tokenDescription}
          </p>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {parseFloat(launch.totalRaised).toFixed(0)} / {parseFloat(launch.hardCap).toFixed(0)} {getChainInfo(launch.chainType)?.nativeCurrency || 'tokens'}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressPercentage.toFixed(1)}% raised</span>
            <span>Soft Cap: {launch.softCap} {getChainInfo(launch.chainType)?.nativeCurrency || 'tokens'}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" />
              Participants
            </div>
            <div className="font-medium">{launch.participantCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Coins className="h-3 w-3" />
              Price
            </div>
            <div className="font-medium">{launch.presalePrice} {getChainInfo(launch.chainType)?.nativeCurrency || 'tokens'}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Target className="h-3 w-3" />
              Supply
            </div>
            <div className="font-medium">{parseFloat(launch.presaleAmount).toLocaleString()}</div>
          </div>
        </div>

        {/* Deployment Status */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span className="text-sm font-medium">Token Deployment</span>
            </div>
            <Badge className={`${getDeploymentStatus().color} text-white`}>
              {getDeploymentStatus().label}
            </Badge>
          </div>

          {/* Chain Information */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Chain Type</div>
              <div className="font-medium">{getChainInfo(launch.chainType)?.type || 'Unknown'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Avg Block Time</div>
              <div className="font-medium">{getChainInfo(launch.chainType)?.blockTime || 'N/A'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Est. Deploy Fee</div>
              <div className="font-medium">{getChainInfo(launch.chainType)?.avgFee || 'N/A'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Security Level</div>
              <div className="font-medium flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {getChainInfo(launch.chainType)?.security || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Contract Address (if deployed) */}
          {launch.contractAddress && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Contract Address</div>
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <code className="text-xs font-mono flex-1 truncate">
                  {launch.contractAddress}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(launch.contractAddress!, "Contract address")}
                  className="h-6 w-6 p-0"
                  data-testid={`button-copy-contract-${launch.id}`}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Transaction Hash (if deployed) */}
          {launch.autoLaunchTransaction && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Deployment Transaction</div>
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <code className="text-xs font-mono flex-1 truncate">
                  {launch.autoLaunchTransaction}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(launch.autoLaunchTransaction!, "Transaction hash")}
                  className="h-6 w-6 p-0"
                  data-testid={`button-copy-tx-${launch.id}`}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Chain-specific notes */}
          {/* getChainInfo(launch.chainType)?.note && (
            <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-2 border-yellow-400">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                {getChainInfo(launch.chainType)?.note}
              </div>
            </div>
          ) */}

          {/* Manual Deploy Button (if eligible and not auto-triggered) */}
          {isGraduationEligible() && !launch.autoLaunchTriggered && !launch.autoLaunchEnabled && (
            <Button 
              onClick={() => deployToken.mutate()}
              disabled={deployToken.isPending}
              className="w-full text-sm"
              variant="outline"
              data-testid={`button-deploy-manual-${launch.id}`}
            >
              {deployToken.isPending ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy Token Manually
                </>
              )}
            </Button>
          )}

          {/* Auto-launch status indicator */}
          {launch.autoLaunchEnabled && !launch.autoLaunchTriggered && (
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <Activity className="h-3 w-3" />
              {isGraduationEligible() ? 
                "Auto-deployment will trigger automatically" : 
                `Auto-deployment enabled - triggers at ${launch.fundingGoal || launch.hardCap} ${getChainInfo(launch.chainType)?.nativeCurrency || 'tokens'}`
              }
            </div>
          )}

          {/* Completion indicator */}
          {launch.autoLaunchTriggered && launch.contractAddress && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              Token successfully deployed on {launch.chainType} blockchain
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Link href={`/launchpad/${launch.id}`} className="flex-1">
            <Button variant="outline" className="w-full text-sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Link>
          
          {canContribute && (
            <Button 
              onClick={() => setShowContributeForm(true)}
              className="flex-1 text-sm"
              disabled={!isLive}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Contribute
            </Button>
          )}
        </div>

        {/* Contribution Form */}
        {showContributeForm && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Contribute to {launch.tokenName}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowContributeForm(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={`Amount in ${getChainInfo(launch.chainType)?.nativeCurrency || 'tokens'}`}
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                className="text-sm"
                data-testid={`input-contribute-${launch.id}`}
              />
              <Button 
                onClick={handleContribute}
                disabled={contributeToLaunch.isPending}
                size="sm"
                data-testid={`button-contribute-${launch.id}`}
              >
                {contributeToLaunch.isPending ? "..." : "Buy"}
              </Button>
            </div>
            {contributionAmount && (
              <div className="text-xs text-muted-foreground">
                You'll receive ~{(parseFloat(contributionAmount) / parseFloat(launch.presalePrice)).toFixed(0)} {launch.tokenSymbol}
              </div>
            )}
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs">
          {launch.setupFeePaid && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3 w-3" />
              Verified
            </div>
          )}
          {parseFloat(launch.totalRaised) >= parseFloat(launch.softCap) && (
            <div className="flex items-center gap-1 text-blue-600">
              <Shield className="h-3 w-3" />
              Soft Cap Met
            </div>
          )}
          {parseFloat(launch.totalRaised) >= parseFloat(launch.liquidityThreshold) && (
            <div className="flex items-center gap-1 text-purple-600">
              <Star className="h-3 w-3" />
              Liquidity Ready
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
