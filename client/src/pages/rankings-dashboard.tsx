import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, TrendingDown, Award, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface RankingHistory {
  id: string;
  entity_type: 'nft' | 'collection' | 'civilization';
  entity_id: string;
  entity_name: string;
  rank_type: 'overall' | 'collection' | 'global' | 'regional';
  current_rank: number;
  previous_rank?: number;
  rank_change: number;
  current_score: number;
  previous_score?: number;
  score_change?: number;
  percentile: number;
  tier: string;
  scan_timestamp: string;
}

interface NFTRanking {
  id: string;
  name: string;
  overall_rarity_rank?: number;
  collection_rarity_rank?: number;
  rank_change?: number;
  rarity_score: string;
  rarity_tier?: string;
  power_percentile?: number;
  last_rank_update?: string;
  collection_name: string;
}

interface CivilizationRanking {
  id: string;
  civilization_name: string;
  global_rank?: number;
  previous_global_rank?: number;
  rank_change_global?: number;
  civilization_score: string;
  civilization_tier?: string;
  rank_trend?: string;
  military_strength: number;
  culture_level: number;
  total_population: number;
}

const TIER_COLORS = {
  legendary: '#f59e0b',
  mythic: '#a855f7',
  epic: '#3b82f6',
  rare: '#10b981',
  uncommon: '#6b7280',
  common: '#9ca3af',
  god_emperor: '#dc2626',
  emperor: '#f59e0b',
  king: '#a855f7',
  lord: '#3b82f6',
  knight: '#10b981',
  peasant: '#6b7280'
};

