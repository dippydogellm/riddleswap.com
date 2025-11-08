import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Divider,
  LinearProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  SportsEsports as BattleIcon,
  EmojiEvents as TrophyIcon,
  Groups as PlayersIcon,
  LocalFireDepartment as FireIcon,
  Star as StarIcon,
  TrendingUp as TrendingIcon,
  AddCircle as AddIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

interface DashboardStats {
  total_battles: number;
  active_battles: number;
  total_wins: number;
  win_rate: number;
  total_kills: number;
  total_damage: string;
  medals_earned: number;
  current_rank: string;
}

interface RecentBattle {
  id: string;
  battle_mode: string;
  battle_type: string;
  status: string;
  current_players: number;
  max_players: number;
  entry_fee: string;
  entry_currency: string;
  created_at: string;
}

export default function GamingDashboard() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBattles, setRecentBattles] = useState<RecentBattle[]>([]);
  const [activeBattles, setActiveBattles] = useState<RecentBattle[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load player stats
      const statsRes = await fetch('/api/gaming/player/stats', {
        credentials: 'include'
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // Load recent battles
      const battlesRes = await fetch('/api/gaming/battles/my-battles?limit=5', {
        credentials: 'include'
      });
      if (battlesRes.ok) {
        const data = await battlesRes.json();
        setRecentBattles(data.battles || []);
      }

      // Load active battles (available to join)
      const activeRes = await fetch('/api/gaming/battles/available?limit=5', {
        credentials: 'include'
      });
      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveBattles(data.battles || []);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Card elevation={3} sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const BattleCard = ({ battle, showJoinButton = false }: { battle: RecentBattle, showJoinButton?: boolean }) => (
    <Card elevation={2} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip 
                label={battle.battle_mode} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
              <Chip 
                label={battle.battle_type} 
                size="small" 
                color="secondary" 
                variant="outlined"
              />
              <Chip 
                label={battle.status} 
                size="small" 
                color={battle.status === 'pending' ? 'warning' : battle.status === 'active' ? 'success' : 'default'}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Players: {battle.current_players}/{battle.max_players}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Entry: {battle.entry_fee} {battle.entry_currency}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created: {new Date(battle.created_at).toLocaleString()}
            </Typography>
          </Box>
          <Box>
            {showJoinButton ? (
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => setLocation(`/gaming/battles/${battle.id}`)}
              >
                Join Battle
              </Button>
            ) : (
              <IconButton
                color="primary"
                onClick={() => setLocation(`/gaming/battles/${battle.id}`)}
              >
                <ViewIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box mb={4}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          Gaming Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Command your squadron, conquer civilizations, and earn legendary rewards
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box mb={4}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => setLocation('/gaming/battles/create')}
              sx={{ py: 2 }}
            >
              Create Battle
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<BattleIcon />}
              onClick={() => setLocation('/gaming/battles')}
              sx={{ py: 2 }}
            >
              Browse Battles
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<TrophyIcon />}
              onClick={() => setLocation('/gaming/scorecards')}
              sx={{ py: 2 }}
            >
              Leaderboards
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<StarIcon />}
              onClick={() => setLocation('/nft-collections')}
              sx={{ py: 2 }}
            >
              My NFTs
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Battles"
            value={stats?.total_battles || 0}
            icon={<BattleIcon />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Wins"
            value={stats?.total_wins || 0}
            icon={<TrophyIcon />}
            color="success.main"
            subtitle={`${((stats?.win_rate || 0) * 100).toFixed(1)}% win rate`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Kills"
            value={stats?.total_kills || 0}
            icon={<FireIcon />}
            color="error.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Medals"
            value={stats?.medals_earned || 0}
            icon={<StarIcon />}
            color="warning.main"
            subtitle={stats?.current_rank || 'Unranked'}
          />
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Active Battles (Available to Join) */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardHeader
              title="Available Battles"
              avatar={<PlayersIcon color="primary" />}
              action={
                <Button size="small" onClick={() => setLocation('/gaming/battles')}>
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent>
              {activeBattles.length === 0 ? (
                <Alert severity="info">No active battles available. Create one!</Alert>
              ) : (
                activeBattles.map(battle => (
                  <BattleCard key={battle.id} battle={battle} showJoinButton />
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Battles */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardHeader
              title="My Recent Battles"
              avatar={<BattleIcon color="secondary" />}
              action={
                <Button size="small" onClick={() => setLocation('/gaming/battles')}>
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent>
              {recentBattles.length === 0 ? (
                <Alert severity="info">No battles yet. Join or create your first battle!</Alert>
              ) : (
                recentBattles.map(battle => (
                  <BattleCard key={battle.id} battle={battle} />
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Chart Placeholder */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardHeader
              title="Performance Trends"
              avatar={<TrendingIcon color="success" />}
            />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" align="center" py={4}>
                Performance analytics coming soon
              </Typography>
              {/* Future: Add chart showing battle performance over time */}
            </CardContent>
          </Card>
        </Grid>

        {/* Achievements Placeholder */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardHeader
              title="Recent Achievements"
              avatar={<StarIcon color="warning" />}
            />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" align="center" py={4}>
                Track your medals and achievements here
              </Typography>
              {/* Future: Display recent medals and achievements */}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
