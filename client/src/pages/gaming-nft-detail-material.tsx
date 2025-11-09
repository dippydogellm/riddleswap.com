import { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Card,
  CardMedia,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
} from '@mui/material';
import {
  Star,
  EmojiEvents,
  Assessment,
  History,
  Person,
  ContentCopy,
  OpenInNew,
  AutoAwesome,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import RarityBadge from '@/components/RarityBadge';
import TraitCard from '@/components/TraitCard';
import StatsCard from '@/components/StatsCard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface NFTData {
  id: string;
  name: string;
  image_url?: string;
  collection_name?: string;
  current_owner?: string;
}

interface TraitScore {
  value: string;
  count: number;
  percentage: number;
  score: number;
}

interface ScorecardData {
  nft_id: string;
  nft_name: string;
  total_rarity_score: number;
  average_rarity_score: string;
  rarity_tier: string;
  rarity_rank?: number;
  total_traits: number;
  trait_scores: Record<string, TraitScore>;
}

interface BattleData {
  id: number;
  opponent_nft_id: string;
  battle_result: string;
  power_change: number;
  battle_date: string;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function GamingNFTDetail() {
  const [, params] = useRoute<{ nftId: string }>('/gaming/nft/:nftId');
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const nftId = (params && params.nftId) || '';

  // Fetch NFT details
  const { data: nft, isLoading: loadingNFT, error: nftError } = useQuery<NFTData>({
    queryKey: [`/api/gaming/nft/${nftId}`],
    enabled: !!nftId,
  });

  // Fetch rarity scorecard
  const { data: scorecard, isLoading: loadingScorecard } = useQuery<ScorecardData>({
    queryKey: [`/api/scorecards/nft/${nftId}`],
    enabled: !!nftId,
  });

  // Fetch battle history
  const { data: battles, isLoading: loadingBattles } = useQuery<BattleData[]>({
    queryKey: [`/api/battles/nft/${nftId}`],
    enabled: !!nftId,
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingNFT) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (nftError || !nft) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          NFT not found or failed to load.
        </Alert>
      </Container>
    );
  }

  const scorecardData = Array.isArray(scorecard) && scorecard.length > 0 ? scorecard[0] : null;
  const traitScores = scorecardData?.trait_scores || {};
  const battlesArray = Array.isArray(battles) ? battles : [];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Back Button */}
      <Button 
        href="/gaming/dashboard" 
        sx={{ mb: 2 }}
        startIcon={<OpenInNew sx={{ transform: 'rotate(180deg)' }} />}
      >
        Back to Dashboard
      </Button>

      <Grid container spacing={4}>
        {/* Left Column - NFT Image & Quick Stats */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardMedia
              component="img"
              image={nft.image_url || 'https://via.placeholder.com/400x400?text=NFT'}
              alt={nft.name}
              sx={{ 
                aspectRatio: '1/1',
                objectFit: 'cover',
                bgcolor: 'rgba(0,0,0,0.1)',
              }}
            />
            <CardContent>
              <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
                {nft.name || `NFT #${nft.id}`}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {nft.collection_name || 'Unknown Collection'}
              </Typography>

              {scorecardData?.rarity_tier && (
                <Box sx={{ mb: 2 }}>
                  <RarityBadge tier={scorecardData.rarity_tier} size="medium" />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* NFT ID with Copy */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                  {nftId}
                </Typography>
                <Button
                  size="small"
                  onClick={() => copyToClipboard(nftId || '')}
                  startIcon={<ContentCopy />}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </Box>

              {/* Owner Info */}
              {nft.current_owner && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Owned by: {nft.current_owner.slice(0, 8)}...{nft.current_owner.slice(-6)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          {scorecard && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <StatsCard
                  title="Total Rarity Score"
                  value={scorecard.total_rarity_score || 0}
                  subtitle="Combined trait scores"
                  icon={<Star sx={{ fontSize: 28 }} />}
                  color="#FFD700"
                />
              </Grid>
              <Grid item xs={12}>
                <StatsCard
                  title="Average Score"
                  value={scorecard.average_rarity_score || 0}
                  subtitle="Per trait average"
                  icon={<Assessment sx={{ fontSize: 28 }} />}
                  color="#9C27B0"
                />
              </Grid>
              <Grid item xs={12}>
                <StatsCard
                  title="Total Traits"
                  value={scorecard.total_traits || 0}
                  subtitle="Unique attributes"
                  icon={<AutoAwesome sx={{ fontSize: 28 }} />}
                  color="#2196F3"
                />
              </Grid>
            </Grid>
          )}
        </Grid>

        {/* Right Column - Detailed Info */}
        <Grid item xs={12} md={8}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab icon={<Star />} label="Traits" iconPosition="start" />
                <Tab icon={<EmojiEvents />} label="Rarity Details" iconPosition="start" />
                <Tab icon={<History />} label="Battle History" iconPosition="start" />
              </Tabs>
            </Box>

            {/* Traits Tab */}
            <TabPanel value={activeTab} index={0}>
              <Box sx={{ p: 3 }}>
                {loadingScorecard ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : Object.keys(traitScores).length === 0 ? (
                  <Alert severity="info">
                    No trait data available for this NFT.
                  </Alert>
                ) : (
                  <Grid container spacing={2}>
                    {Object.entries(traitScores).map(([traitType, data]: [string, any]) => (
                      <Grid item xs={12} sm={6} md={4} key={traitType}>
                        <TraitCard
                          traitType={traitType}
                          traitValue={data.value}
                          rarityScore={data.score}
                          percentage={data.percentage}
                          count={data.count}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            </TabPanel>

            {/* Rarity Details Tab */}
            <TabPanel value={activeTab} index={1}>
              <Box sx={{ p: 3 }}>
                {loadingScorecard ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : !scorecard ? (
                  <Alert severity="info">
                    Rarity score not yet calculated for this NFT.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} sx={{ bgcolor: 'background.default' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Trait Type</strong></TableCell>
                          <TableCell><strong>Value</strong></TableCell>
                          <TableCell align="right"><strong>Rarity %</strong></TableCell>
                          <TableCell align="right"><strong>Score</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(traitScores).map(([traitType, data]: [string, any]) => (
                          <TableRow key={traitType} hover>
                            <TableCell>{traitType}</TableCell>
                            <TableCell>
                              <Chip label={data.value} size="small" />
                            </TableCell>
                            <TableCell align="right">
                              {data.percentage.toFixed(2)}%
                            </TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={data.score} 
                                size="small" 
                                color="primary"
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </TabPanel>

            {/* Battle History Tab */}
            <TabPanel value={activeTab} index={2}>
              <Box sx={{ p: 3 }}>
                {loadingBattles ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : battlesArray.length === 0 ? (
                  <Alert severity="info">
                    This NFT hasn't been used in any battles yet.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} sx={{ bgcolor: 'background.default' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Battle ID</strong></TableCell>
                          <TableCell><strong>Date</strong></TableCell>
                          <TableCell><strong>Opponent</strong></TableCell>
                          <TableCell><strong>Result</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {battlesArray.map((battle: any) => (
                          <TableRow key={battle.id} hover>
                            <TableCell>#{battle.id}</TableCell>
                            <TableCell>
                              {new Date(battle.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{battle.opponent_name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Chip
                                label={battle.result === 'won' ? 'Victory' : 'Defeat'}
                                color={battle.result === 'won' ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </TabPanel>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
