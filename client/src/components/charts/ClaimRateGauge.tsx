import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

export default function ClaimRateGauge() {
  const { data } = useQuery({
    queryKey: ['rewards-claim-stats'],
    queryFn: async () => {
      const res = await fetch('/api/rewards/platform-stats');
      if (!res.ok) return { claimRate: 0 };
      const stats = await res.json();
      // If backend adds claim stats we use it; fallback pseudo-rate
      const claimRate = stats.successfulClaims && stats.totalClaimTransactions
        ? Math.round((stats.successfulClaims / Math.max(1, stats.totalClaimTransactions)) * 100)
        : 0;
      return { claimRate };
    },
    refetchInterval: 60000
  });

  const rate = data?.claimRate || 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reward Claim Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-52">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" stroke="#1E293B" strokeWidth="8" fill="none" />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="#10B981"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(rate/100)*2*Math.PI*45} ${2*Math.PI*45}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="600" fill="#10B981">{rate}%</text>
            </svg>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Successful reward claim confirmations</p>
        </div>
      </CardContent>
    </Card>
  );
}
