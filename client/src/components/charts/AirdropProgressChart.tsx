import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function AirdropProgressChart() {
  const { data } = useQuery({
    queryKey: ['devtools-airdrops'],
    queryFn: async () => {
      const res = await fetch('/api/devtools/airdrops');
      if (!res.ok) return { airdrops: [] };
      return res.json();
    }
  });

  const chartData = (data?.airdrops || []).slice(0, 8).map((a: any) => ({
    name: a.airdrop_type?.toUpperCase() || 'Airdrop',
    progress: Math.round(((a.total_claimed || 0) / Math.max(1, a.total_recipients || 0)) * 100)
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Airdrop Progress</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 260 }}>
        {chartData.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No active airdrops</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="progress" fill="#60A5FA" name="Claimed %" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
