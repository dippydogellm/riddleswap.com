import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function ChainDeploymentsBar() {
  const { data } = useQuery({
    queryKey: ['devtools-projects'],
    queryFn: async () => {
      const res = await fetch('/api/devtools/projects');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const chainCounts: Record<string, number> = {};
  (data || []).forEach((p: any) => {
    (p.selectedChains || []).forEach((c: string) => {
      chainCounts[c] = (chainCounts[c] || 0) + 1;
    });
  });

  const chartData = Object.entries(chainCounts).map(([chain, count]) => ({ chain, count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployments per Chain</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 260 }}>
        {chartData.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No deployments yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="chain" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" name="Projects" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
