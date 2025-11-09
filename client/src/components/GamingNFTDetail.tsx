// ============================================================================
// GAMING NFT DETAIL COMPONENT
// ============================================================================
// Reusable component for displaying detailed NFT information
// Features: Power stats, Battle history, Power history, Images
// Can be used on any page with Gaming NFT data
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// MATERIAL UI COMPONENTS
// ============================================================================
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';

// ============================================================================
// ICONS
// ============================================================================
import { 
  Sword, Shield, Sparkles, Coins, TrendingUp, 
  History, Zap, Target, Award, RefreshCw 
} from 'lucide-react';

// ============================================================================
// INTERFACES
// ============================================================================
interface GamingNFT {
  id: string;
  nft_token_id: string;
  nft_name: string;
  collection_name: string;
  original_image_url: string;
  cdn_image_url?: string;
  battle_image_url?: string;
  current_owner?: string;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  character_class?: string;
  rarity_score?: number;
}

interface BattleHistory {
  id: string;
  battle_date: string;
  opponent_name: string;
  result: 'win' | 'loss' | 'draw';
  power_used: number;
  rewards_earned?: number;
}

interface PowerHistory {
  date: string;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
}

interface GamingNFTDetailProps {
  nft: GamingNFT;
  onRefresh?: () => void;
  showActions?: boolean;
}