export default function RankingDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [entityType, setEntityType] = useState<'nft' | 'collection' | 'civilization'>('nft');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

    // Fetch ranking history
  const { data: rankingHistory = [] } = useQuery<RankingHistory[]>({
    queryKey: ['/api/rankings/history'],
    queryFn: async () => {
      const response = await apiRequest('/api/rankings/history?limit=100');
      const data = await response.json() as any;
      return data.history || [];
    }
  });

  // Fetch top NFTs by rarity
  const { data: topNFTs = [] } = useQuery<NFTRanking[]>({
    queryKey: ['/api/rankings/nfts/top'],
    queryFn: async () => {
      const response = await apiRequest('/api/rankings/nfts/top?limit=50');
      const data = await response.json() as any;
      return data.nfts || [];
    }
  });

  // Fetch top civilizations
  const { data: topCivilizations = [] } = useQuery<CivilizationRanking[]>({
    queryKey: ['/api/rankings/civilizations/top'],
    queryFn: async () => {
      const response = await apiRequest('/api/rankings/civilizations/top?limit=50');
      const data = await response.json() as any;
      return data.civilizations || [];
    }
  });

  // Process data for rank trend chart
  const rankTrendData = rankingHistory
    .sort((a, b) => new Date(a.scan_timestamp).getTime() - new Date(b.scan_timestamp).getTime())
    .map(h => ({
      timestamp: new Date(h.scan_timestamp).toLocaleDateString(),
      rank: h.current_rank,
      score: h.current_score,
      percentile: h.percentile,
      entity: h.entity_name
    }));

  // Process data for tier distribution
  const tierDistribution = topNFTs.reduce((acc, nft) => {
    const tier = nft.rarity_tier || 'common';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tierPieData = Object.entries(tierDistribution).map(([tier, count]) => ({
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    value: count,
    color: TIER_COLORS[tier as keyof typeof TIER_COLORS] || '#9ca3af'
  }));

  // Process rank changes
  const rankChanges = topNFTs
    .filter(nft => nft.rank_change !== undefined && nft.rank_change !== 0)
    .sort((a, b) => Math.abs(b.rank_change || 0) - Math.abs(a.rank_change || 0))
    .slice(0, 20);

  const getTrendIcon = (change?: number) => {
    if (!change || change === 0) return null;
    return change > 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getTierBadge = (tier?: string) => {
    if (!tier) return null;
    const color = TIER_COLORS[tier as keyof typeof TIER_COLORS] || '#9ca3af';
    return (
      <Badge style={{ backgroundColor: color, color: 'white', border: 'none' }}>
        {tier.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rankings & Rarity Dashboard</h1>
          <p className="text-muted-foreground">Track NFT rankings, rarity changes, and civilization progress</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="nfts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="nfts" onClick={() => setEntityType('nft')}>
            <Award className="h-4 w-4 mr-2" />
            NFT Rankings
          </TabsTrigger>
          <TabsTrigger value="civilizations" onClick={() => setEntityType('civilization')}>
            <Activity className="h-4 w-4 mr-2" />
            Civilizations
          </TabsTrigger>
          <TabsTrigger value="trends" onClick={() => setEntityType('nft')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Trends & Analytics
          </TabsTrigger>
        </TabsList>

        {/* NFT Rankings Tab */}
        <TabsContent value="nfts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top NFTs by Rarity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {topNFTs.slice(0, 50).map((nft, index) => (
                    <div
                      key={nft.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors",
                        index < 3 && "bg-accent/50 border-2 border-primary/20"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex flex-col items-center justify-center w-12">
                          <span className={cn(
                            "text-lg font-bold",
                            index === 0 && "text-amber-500",
                            index === 1 && "text-gray-400",
                            index === 2 && "text-amber-700"
                          )}>
                            #{nft.overall_rarity_rank || index + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{nft.name}</h4>
                            {getTierBadge(nft.rarity_tier)}
                          </div>
                          <p className="text-xs text-muted-foreground">{nft.collection_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              Score: {parseFloat(nft.rarity_score).toFixed(2)}
                            </span>
                            {nft.power_percentile && (
                              <span className="text-xs text-muted-foreground">
                                • {nft.power_percentile.toFixed(1)}th percentile
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(nft.rank_change)}
                          {nft.rank_change !== undefined && nft.rank_change !== 0 && (
                            <span className={cn(
                              "text-sm font-medium",
                              nft.rank_change > 0 ? "text-green-500" : "text-red-500"
                            )}>
                              {Math.abs(nft.rank_change)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Biggest Rank Movers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {rankChanges.map((nft) => (
                    <div
                      key={nft.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getTrendIcon(nft.rank_change)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{nft.name}</h4>
                            {getTierBadge(nft.rarity_tier)}
                          </div>
                          <p className="text-xs text-muted-foreground">{nft.collection_name}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-lg font-bold",
                            (nft.rank_change || 0) > 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {nft.rank_change && nft.rank_change > 0 ? '+' : ''}{nft.rank_change}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rank #{nft.overall_rarity_rank}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Civilizations Tab */}
        <TabsContent value="civilizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Civilizations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {topCivilizations.map((civ, index) => (
                  <div
                    key={civ.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg hover:bg-accent cursor-pointer transition-colors",
                      index < 3 && "bg-accent/50 border-2 border-primary/20"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex flex-col items-center justify-center w-12">
                        <span className={cn(
                          "text-2xl font-bold",
                          index === 0 && "text-amber-500",
                          index === 1 && "text-gray-400",
                          index === 2 && "text-amber-700"
                        )}>
                          #{civ.global_rank || index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg">{civ.civilization_name}</h4>
                          {getTierBadge(civ.civilization_tier)}
                          {civ.rank_trend && (
                            <Badge variant={civ.rank_trend === 'rising' ? 'default' : 'secondary'}>
                              {civ.rank_trend}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Score</p>
                            <p className="font-semibold">{parseFloat(civ.civilization_score).toFixed(0)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Military</p>
                            <p className="font-semibold">{civ.military_strength}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Population</p>
                            <p className="font-semibold">{civ.total_population.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(civ.rank_change_global)}
                        {civ.rank_change_global !== undefined && civ.rank_change_global !== 0 && (
                          <span className={cn(
                            "text-lg font-bold",
                            civ.rank_change_global > 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {Math.abs(civ.rank_change_global)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Rank Changes Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={rankTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis reversed label={{ value: 'Rank', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="rank" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rarity Tier Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tierPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {tierPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score Progression</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={rankTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Percentile Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rankTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis label={{ value: 'Percentile', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="percentile" fill="#a855f7" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
