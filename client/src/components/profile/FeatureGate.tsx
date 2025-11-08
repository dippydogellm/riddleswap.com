import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Crown, 
  Zap, 
  Shield, 
  Lock, 
  ArrowUpRight,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useLocation } from 'wouter';

interface SubscriptionInfo {
  tier: 'free' | 'bronze' | 'gold';
  verified: boolean;
  overrideCount: number;
  maxOverrides: number;
  apiCallsUsed: number;
  maxApiCalls: number;
  status: 'active' | 'expired' | 'cancelled';
}

interface FeatureGateProps {
  children: ReactNode;
  requiredTier?: 'free' | 'bronze' | 'gold';
  requiresVerification?: boolean;
  featureName: string;
  description?: string;
  fallback?: ReactNode;
  compact?: boolean;
}

interface FeatureConfig {
  name: string;
  icon: any;
  color: string;
  upgradeText: string;
}

const tierConfigs: Record<string, FeatureConfig> = {
  bronze: {
    name: 'Bronze',
    icon: Zap,
    color: 'text-amber-600',
    upgradeText: 'Upgrade to Bronze'
  },
  gold: {
    name: 'Gold',
    icon: Crown,
    color: 'text-yellow-600',
    upgradeText: 'Upgrade to Gold'
  }
};

export function FeatureGate({
  children,
  requiredTier = 'free',
  requiresVerification = false,
  featureName,
  description,
  fallback,
  compact = false
}: FeatureGateProps) {
  const [, setLocation] = useLocation();

  // Get subscription status
  const { data: subscription, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ['/api/subscriptions/status'],
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleUpgrade = () => {
    setLocation('/subscription-plans');
  };

  const handleVerification = () => {
    setLocation('/devtools/verification');
  };

  // Helper function to check if tier meets requirement
  const checkTierRequirement = (currentTier: string, requiredTier: string): boolean => {
    const tierLevels = { free: 0, bronze: 1, gold: 2 };
    return tierLevels[currentTier as keyof typeof tierLevels] >= tierLevels[requiredTier as keyof typeof tierLevels];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const isVerified = subscription?.verified || false;
  const tierMeetsRequirement = checkTierRequirement(currentTier, requiredTier);
  const verificationMeetsRequirement = !requiresVerification || isVerified;
  const subscriptionActive = subscription?.status === 'active' || currentTier === 'free';

  // Check if access is granted
  const hasAccess = tierMeetsRequirement && verificationMeetsRequirement && subscriptionActive;

  if (hasAccess) {
    return <>{children}</>;
  }

  // If fallback is provided and it's a simple tier restriction
  if (fallback && !requiresVerification && subscriptionActive) {
    return <>{fallback}</>;
  }

  // Render upgrade prompt
  const config = tierConfigs[requiredTier];
  
  if (compact) {
    return (
      <Alert className="border-dashed">
        <Lock className="w-4 h-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            <strong>{featureName}</strong> requires {config?.name} plan
            {requiresVerification && ' + verification'}
          </span>
          <Button size="sm" onClick={handleUpgrade} className="ml-2">
            Upgrade
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center mb-3">
          <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
        </div>
        <CardTitle className="text-xl">
          {featureName}
          <Badge variant="outline" className="ml-2">
            {config && <config.icon className={`w-3 h-3 mr-1 ${config.color}`} />}
            {config?.name}
            {requiresVerification && (
              <>
                {' + '}
                <Shield className="w-3 h-3 ml-1 text-green-600" />
                Verified
              </>
            )}
          </Badge>
        </CardTitle>
        <CardDescription>
          {description || `This feature requires a ${config?.name} subscription${requiresVerification ? ' and verification' : ''}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Current Plan:</span>
            <Badge className={currentTier === 'free' ? 'bg-slate-100 text-slate-700' : config?.color}>
              {currentTier === 'free' ? (
                <Zap className="w-3 h-3 mr-1" />
              ) : (
                <config.icon className="w-3 h-3 mr-1" />
              )}
              {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span>Verification Status:</span>
            {isVerified ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>Verified</span>
              </div>
            ) : (
              <div className="flex items-center text-amber-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span>Not Verified</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 pt-4">
          {!tierMeetsRequirement && (
            <Button
              onClick={handleUpgrade}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {config?.upgradeText}
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {tierMeetsRequirement && !verificationMeetsRequirement && (
            <Button
              onClick={handleVerification}
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
            >
              Complete Verification
              <Shield className="w-4 h-4 ml-2" />
            </Button>
          )}

          {!subscriptionActive && (
            <Button
              onClick={handleUpgrade}
              variant="destructive"
            >
              Renew Subscription
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Feature Benefits */}
        {config && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mt-4">
            <h5 className="font-medium mb-2 text-slate-900 dark:text-slate-100">
              {config.name} Plan Benefits
            </h5>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              {requiredTier === 'bronze' && (
                <>
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                    <span>Profile overrides and custom branding</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                    <span>Priority support and enhanced API limits</span>
                  </div>
                </>
              )}
              {requiredTier === 'gold' && (
                <>
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                    <span>Everything in Bronze plan</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                    <span>Verification badge eligibility</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                    <span>Advanced analytics and premium support</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Convenience components for common use cases
export function ProfileEditGate({ children }: { children: ReactNode }) {
  return (
    <FeatureGate
      requiredTier="bronze"
      featureName="Profile Customization"
      description="Customize your project's appearance with profile overrides."
    >
      {children}
    </FeatureGate>
  );
}

export function VerificationGate({ children }: { children: ReactNode }) {
  return (
    <FeatureGate
      requiredTier="gold"
      requiresVerification={true}
      featureName="Publishing Verification"
      description="Publish your custom profile overrides to be visible publicly."
    >
      {children}
    </FeatureGate>
  );
}

export function AdvancedFeaturesGate({ children, featureName }: { children: ReactNode; featureName: string }) {
  return (
    <FeatureGate
      requiredTier="gold"
      featureName={featureName}
      description="Advanced features available with Gold subscription."
      compact={true}
    >
      {children}
    </FeatureGate>
  );
}