// ============================================================================
// STAT BAR COMPONENT
// ============================================================================
const StatBar = ({ 
  label, 
  value, 
  max, 
  color, 
  icon 
}: { 
  label: string; 
  value: number; 
  max: number; 
  color: string;
  icon: React.ReactNode;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorMap: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#a855f7',
    yellow: '#eab308',
    green: '#22c55e'
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="body2" fontWeight="medium">{label}</Typography>
        </Box>
        <Typography variant="body2" fontWeight="bold">{value.toFixed(0)}</Typography>
      </Box>
      <LinearProgress 
        variant="determinate" 
        value={percentage} 
        sx={{ 
          height: 8, 
          borderRadius: 1,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            bgcolor: colorMap[color] || colorMap.blue,
            borderRadius: 1
          }
        }}
      />
    </Box>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function GamingNFTDetail({ 
  nft, 
  onRefresh, 
  showActions = true 
}: GamingNFTDetailProps) {
  const { toast } = useToast();
  const [generatingBattle, setGeneratingBattle] = useState(false);

  // ============================================================================
  // FETCH BATTLE HISTORY
  // ============================================================================
  const { data: battleHistory = [] } = useQuery<BattleHistory[]>({
    queryKey: ['battle-history', nft.id],
    queryFn: async () => {
      const res = await fetch(`/api/gaming/nfts/${nft.id}/battle-history`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000
  });

  // ============================================================================
  // FETCH POWER HISTORY
  // ============================================================================
  const { data: powerHistory = [] } = useQuery<PowerHistory[]>({
    queryKey: ['power-history', nft.id],
    queryFn: async () => {
      const res = await fetch(`/api/gaming/nfts/${nft.id}/power-history`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000
  });

  // ============================================================================
  // GENERATE BATTLE IMAGE
  // ============================================================================
  const handleGenerateBattleImage = async () => {
    setGeneratingBattle(true);
    try {
      toast({
        title: "Generating Battle Image",
        description: "Creating AI-powered battle image with DALL-E 3...",
      });
      
      const response = await fetch(`/api/gaming/nfts/${nft.id}/generate-battle-image`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate battle image');
      }
      
      toast({
        title: "Success!",
        description: "Battle image generated successfully",
      });
      
      onRefresh?.();
    } catch (error) {
      console.error('Error generating battle image:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate battle image",
        variant: "destructive",
      });
    } finally {
      setGeneratingBattle(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={3}>
        
        {/* ================================================================ */}
        {/* LEFT COLUMN - IMAGES */}
        {/* ================================================================ */}
        <Grid item xs={12} lg={5}>
          <Box sx={{ position: 'sticky', top: 20 }}>
            
            {/* Original NFT Image */}
            <Card elevation={3} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Original NFT
                </Typography>
                <CardMedia
                  component="img"
                  image={nft.cdn_image_url || nft.original_image_url}
                  alt={nft.nft_name}
                  sx={{
                    width: '100%',
                    aspectRatio: '1/1',
                    objectFit: 'cover',
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: 'primary.main'
                  }}
                  onError={(e: any) => {
                    e.target.src = '/inquisition-card.png';
                  }}
                />
              </CardContent>
            </Card>

            {/* Battle Image */}
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    AI Battle Image
                  </Typography>
                  {showActions && !nft.battle_image_url && (
                    <Button 
                      size="small" 
                      variant="contained"
                      onClick={handleGenerateBattleImage}
                      disabled={generatingBattle}
                      startIcon={generatingBattle ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                    >
                      Generate
                    </Button>
                  )}
                </Box>
                {nft.battle_image_url ? (
                  <CardMedia
                    component="img"
                    image={nft.battle_image_url}
                    alt={`${nft.nft_name} - Battle`}
                    sx={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'cover',
                      borderRadius: 2,
                      border: '2px solid',
                      borderColor: 'secondary.main'
                    }}
                  />
                ) : (
                  <Box sx={{
                    width: '100%',
                    aspectRatio: '1/1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: 'divider'
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      No battle image generated
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>

        {/* ================================================================ */}
        {/* RIGHT COLUMN - STATS & HISTORY */}
        {/* ================================================================ */}
        <Grid item xs={12} lg={7}>
          
          {/* NFT Info Card */}
          <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {nft.nft_name}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                <Chip label={nft.collection_name} color="primary" size="small" />
                {nft.character_class && (
                  <Chip label={nft.character_class} color="secondary" size="small" />
                )}
                {nft.rarity_score && (
                  <Chip 
                    icon={<Award size={14} />} 
                    label={`Rarity: ${Number(nft.rarity_score).toFixed(2)}`} 
                    size="small" 
                  />
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Metadata */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Token ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                    {nft.nft_token_id}
                  </Typography>
                </Grid>
                {nft.current_owner && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Owner</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                      {nft.current_owner.slice(0, 12)}...{nft.current_owner.slice(-8)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Power Attributes Card */}
          <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Target size={20} />
                Power Attributes
              </Typography>
              
              <Divider sx={{ my: 2 }} />

              <StatBar 
                label="Army Power" 
                value={nft.army_power} 
                max={500} 
                color="red" 
                icon={<Sword size={16} color="#ef4444" />} 
              />
              <StatBar 
                label="Religion Power" 
                value={nft.religion_power} 
                max={500} 
                color="blue" 
                icon={<Shield size={16} color="#3b82f6" />} 
              />
              <StatBar 
                label="Civilization Power" 
                value={nft.civilization_power} 
                max={500} 
                color="purple" 
                icon={<Sparkles size={16} color="#a855f7" />} 
              />
              <StatBar 
                label="Economic Power" 
                value={nft.economic_power} 
                max={500} 
                color="yellow" 
                icon={<Coins size={16} color="#eab308" />} 
              />

              <Divider sx={{ my: 2 }} />

              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                p: 2,
                bgcolor: 'primary.main',
                borderRadius: 2,
                color: 'white'
              }}>
                <Typography variant="h6" fontWeight="bold">Total Power</Typography>
                <Typography variant="h4" fontWeight="bold">
                  {Number(nft.total_power).toFixed(0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Battle History Card */}
          <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sword size={20} />
                Battle History
              </Typography>
              
              <Divider sx={{ my: 2 }} />

              {battleHistory.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell><strong>Opponent</strong></TableCell>
                        <TableCell align="center"><strong>Result</strong></TableCell>
                        <TableCell align="right"><strong>Power Used</strong></TableCell>
                        <TableCell align="right"><strong>Rewards</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {battleHistory.slice(0, 10).map((battle) => (
                        <TableRow key={battle.id}>
                          <TableCell>
                            {new Date(battle.battle_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{battle.opponent_name}</TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={battle.result.toUpperCase()} 
                              size="small"
                              color={
                                battle.result === 'win' ? 'success' : 
                                battle.result === 'loss' ? 'error' : 
                                'default'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">{battle.power_used}</TableCell>
                          <TableCell align="right">
                            {battle.rewards_earned ? `${battle.rewards_earned} XRP` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4, 
                  bgcolor: 'action.hover', 
                  borderRadius: 2 
                }}>
                  <Typography variant="body2" color="text.secondary">
                    No battle history available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Power History Card */}
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp size={20} />
                Power History
              </Typography>
              
              <Divider sx={{ my: 2 }} />

              {powerHistory.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell align="center"><strong>Army</strong></TableCell>
                        <TableCell align="center"><strong>Religion</strong></TableCell>
                        <TableCell align="center"><strong>Civilization</strong></TableCell>
                        <TableCell align="center"><strong>Economic</strong></TableCell>
                        <TableCell align="right"><strong>Total</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {powerHistory.slice(0, 10).map((history, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(history.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="center">{history.army_power.toFixed(0)}</TableCell>
                          <TableCell align="center">{history.religion_power.toFixed(0)}</TableCell>
                          <TableCell align="center">{history.civilization_power.toFixed(0)}</TableCell>
                          <TableCell align="center">{history.economic_power.toFixed(0)}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold">{history.total_power.toFixed(0)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4, 
                  bgcolor: 'action.hover', 
                  borderRadius: 2 
                }}>
                  <Typography variant="body2" color="text.secondary">
                    No power history available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
