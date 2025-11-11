import { useQuery } from '@tanstack/react-query';

// Centralized analytics data hooks for DevTools dashboard
export function useProjects() {
  return useQuery({ queryKey: ['devtools-projects'], queryFn: async () => {
    const res = await fetch('/api/devtools/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  }});
}

export function useAirdrops() {
  return useQuery({ queryKey: ['devtools-airdrops'], queryFn: async () => {
    const res = await fetch('/api/devtools/airdrops');
    if (!res.ok) throw new Error('Failed to fetch airdrops');
    return res.json();
  }});
}

export function usePublicAirdrops() {
  return useQuery({ queryKey: ['devtools-public-airdrops'], queryFn: async () => {
    const res = await fetch('/api/devtools/airdrops/public/active');
    if (!res.ok) throw new Error('Failed to fetch public airdrops');
    return res.json();
  }});
}

export function useRewardsSummary(userHandle?: string) {
  return useQuery({
    queryKey: ['rewards-summary', userHandle],
    enabled: !!userHandle,
    queryFn: async () => {
      // Placeholder: backend route not yet implemented; keep empty structure
      const res = await fetch(`/api/rewards/summary/${userHandle}`);
      if (!res.ok) return { rewards: [], error: 'Route not implemented yet' };
      return res.json();
    }
  });
}

export function useSubscriptionsStatus() {
  return useQuery({ queryKey: ['devtools-subscriptions'], queryFn: async () => {
    const res = await fetch('/api/devtools/subscriptions/status');
    if (!res.ok) throw new Error('Failed to fetch subscriptions status');
    return res.json();
  }});
}

export function useAllWallets() {
  return useQuery({ queryKey: ['devtools-all-wallets'], queryFn: async () => {
    const res = await fetch('/api/devtools/all-wallets');
    if (!res.ok) throw new Error('Failed to fetch wallets overview');
    return res.json();
  }});
}
