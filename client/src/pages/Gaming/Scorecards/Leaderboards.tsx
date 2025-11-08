import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Avatar,
  Chip,
  Alert,
  Button,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  Shield as ShieldIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

interface LeaderboardEntry {
  rank: number;
  nft_id: string;
  collection_id: string;
  total_battles: number;
  total_kills: number;
  total_damage_dealt: string;
  total_damage_taken: string;
  win_rate: number;
  medals: number;
}

export default function Leaderboards() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      
      const sortBy = activeTab === 0 ? 'battles' : 
                     activeTab === 1 ? 'kills' : 
                     activeTab === 2 ? 'damage' : 'medals';

      const response = await fetch(`/api/gaming/leaderboards?sort=${sortBy}&limit=100`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json() as any;
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (rank: number) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return undefined;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          Leaderboards
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Top performing NFTs across all battles
        </Typography>
      </Box>

      {/* Tabs */}
      <Card elevation={3}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="Most Battles" />
            <Tab label="Most Kills" />
            <Tab label="Highest Damage" />
            <Tab label="Most Medals" />
          </Tabs>
        </Box>

        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={80}>Rank</TableCell>
                  <TableCell>NFT ID</TableCell>
                  <TableCell align="right">Battles</TableCell>
                  <TableCell align="right">Kills</TableCell>
                  <TableCell align="right">Damage Dealt</TableCell>
                  <TableCell align="right">Damage Taken</TableCell>
                  <TableCell align="center">Medals</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Alert severity="info">No leaderboard data yet</Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  leaderboard.map((entry) => (
                    <TableRow 
                      key={entry.nft_id} 
                      hover
                      sx={{ 
                        bgcolor: entry.rank <= 3 ? `${getMedalColor(entry.rank)}15` : undefined 
                      }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6" fontWeight="bold">
                            #{entry.rank}
                          </Typography>
                          {entry.rank <= 3 && (
                            <TrophyIcon sx={{ color: getMedalColor(entry.rank) }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {entry.nft_id.slice(0, 12)}...
                        </Typography>
                        {entry.collection_id && (
                          <Typography variant="caption" color="text.secondary">
                            {entry.collection_id.slice(0, 8)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{entry.total_battles}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                          <FireIcon fontSize="small" color="error" />
                          <Typography fontWeight="bold">{entry.total_kills}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="error.main" fontWeight="bold">
                          {parseFloat(entry.total_damage_dealt).toFixed(0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="warning.main">
                          {parseFloat(entry.total_damage_taken).toFixed(0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={entry.medals}
                          icon={<StarIcon />}
                          size="small"
                          color="warning"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setLocation(`/gaming/nfts/${entry.nft_id}/scorecard`)}
                        >
                          View Stats
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  );
}
