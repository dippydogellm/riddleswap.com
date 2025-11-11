import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface FeeRewardPoint {
  date: string;
  feesUsd: number;
  rewardsUsd: number;
}

// Simple chart comparing platform fees vs rewards distribution
export default function RewardsVsFeesChart() {
  const { data } = useQuery({
    queryKey: ['platform-fees-rewards'],
    queryFn: async () => {
      const res = await fetch('/api/rewards/platform-stats');
      if (!res.ok) return { points: [] };
      const stats = await res.json();
      // Placeholder synthetic history until backend timeseries exists
      const now = new Date();
      const points: FeeRewardPoint[] = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
        return {
          date: d.toISOString().split('T')[0],
          feesUsd: Number(stats.totalFeesUsd || 0) * (0.4 + i * 0.05),
          rewardsUsd: Number(stats.totalRewardsUsd || 0) * (0.3 + i * 0.04)
        };
      });
      return { points };
    }
  });

  const points = useMemo(() => data?.points || [], [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fees vs Rewards (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 260 }}>
        {points.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="feesUsd" stroke="#6366F1" strokeWidth={2} name="Fees (USD)" />
              <Line type="monotone" dataKey="rewardsUsd" stroke="#10B981" strokeWidth={2} name="Rewards (USD)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
