import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Zap, 
  Crown,
  TrendingUp,
  Clock,
  Database,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  Infinity
} from 'lucide-react';
import { useLocation } from 'wouter';

interface UsageData {
  overrides: {
    used: number;
    limit: number;
    percentage: number;
  };
  apiCalls: {
    used: number;
    limit: number;
    percentage: number;
    resetDate: string;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
    unit: 'MB' | 'GB';
  };
  bandwidth: {
    used: number;
    limit: number;
    percentage: number;
    unit: 'GB';
  };
  subscription: {
    tier: 'free' | 'bronze' | 'gold';
    verified: boolean;
    status: 'active' | 'expired' | 'cancelled';
    renewalDate?: string;
  };
}

interface UsageTrackerProps {
  projectId?: string;
  className?: string;
  compact?: boolean;
}

export function UsageTracker({ projectId, className, compact = false }: UsageTrackerProps) {
  const [, setLocation] = useLocation();

  // Fetch usage data
  const { data: usage, isLoading, error } = useQuery<UsageData>({
    queryKey: projectId 
      ? ['/api/subscriptions/usage', projectId]
      : ['/api/subscriptions/usage'],
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleUpgrade = () => {
    setLocation('/subscription-plans');
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !usage) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Unable to load usage data
          </p>
        </CardContent>
      </Card>
    );
  }

  const isUnlimited = (limit: number) => limit === -1;
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-amber-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Usage Overview</h4>
            <Badge variant={usage.subscription.tier === 'free' ? 'secondary' : 'default'}>
              {usage.subscription.tier === 'free' && <Zap className="w-3 h-3 mr-1" />}
              {usage.subscription.tier === 'bronze' && <Zap className="w-3 h-3 mr-1" />}
              {usage.subscription.tier === 'gold' && <Crown className="w-3 h-3 mr-1" />}
              {usage.subscription.tier.charAt(0).toUpperCase() + usage.subscription.tier.slice(1)}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Overrides</span>
              <span className={getUsageColor(usage.overrides.percentage)}>
                {usage.overrides.used}/{isUnlimited(usage.overrides.limit) ? '∞' : usage.overrides.limit}
              </span>
            </div>
            <Progress 
              value={isUnlimited(usage.overrides.limit) ? 0 : usage.overrides.percentage} 
              className="h-1.5"
            />
            
            <div className="flex items-center justify-between text-xs">
              <span>API Calls</span>
              <span className={getUsageColor(usage.apiCalls.percentage)}>
                {usage.apiCalls.used.toLocaleString()}/{isUnlimited(usage.apiCalls.limit) ? '∞' : usage.apiCalls.limit.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={isUnlimited(usage.apiCalls.limit) ? 0 : usage.apiCalls.percentage} 
              className="h-1.5"
            />
          </div>
          
          {(usage.overrides.percentage > 80 || usage.apiCalls.percentage > 80) && usage.subscription.tier !== 'gold' && (
            <Button size="sm" variant="outline" onClick={handleUpgrade} className="w-full mt-3">
              Upgrade for More
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Usage & Limits</span>
            </CardTitle>
            <CardDescription>
              Track your subscription usage and limits
              {projectId && ' for this project'}
            </CardDescription>
          </div>
          <Badge variant={usage.subscription.tier === 'free' ? 'secondary' : 'default'} className="text-sm">
            {usage.subscription.tier === 'free' && <Zap className="w-4 h-4 mr-1" />}
            {usage.subscription.tier === 'bronze' && <Zap className="w-4 h-4 mr-1" />}
            {usage.subscription.tier === 'gold' && <Crown className="w-4 h-4 mr-1" />}
            {usage.subscription.tier.charAt(0).toUpperCase() + usage.subscription.tier.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Profile Overrides */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span className="font-medium">Profile Overrides</span>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usage.overrides.percentage)}`}>
                {usage.overrides.used} / {isUnlimited(usage.overrides.limit) ? (
                  <span className="flex items-center">
                    <Infinity className="w-4 h-4" />
                  </span>
                ) : (
                  usage.overrides.limit
                )}
              </div>
              {!isUnlimited(usage.overrides.limit) && (
                <div className="text-xs text-slate-500">
                  {usage.overrides.percentage.toFixed(0)}% used
                </div>
              )}
            </div>
          </div>
          <Progress 
            value={isUnlimited(usage.overrides.limit) ? 0 : usage.overrides.percentage}
            className="h-2"
          />
          {usage.overrides.percentage > 90 && !isUnlimited(usage.overrides.limit) && (
            <div className="flex items-center text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4 mr-1" />
              <span>Approaching limit</span>
            </div>
          )}
        </div>

        {/* API Calls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              <span className="font-medium">API Calls (Monthly)</span>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usage.apiCalls.percentage)}`}>
                {usage.apiCalls.used.toLocaleString()} / {isUnlimited(usage.apiCalls.limit) ? (
                  <span className="flex items-center">
                    <Infinity className="w-4 h-4" />
                  </span>
                ) : (
                  usage.apiCalls.limit.toLocaleString()
                )}
              </div>
              {!isUnlimited(usage.apiCalls.limit) && (
                <div className="text-xs text-slate-500">
                  {usage.apiCalls.percentage.toFixed(0)}% used
                </div>
              )}
            </div>
          </div>
          <Progress 
            value={isUnlimited(usage.apiCalls.limit) ? 0 : usage.apiCalls.percentage}
            className="h-2"
          />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              <span>Resets {new Date(usage.apiCalls.resetDate).toLocaleDateString()}</span>
            </div>
            {usage.apiCalls.percentage > 90 && !isUnlimited(usage.apiCalls.limit) && (
              <div className="flex items-center text-amber-600">
                <AlertTriangle className="w-3 h-3 mr-1" />
                <span>Approaching limit</span>
              </div>
            )}
          </div>
        </div>

        {/* Storage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span className="font-medium">Storage Used</span>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usage.storage.percentage)}`}>
                {usage.storage.used} {usage.storage.unit} / {isUnlimited(usage.storage.limit) ? (
                  <span className="flex items-center">
                    <Infinity className="w-4 h-4" />
                  </span>
                ) : (
                  `${usage.storage.limit} ${usage.storage.unit}`
                )}
              </div>
              {!isUnlimited(usage.storage.limit) && (
                <div className="text-xs text-slate-500">
                  {usage.storage.percentage.toFixed(0)}% used
                </div>
              )}
            </div>
          </div>
          <Progress 
            value={isUnlimited(usage.storage.limit) ? 0 : usage.storage.percentage}
            className="h-2"
          />
        </div>

        {/* Subscription Status */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Subscription Status</span>
            <div className="flex items-center space-x-2">
              {usage.subscription.verified && (
                <Badge variant="outline" className="text-green-600 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
              <Badge variant={usage.subscription.status === 'active' ? 'default' : 'destructive'}>
                {usage.subscription.status}
              </Badge>
            </div>
          </div>
          
          {usage.subscription.renewalDate && (
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              {usage.subscription.status === 'active' ? 'Renews' : 'Expired'} on{' '}
              {new Date(usage.subscription.renewalDate).toLocaleDateString()}
            </div>
          )}

          {/* Upgrade Suggestions */}
          {(usage.overrides.percentage > 80 || usage.apiCalls.percentage > 80 || usage.subscription.tier === 'free') && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    {usage.subscription.tier === 'free' ? 'Upgrade Your Plan' : 'Consider Upgrading'}
                  </h5>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    {usage.subscription.tier === 'free' 
                      ? 'Get unlimited overrides and API calls with a paid subscription.'
                      : 'Get unlimited usage and avoid hitting limits with Gold plan.'
                    }
                  </p>
                  <Button 
                    size="sm" 
                    onClick={handleUpgrade}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    View Plans
                    <ArrowUpRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
