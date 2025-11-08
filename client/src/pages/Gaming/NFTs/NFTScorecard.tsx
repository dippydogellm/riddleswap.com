import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  Shield as ShieldIcon,
  Star as StarIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { useParams } from 'wouter';

interface NFTScorecard {
  nft_id: string;
  collection_id: string;
  total_battles: number;
  total_kills: number;
  total_assists: number;
  total_damage_dealt: string;
  total_damage_taken: string;
  medals: string[];
  last_battle_id: string;
  last_updated: string;
}

interface Medal {
  id: string;
  medal_type: string;
  reason: string;
  awarded_at: string;
  battle_id: string;
  metadata: any;
}

interface BattleHistory {
  id: string;
  battle_id: string;
  status: string;
  damage_dealt: string;
  damage_taken: string;
  final_placement?: number;
  prize_amount?: string;
  created_at: string;
}

export default function NFTScorecard() {
  const { nftId } = useParams<{ nftId: string }>();
  const [loading, setLoading] = useState(true);
  const [scorecard, setScorecard] = useState<NFTScorecard | null>(null);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [battleHistory, setBattleHistory] = useState<BattleHistory[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (nftId) {
      loadScorecardData();
    }
  }, [nftId]);

  const loadScorecardData = async () => {
    try {
      setLoading(true);

      // Load scorecard
      const scorecardRes = await fetch(`/api/gaming/nft/${nftId}/scorecard`, {
        credentials: 'include'
      });
      if (scorecardRes.ok) {
        const data = await scorecardRes.json();
        setScorecard(data);
      }

      // Load medals
      const medalsRes = await fetch(`/api/gaming/nft/${nftId}/medals`, {
        credentials: 'include'
      });
      if (medalsRes.ok) {
        const data = await medalsRes.json();
        setMedals(data.medals || []);
      }

      // Load battle history
      const historyRes = await fetch(`/api/gaming/nft/${nftId}/battle-history`, {
        credentials: 'include'
      });
      if (historyRes.ok) {
        const data = await historyRes.json();
        setBattleHistory(data.battles || []);
      }
    } catch (error) {
      console.error('Failed to load scorecard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (type: string) => {
    switch (type) {
      case 'gold': return '#FFD700';
      case 'silver': return '#C0C0C0';
      case 'bronze': return '#CD7F32';
      default: return '#888';
    }
  };

  const getMedalIcon = (type: string) => {
    return <TrophyIcon sx={{ color: getMedalColor(type) }} />;
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading scorecard...</Typography>
      </Container>
    );
  }

  if (!scorecard) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="info">No scorecard data found for this NFT</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          NFT Scorecard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          NFT ID: {nftId}
        </Typography>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Battles
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {scorecard.total_battles}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <TrendingIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Kills
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {scorecard.total_kills}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main', width: 56, height: 56 }}>
                  <FireIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Damage Dealt
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {parseFloat(scorecard.total_damage_dealt).toFixed(0)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                  <FireIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Medals Earned
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {medals.length}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                  <StarIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card elevation={3}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="Battle History" />
            <Tab label={`Medals (${medals.length})`} />
            <Tab label="Stats" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Battle History Tab */}
          {activeTab === 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Battle ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Damage Dealt</TableCell>
                    <TableCell align="right">Damage Taken</TableCell>
                    <TableCell align="center">Placement</TableCell>
                    <TableCell align="right">Prize</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {battleHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Alert severity="info">No battle history yet</Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    battleHistory.map((battle) => (
                      <TableRow key={battle.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {battle.battle_id.slice(0, 8)}...
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={battle.status} 
                            size="small"
                            color={
                              battle.status === 'completed' ? 'success' :
                              battle.status === 'active' ? 'warning' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">{battle.damage_dealt}</TableCell>
                        <TableCell align="right">{battle.damage_taken}</TableCell>
                        <TableCell align="center">
                          {battle.final_placement ? (
                            <Chip 
                              label={`#${battle.final_placement}`}
                              size="small"
                              color={
                                battle.final_placement === 1 ? 'warning' :
                                battle.final_placement === 2 ? 'default' :
                                battle.final_placement === 3 ? 'default' : 'default'
                              }
                              icon={battle.final_placement <= 3 ? getMedalIcon(
                                battle.final_placement === 1 ? 'gold' :
                                battle.final_placement === 2 ? 'silver' : 'bronze'
                              ) : undefined}
                            />
                          ) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {battle.prize_amount ? `${battle.prize_amount}` : '-'}
                        </TableCell>
                        <TableCell>
                          {new Date(battle.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Medals Tab */}
          {activeTab === 1 && (
            <Grid container spacing={2}>
              {medals.length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info">No medals earned yet</Alert>
                </Grid>
              ) : (
                medals.map((medal) => (
                  <Grid item xs={12} sm={6} md={4} key={medal.id}>
                    <Card elevation={2}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                          <Avatar sx={{ bgcolor: getMedalColor(medal.medal_type), width: 48, height: 48 }}>
                            <TrophyIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" textTransform="capitalize">
                              {medal.medal_type} Medal
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(medal.awarded_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body2">
                          {medal.reason}
                        </Typography>
                        {medal.metadata?.prize && (
                          <Chip 
                            label={`Prize: ${medal.metadata.prize}`}
                            size="small"
                            color="success"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}

          {/* Stats Tab */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Combat Stats</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Total Battles:</Typography>
                    <Typography fontWeight="bold">{scorecard.total_battles}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Total Kills:</Typography>
                    <Typography fontWeight="bold">{scorecard.total_kills}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Total Assists:</Typography>
                    <Typography fontWeight="bold">{scorecard.total_assists}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>K/D Ratio:</Typography>
                    <Typography fontWeight="bold">
                      {scorecard.total_battles > 0 
                        ? (scorecard.total_kills / scorecard.total_battles).toFixed(2)
                        : '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Damage Stats</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Damage Dealt:</Typography>
                    <Typography fontWeight="bold" color="error.main">
                      {parseFloat(scorecard.total_damage_dealt).toFixed(0)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Damage Taken:</Typography>
                    <Typography fontWeight="bold" color="warning.main">
                      {parseFloat(scorecard.total_damage_taken).toFixed(0)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Avg Damage/Battle:</Typography>
                    <Typography fontWeight="bold">
                      {scorecard.total_battles > 0
                        ? (parseFloat(scorecard.total_damage_dealt) / scorecard.total_battles).toFixed(0)
                        : '0'}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Efficiency:</Typography>
                    <Typography fontWeight="bold" color="success.main">
                      {parseFloat(scorecard.total_damage_taken) > 0
                        ? ((parseFloat(scorecard.total_damage_dealt) / parseFloat(scorecard.total_damage_taken)) * 100).toFixed(1)
                        : '100'}%
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
