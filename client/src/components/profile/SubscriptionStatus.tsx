import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Crown, 
  Zap, 
  ArrowUpRight, 
  CheckCircle, 
  AlertTriangle,
  Infinity,
  Shield,
  Star
} from 'lucide-react';
import { useLocation } from 'wouter';

interface SubscriptionInfo {
  tier: 'free' | 'bronze' | 'gold';
  verified: boolean;
  overrideCount: number;
  maxOverrides: number;
  apiCallsUsed: number;
  maxApiCalls: number;
  expiresAt?: string;
  status: 'active' | 'expired' | 'cancelled';
}

interface SubscriptionStatusProps {
  subscription?: SubscriptionInfo | null;
  className?: string;
  compact?: boolean;
}

export function SubscriptionStatus({ subscription, className, compact = false }: SubscriptionStatusProps) {
  const [, setLocation] = useLocation();

  // Default to free tier if no subscription data
  const currentTier = subscription?.tier || 'free';
  const isVerified = subscription?.verified || false;
  const overrideUsage = subscription ? (subscription.overrideCount / subscription.maxOverrides) * 100 : 0;
  const apiUsage = subscription ? (subscription.apiCallsUsed / subscription.maxApiCalls) * 100 : 0;

  const tierConfig = {
    free: {
      name: 'Free',
      icon: Zap,
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      borderColor: 'border-slate-200 dark:border-slate-700',
      features: ['Basic project viewing', 'Limited API access'],
      limitations: ['No profile overrides', 'No custom branding', 'No verification badge']
    },
    bronze: {
      name: 'Bronze',
      icon: Zap,
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      borderColor: 'border-amber-300 dark:border-amber-700',
      features: ['Profile overrides', 'Custom branding', 'Priority support'],
      limitations: ['No verification badge']
    },
    gold: {
      name: 'Gold',
      icon: Crown,
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      borderColor: 'border-yellow-400 dark:border-yellow-600',
      features: ['Everything in Bronze', 'Verification badge eligible', 'Advanced analytics', 'Premium support'],
      limitations: []
    }
  };

  const config = tierConfig[currentTier];

  const handleUpgrade = () => {
    setLocation('/subscription-plans');
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <Badge className={config.color}>
          <config.icon className="w-3 h-3 mr-1" />
          {config.name}
        </Badge>
        {isVerified && (
          <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        )}
        {currentTier === 'free' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpgrade}
            className="text-xs"
          >
            Upgrade
            <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={`${config.borderColor} ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <config.icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>{config.name} Plan</span>
                {isVerified && (
                  <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {subscription?.status === 'expired' ? (
                  <span className="text-red-600">Subscription expired</span>
                ) : subscription?.status === 'cancelled' ? (
                  <span className="text-amber-600">Subscription cancelled</span>
                ) : subscription?.expiresAt ? (
                  `Active until ${new Date(subscription.expiresAt).toLocaleDateString()}`
                ) : (
                  'Current subscription plan'
                )}
              </CardDescription>
            </div>
          </div>
          
          {(currentTier === 'free' || subscription?.status !== 'active') && (
            <Button
              onClick={handleUpgrade}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {currentTier === 'free' ? 'Upgrade Now' : 'Renew Plan'}
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Usage Statistics */}
        {subscription && currentTier !== 'free' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Profile Overrides</span>
                <span className="font-medium">
                  {subscription.overrideCount} / {subscription.maxOverrides === -1 ? '∞' : subscription.maxOverrides}
                </span>
              </div>
              <Progress 
                value={subscription.maxOverrides === -1 ? 0 : overrideUsage} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">API Calls (Monthly)</span>
                <span className="font-medium">
                  {subscription.apiCallsUsed.toLocaleString()} / {subscription.maxApiCalls === -1 ? '∞' : subscription.maxApiCalls.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={subscription.maxApiCalls === -1 ? 0 : apiUsage} 
                className="h-2"
              />
            </div>
          </div>
        )}

        {/* Plan Features */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100">Plan Features</h4>
          <div className="space-y-2">
            {config.features.map((feature, index) => (
              <div key={index} className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">{feature}</span>
              </div>
            ))}
            
            {config.limitations.map((limitation, index) => (
              <div key={index} className="flex items-center text-sm opacity-60">
                <AlertTriangle className="w-4 h-4 text-slate-400 mr-3 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{limitation}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Prompt for Free Users */}
        {currentTier === 'free' && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <Star className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Unlock Advanced Features
                </h5>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Get profile overrides, custom branding, and verification eligibility with a paid plan.
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

        {/* Gold Plan Verification Prompt */}
        {currentTier === 'gold' && !isVerified && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-medium text-green-900 dark:text-green-100 mb-1">
                  Get Verified
                </h5>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  You're eligible for a verification badge. Complete the verification process to publish your profile overrides.
                </p>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                >
                  Start Verification
                  <CheckCircle className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
