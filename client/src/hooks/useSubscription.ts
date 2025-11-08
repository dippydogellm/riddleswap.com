import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface SubscriptionInfo {
  tier: 'free' | 'bronze' | 'gold';
  verified: boolean;
  overrideCount: number;
  maxOverrides: number;
  apiCallsUsed: number;
  maxApiCalls: number;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt?: string;
  renewalDate?: string;
}

export interface UsageData {
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
  subscription: SubscriptionInfo;
}

// Hook for getting subscription status
export function useSubscription() {
  const { isAuthenticated } = useAuth();

  return useQuery<SubscriptionInfo>({
    queryKey: ['/api/subscriptions/status'],
    enabled: isAuthenticated,
    staleTime: 30000, // 30 seconds
    refetchInterval: 300000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

// Hook for getting usage data
export function useUsageData(projectId?: string) {
  const { isAuthenticated } = useAuth();

  return useQuery<UsageData>({
    queryKey: projectId 
      ? ['/api/subscriptions/usage', projectId]
      : ['/api/subscriptions/usage'],
    enabled: isAuthenticated,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

// Hook for checking feature access
export function useFeatureAccess() {
  const { data: subscription, isLoading } = useSubscription();

  const checkTierAccess = (requiredTier: 'free' | 'bronze' | 'gold'): boolean => {
    if (isLoading || !subscription) return false;
    
    const tierLevels = { free: 0, bronze: 1, gold: 2 };
    const currentLevel = tierLevels[subscription.tier];
    const requiredLevel = tierLevels[requiredTier];
    
    return currentLevel >= requiredLevel && subscription.status === 'active';
  };

  const hasProfileOverrides = () => checkTierAccess('bronze');
  const canPublishOverrides = () => checkTierAccess('gold') && subscription?.verified;
  const hasAdvancedFeatures = () => checkTierAccess('gold');
  const isVerified = () => subscription?.verified || false;

  return {
    subscription,
    isLoading,
    checkTierAccess,
    hasProfileOverrides,
    canPublishOverrides,
    hasAdvancedFeatures,
    isVerified,
  };
}

// Hook for subscription operations (create, cancel, renew)
export function useSubscriptionMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSubscription = useMutation({
    mutationFn: async (data: {
      planId: string;
      paymentMethod: string;
      cryptoAmount: number;
      projectId?: string;
    }) => {
      const response = await apiRequest('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/usage'] });
      toast({
        title: 'Subscription Created',
        description: 'Your subscription has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Failed to create subscription',
        variant: 'destructive',
      });
    },
  });

  const cancelSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await apiRequest(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/status'] });
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Cancellation Failed',
        description: error.message || 'Failed to cancel subscription',
        variant: 'destructive',
      });
    },
  });

  const requestVerification = useMutation({
    mutationFn: async (data: {
      projectId: string;
      verificationData: any;
    }) => {
      const response = await apiRequest('/api/subscriptions/verification', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/status'] });
      toast({
        title: 'Verification Requested',
        description: 'Your verification request has been submitted for review.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to request verification',
        variant: 'destructive',
      });
    },
  });

  return {
    createSubscription,
    cancelSubscription,
    requestVerification,
  };
}
