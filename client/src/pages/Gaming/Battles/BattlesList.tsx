import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  SportsEsports as BattleIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

interface Battle {
  id: string;
  battle_mode: string;
  battle_type: string;
  combat_type: string;
  status: string;
  current_players: number;
  max_players: number;
  entry_fee: string;
  entry_currency: string;
  creator: string;
  is_private: boolean;
  created_at: string;
  total_prize_pool?: string;
}

export default function BattlesList() {
  const [, setLocation] = useLocation();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState(0); // 0: All, 1: Available, 2: My Battles
  const [filters, setFilters] = useState({
    status: 'all',
    battle_mode: 'all',
    combat_type: 'all',
  });

  useEffect(() => {
    loadBattles();
  }, [page, activeTab, filters]);

  const loadBattles = async () => {
    try {
      setLoading(true);
      
      let endpoint = '/api/gaming/battles/available';
      if (activeTab === 2) {
        endpoint = '/api/gaming/battles/my-battles';
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.battle_mode !== 'all' && { battle_mode: filters.battle_mode }),
        ...(filters.combat_type !== 'all' && { combat_type: filters.combat_type }),
      });

      const response = await fetch(`${endpoint}?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json() as any;
        setBattles(data.battles || []);
        setTotalPages(Math.ceil((data.total || 0) / 10));
      }
    } catch (error) {
      console.error('Failed to load battles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinBattle = async (battleId: string) => {
    setLocation(`/gaming/battles/${battleId}`);
  };

  const BattleCard = ({ battle }: { battle: Battle }) => (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {battle.battle_mode === '1v1' ? '1v1 Battle' : `${battle.max_players}-Player Battle`}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip label={battle.battle_type} size="small" color="primary" />
              <Chip label={battle.combat_type} size="small" color="secondary" />
              <Chip 
                label={battle.status} 
                size="small"
                color={
                  battle.status === 'pending' ? 'warning' :
                  battle.status === 'active' ? 'success' :
                  battle.status === 'completed' ? 'default' : 'error'
                }
              />
              {battle.is_private && <Chip label="Private" size="small" color="info" />}
            </Box>
          </Box>
          <IconButton color="primary" onClick={() => handleJoinBattle(battle.id)}>
            <ViewIcon />
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Players
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {battle.current_players}/{battle.max_players}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Entry Fee
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {battle.entry_fee} {battle.entry_currency}
            </Typography>
          </Grid>
          {battle.total_prize_pool && (
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Prize Pool
              </Typography>
              <Typography variant="body1" fontWeight="bold" color="success.main">
                {battle.total_prize_pool} {battle.entry_currency}
              </Typography>
            </Grid>
          )}
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Creator
            </Typography>
            <Typography variant="body1">
              {battle.creator}
            </Typography>
          </Grid>
        </Grid>

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Created {new Date(battle.created_at).toLocaleString()}
          </Typography>
        </Box>

        <Box mt={2}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => handleJoinBattle(battle.id)}
            disabled={battle.status !== 'pending' && battle.status !== 'active'}
          >
            {battle.status === 'pending' ? 'Join Battle' : battle.status === 'active' ? 'View Battle' : 'View Details'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            Battles
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Join epic multiplayer battles and compete for glory
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => setLocation('/gaming/battles/create')}
        >
          Create Battle
        </Button>
      </Box>

      {/* Tabs */}
      <Box mb={3}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="All Battles" />
          <Tab label="Available to Join" />
          <Tab label="My Battles" />
        </Tabs>
      </Box>

      {/* Filters */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Battle Mode</InputLabel>
                <Select
                  value={filters.battle_mode}
                  label="Battle Mode"
                  onChange={(e) => setFilters({ ...filters, battle_mode: e.target.value })}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="1v1">1v1</MenuItem>
                  <MenuItem value="multiplayer">Multiplayer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Combat Type</InputLabel>
                <Select
                  value={filters.combat_type}
                  label="Combat Type"
                  onChange={(e) => setFilters({ ...filters, combat_type: e.target.value })}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="military">Military</MenuItem>
                  <MenuItem value="religious">Religious</MenuItem>
                  <MenuItem value="social">Social</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<RefreshIcon />}
                onClick={loadBattles}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Battles Grid */}
      {loading ? (
        <Alert severity="info">Loading battles...</Alert>
      ) : battles.length === 0 ? (
        <Alert severity="info">
          No battles found. {activeTab === 0 ? 'Be the first to create one!' : 'Try adjusting your filters.'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {battles.map(battle => (
              <Grid item xs={12} sm={6} md={4} key={battle.id}>
                <BattleCard battle={battle} />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
