// ============================================================================
// PARTNER PROJECT DETAIL PAGE
// ============================================================================
// Comprehensive project page with scorecards, tournaments, battles, and stats
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
  Divider,
  Tab,
  Tabs,
  LinearProgress,
  Alert,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  EmojiEvents,
  Whatshot,
  Star,
  TrendingUp,
  People,
  SportsEsports,
  Assessment,
  ArrowBack,
  Refresh,
  Info,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface ProjectData {
  project_name: string;
  collection_name: string;
  collection_id: string;
}

interface StatsData {
  total_nfts: number;
  total_traits: number;
  total_trait_values: number;
  last_rarity_calculation: string;
  rarity_distribution: {
    legendary: number;
    epic: number;
    rare: number;
    uncommon: number;
    common: number;
  };
}

interface NFTScorecard {
  nft_id: string;
  nft_name: string;
  total_rarity_score: number;
  rarity_tier: string;
  rarity_rank?: number;
}

interface LeaderboardData {
  leaderboard: NFTScorecard[];
}

interface TraitScore {
  trait_type: string;
  trait_value: string;
  trait_count: number;
  rarity_percentage: string;
  rarity_score: number;
}

interface TraitsData {
  traits: TraitScore[];
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PartnerProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(0);

  // Fetch project scorecard data
  const { data: projectData, isLoading: projectLoading, refetch: refetchProject } = useQuery<ProjectData>({
    queryKey: [`/api/scorecards/project/${projectId}`],
    enabled: !!projectId,
  });

