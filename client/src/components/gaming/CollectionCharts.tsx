import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';

interface CollectionChartsProps {
  collectionId: string;
}

interface StatsData {
  collection: {
    id: string;
    name: string;
    total_nfts: number;
  };
  rarityHistogram: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  traitRarityAnalysis: Array<{
    trait_type: string;
    value: string;
    count: number;
    percentage: number;
    rarity: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  }>;
  powerDistribution: {
    army: number;
    religion: number;
    civilization: number;
    economic: number;
  };
  floorPriceHistory: Array<{
    date: string;
    price: number;
    volume: number;
  }>;
}

export const CollectionCharts: React.FC<CollectionChartsProps> = ({ collectionId }) => {
  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['collectionStats', collectionId],
    queryFn: async () => {
      const response = await fetch(`/api/gaming/collection/${collectionId}/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const result = await response.json();
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <Grid container spacing={3}>
        {[...Array(4)].map((_, i) => (
          <Grid item xs={12} md={6} key={i}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error || !data) {
    return <Alert severity="error">Failed to load charts. Please try again.</Alert>;
  }

  // Transform power distribution for radar chart
  const powerRadarData = [
    { category: 'Army', value: data.powerDistribution.army },
    { category: 'Religion', value: data.powerDistribution.religion },
    { category: 'Civilization', value: data.powerDistribution.civilization },
    { category: 'Economic', value: data.powerDistribution.economic },
  ];

  // Get top 10 rarest traits for bar chart
  const topRareTraits = data.traitRarityAnalysis.slice(0, 10).map(trait => ({
    name: `${trait.trait_type}: ${trait.value}`,
    percentage: trait.percentage,
    count: trait.count,
    fill: 
      trait.rarity === 'legendary' ? '#FFD700' :
      trait.rarity === 'epic' ? '#9C27B0' :
      trait.rarity === 'rare' ? '#2196F3' :
      trait.rarity === 'uncommon' ? '#4CAF50' : '#9E9E9E'
  }));

  return (
    <Grid container spacing={3}>
      {/* Floor Price Chart */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            📈 Floor Price History
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.floorPriceHistory}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'price') return [`${value.toFixed(2)} XRP`, 'Floor Price'];
                  if (name === 'volume') return [`${value} sales`, 'Volume'];
                  return [value, name];
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#8884d8"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPrice)"
                name="price"
              />
            </AreaChart>
          </ResponsiveContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            💡 Track the collection's value over time
          </Typography>
        </Paper>
      </Grid>

      {/* Rarity Distribution */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            💎 Rarity Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.rarityHistogram}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
                formatter={(value: number) => [`${value} NFTs`, 'Count']}
              />
              <Legend />
              <Bar
                dataKey="count"
                fill="#667eea"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            📊 Distribution of rarity scores across the collection
          </Typography>
        </Paper>
      </Grid>

      {/* Power Breakdown Radar */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            ⚡ Average Power Breakdown
          </Typography>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={powerRadarData}>
              <PolarGrid stroke="#e0e0e0" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 12, fontWeight: 'bold' }}
              />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              <Radar
                name="Power"
                dataKey="value"
                stroke="#f5576c"
                fill="#f5576c"
                fillOpacity={0.6}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
                formatter={(value: number) => [value.toFixed(2), 'Avg Power']}
              />
            </RadarChart>
          </ResponsiveContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            ⚔️ See what powers your army excels in
          </Typography>
        </Paper>
      </Grid>

      {/* Rarest Traits */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            🏆 Top 10 Rarest Traits
          </Typography>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topRareTraits} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
                formatter={(value: number, name: string, props: any) => [
                  `${value.toFixed(2)}% (${props.payload.count} NFTs)`,
                  'Rarity'
                ]}
              />
              <Bar
                dataKey="percentage"
                radius={[0, 8, 8, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            🌟 Hunt for these ultra-rare traits!
          </Typography>
        </Paper>
      </Grid>

      {/* Volume Chart */}
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            📊 Trading Volume History
          </Typography>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.floorPriceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
                formatter={(value: number) => [`${value} sales`, 'Volume']}
              />
              <Bar
                dataKey="volume"
                fill="#4caf50"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            📦 Trading activity shows collection popularity
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
};