  // Fetch collection stats
  const { data: statsData, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: [`/api/scorecards/collection/${projectData?.collection_id}/stats`],
    enabled: !!projectData?.collection_id,
  });

  // Fetch leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<LeaderboardData>({
    queryKey: [`/api/scorecards/collection/${projectData?.collection_id}/leaderboard`, { limit: 10 }],
    enabled: !!projectData?.collection_id,
  });

  // Fetch trait scores
  const { data: traitsData, isLoading: traitsLoading } = useQuery<TraitsData>({
    queryKey: [`/api/scorecards/collection/${projectData?.collection_id}/traits`],
    enabled: !!projectData?.collection_id,
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleCalculateRarity = async () => {
    if (!projectData?.collection_id) return;
    
    try {
      const response = await fetch(`/api/scorecards/calculate/${projectData.collection_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: parseInt(projectId!) }),
      });
      
      if (response.ok) {
        setTimeout(() => refetchProject(), 2000);
      }
    } catch (error) {
      console.error('Failed to trigger rarity calculation:', error);
    }
  };

  if (projectLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading project details...</Typography>
      </Container>
    );
  }

  if (!projectData) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Project not found</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => setLocation('/gaming')} sx={{ mt: 2 }}>
          Back to Gaming Dashboard
        </Button>
      </Container>
    );
  }

  const rarityDistribution = statsData?.rarity_distribution || { legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0 };
  const pieData = [
    { name: 'Legendary', value: rarityDistribution.legendary, color: '#FFD700' },
    { name: 'Epic', value: rarityDistribution.epic, color: '#9C27B0' },
    { name: 'Rare', value: rarityDistribution.rare, color: '#2196F3' },
    { name: 'Uncommon', value: rarityDistribution.uncommon, color: '#4CAF50' },
    { name: 'Common', value: rarityDistribution.common, color: '#9E9E9E' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={() => setLocation('/gaming')} sx={{ color: 'white', mr: 2 }}>
              <ArrowBack />
            </IconButton>
            <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: 'white' }}>
              <EmojiEvents sx={{ fontSize: 40, color: '#667eea' }} />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                {projectData.project_name || 'Partner Project'}
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {projectData.collection_name} • {statsData?.total_nfts || 0} NFTs
              </Typography>
            </Box>
            <Tooltip title="Recalculate Rarity Scores">
              <IconButton onClick={handleCalculateRarity} sx={{ color: 'white' }}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Total NFTs</Typography>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {statsData?.total_nfts?.toLocaleString() || '0'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Trait Types</Typography>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {statsData?.total_traits || '0'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Trait Values</Typography>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {statsData?.total_trait_values || '0'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Last Calculated</Typography>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {statsData?.last_rarity_calculation 
                    ? new Date(statsData.last_rarity_calculation).toLocaleDateString()
                    : 'Never'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<Star />} label="Overview" />
          <Tab icon={<Assessment />} label="Rarity Distribution" />
          <Tab icon={<EmojiEvents />} label="Leaderboard" />
          <Tab icon={<Whatshot />} label="Rare Traits" />
          <Tab icon={<SportsEsports />} label="Battles" />
          <Tab icon={<People />} label="Tournaments" />
        </Tabs>
      </Box>

      {/* Tab 0: Overview */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Star sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Top 10 Rarest NFTs
                </Typography>
                <Divider sx={{ my: 2 }} />
                {leaderboardLoading ? (
                  <CircularProgress />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>NFT</TableCell>
                          <TableCell>Tier</TableCell>
                          <TableCell align="right">Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {leaderboardData?.leaderboard?.slice(0, 10).map((nft: any, index: number) => (
                          <TableRow key={nft.nft_id}>
                            <TableCell>#{index + 1}</TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                {nft.nft_name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={nft.rarity_tier} 
                                size="small"
                                color={
                                  nft.rarity_tier === 'legendary' ? 'warning' :
                                  nft.rarity_tier === 'epic' ? 'secondary' :
                                  nft.rarity_tier === 'rare' ? 'primary' :
                                  nft.rarity_tier === 'uncommon' ? 'success' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="bold">
                                {nft.total_rarity_score}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Collection Info
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Collection ID</Typography>
                  <Typography variant="body1" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                    {projectData.collection_id}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Total Supply</Typography>
                  <Typography variant="h6">{statsData?.total_nfts || 0} NFTs</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Scoring Algorithm</Typography>
                  <Typography variant="body1">
                    Score = 100 - (trait_count / total_nfts × 100)
                  </Typography>
                </Box>
                <Alert severity="info" sx={{ mt: 2 }}>
                  Rarity scores are calculated per-collection. Each trait is scored based on its frequency within this specific collection.
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 1: Rarity Distribution */}
      <TabPanel value={activeTab} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
              Rarity Tier Distribution
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  {pieData.map((tier) => (
                    <Box key={tier.name} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Chip label={tier.name} size="small" sx={{ bgcolor: tier.color, color: 'white' }} />
                        <Typography variant="body2">
                          {tier.value} NFTs ({((tier.value / (statsData?.total_nfts || 1)) * 100).toFixed(1)}%)
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={(tier.value / (statsData?.total_nfts || 1)) * 100}
                        sx={{ 
                          height: 8, 
                          borderRadius: 1,
                          bgcolor: 'rgba(0,0,0,0.1)',
                          '& .MuiLinearProgress-bar': { bgcolor: tier.color }
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 2: Leaderboard */}
      <TabPanel value={activeTab} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <EmojiEvents sx={{ mr: 1, verticalAlign: 'middle' }} />
              Top 50 Rarest NFTs
            </Typography>
            <Divider sx={{ my: 2 }} />
            {leaderboardLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>NFT Name</TableCell>
                      <TableCell>Tier</TableCell>
                      <TableCell align="right">Total Score</TableCell>
                      <TableCell align="right">Avg Score</TableCell>
                      <TableCell align="right">Traits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaderboardData?.leaderboard?.map((nft: any, index: number) => (
                      <TableRow key={nft.nft_id} hover>
                        <TableCell>
                          <Typography variant="body1" fontWeight="bold">
                            #{index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{nft.nft_name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {nft.nft_id.slice(0, 16)}...
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={nft.rarity_tier?.toUpperCase()} 
                            size="small"
                            color={
                              nft.rarity_tier === 'legendary' ? 'warning' :
                              nft.rarity_tier === 'epic' ? 'secondary' :
                              nft.rarity_tier === 'rare' ? 'primary' :
                              nft.rarity_tier === 'uncommon' ? 'success' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="bold">
                            {nft.total_rarity_score}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{nft.average_rarity_score}</TableCell>
                        <TableCell align="right">{nft.total_traits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 3: Rare Traits */}
      <TabPanel value={activeTab} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <Whatshot sx={{ mr: 1, verticalAlign: 'middle' }} />
              Rarest Traits (Top 100)
            </Typography>
            <Divider sx={{ my: 2 }} />
            {traitsLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Trait Type</TableCell>
                      <TableCell>Trait Value</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Rarity %</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {traitsData?.traits?.slice(0, 100).map((trait: any) => (
                      <TableRow key={`${trait.trait_type}-${trait.trait_value}`} hover>
                        <TableCell>
                          <Chip label={trait.trait_type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{trait.trait_value}</TableCell>
                        <TableCell align="right">{trait.trait_count}</TableCell>
                        <TableCell align="right">{trait.rarity_percentage}%</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={trait.rarity_score}
                            size="small"
                            color={trait.rarity_score >= 95 ? 'error' : trait.rarity_score >= 85 ? 'warning' : 'primary'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 4: Battles (Placeholder) */}
      <TabPanel value={activeTab} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <SportsEsports sx={{ mr: 1, verticalAlign: 'middle' }} />
              Recent Battles
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info">
              Battle history for this project will be displayed here. Integration with battle system coming soon.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 5: Tournaments (Placeholder) */}
      <TabPanel value={activeTab} index={5}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <People sx={{ mr: 1, verticalAlign: 'middle' }} />
              Active Tournaments
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info">
              Tournament information for this project will be displayed here. Tournament system integration coming soon.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>
    </Container>
  );
}
