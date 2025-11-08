import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  LinearProgress,
  Paper,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  Shield as ShieldIcon,
  Bolt as BoltIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useLocation, useParams } from 'wouter';

interface TimelineEvent {
  id: string;
  sequence: number;
  player_id: string;
  player_handle: string;
  action_type: string;
  target_player_id?: string;
  target_handle?: string;
  damage_dealt: number;
  ai_narration: string;
  image_url?: string;
  created_at: string;
}

interface Battle {
  id: string;
  status: string;
  battle_mode: string;
  battle_type: string;
  combat_type: string;
  max_players: number;
  entry_fee: string;
  entry_currency: string;
  total_prize_pool: string;
  creator: string;
  created_at: string;
  completed_at?: string;
}

interface Participant {
  id: string;
  player_id: string;
  squadron_id: string;
  player_handle: string;
  is_active: boolean;
  total_damage_dealt: string;
  total_damage_taken: string;
  turns_taken: number;
}

export default function BattleDetail() {
  const [, setLocation] = useLocation();
  const { battleId } = useParams<{ battleId: string }>();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('attack');
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (battleId) {
      loadBattleData();
    }
  }, [battleId]);

  const loadBattleData = async () => {
    try {
      setLoading(true);

      // Load battle details
      const battleRes = await fetch(`/api/gaming/battles/${battleId}`, {
        credentials: 'include'
      });
      if (battleRes.ok) {
        const data = await battleRes.json();
        setBattle(data.battle);
        setParticipants(data.participants || []);
      }

      // Load timeline
      const timelineRes = await fetch(`/api/gaming/battles/${battleId}/timeline`, {
        credentials: 'include'
      });
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data.timeline || []);
      }
    } catch (error) {
      console.error('Failed to load battle data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinBattle = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/gaming/battles/${battleId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ /* squadron_id if needed */ }),
      });

      if (response.ok) {
        loadBattleData();
      } else {
        const data = await response.json() as any;
        setError(data.error || 'Failed to join battle');
      }
    } catch (error) {
      setError('Failed to join battle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async () => {
    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`/api/gaming/battles/${battleId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action_type: actionType,
          target_player_id: targetPlayerId || undefined,
        }),
      });

      if (response.ok) {
        setActionDialogOpen(false);
        loadBattleData();
      } else {
        const data = await response.json() as any;
        setError(data.error || 'Failed to perform action');
      }
    } catch (error) {
      setError('Failed to perform action');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading battle...</Typography>
      </Container>
    );
  }

  if (!battle) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Battle not found</Alert>
        <Button startIcon={<BackIcon />} onClick={() => setLocation('/gaming/battles')} sx={{ mt: 2 }}>
          Back to Battles
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Button startIcon={<BackIcon />} onClick={() => setLocation('/gaming/battles')}>
          Back to Battles
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Battle Info */}
        <Grid item xs={12} md={8}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" fontWeight="bold">
                  Battle Details
                </Typography>
                <IconButton onClick={loadBattleData} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Box>

              <Box display="flex" gap={1} mb={3}>
                <Chip label={battle.battle_mode} color="primary" />
                <Chip label={battle.battle_type} color="secondary" />
                <Chip label={battle.combat_type} />
                <Chip 
                  label={battle.status} 
                  color={
                    battle.status === 'pending' ? 'warning' :
                    battle.status === 'active' ? 'success' : 'default'
                  }
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Entry Fee</Typography>
                  <Typography variant="h6">{battle.entry_fee} {battle.entry_currency}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Prize Pool</Typography>
                  <Typography variant="h6" color="success.main">
                    {battle.total_prize_pool} {battle.entry_currency}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Players</Typography>
                  <Typography variant="h6">{participants.length}/{battle.max_players}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Creator</Typography>
                  <Typography variant="body1">{battle.creator}</Typography>
                </Grid>
              </Grid>

              {battle.status === 'pending' && (
                <Box mt={3}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={handleJoinBattle}
                    disabled={submitting}
                  >
                    Join Battle
                  </Button>
                </Box>
              )}

              {battle.status === 'active' && (
                <Box mt={3}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<SendIcon />}
                    onClick={() => setActionDialogOpen(true)}
                  >
                    Take Action
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card elevation={3} sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Battle Timeline
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {timeline.length === 0 ? (
                <Alert severity="info">No actions yet. Be the first to strike!</Alert>
              ) : (
                <List>
                  {timeline.map((event) => (
                    <Paper key={event.id} elevation={1} sx={{ mb: 2, p: 2 }}>
                      <Box display="flex" alignItems="flex-start" gap={2}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {event.action_type === 'attack' ? <FireIcon /> : 
                           event.action_type === 'defend' ? <ShieldIcon /> : <BoltIcon />}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Turn {event.sequence}
                          </Typography>
                          <Typography variant="body1" fontWeight="bold">
                            {event.player_handle} {event.action_type}
                            {event.target_handle && ` → ${event.target_handle}`}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {event.ai_narration}
                          </Typography>
                          {event.damage_dealt > 0 && (
                            <Chip 
                              label={`${event.damage_dealt} damage`} 
                              size="small" 
                              color="error" 
                              sx={{ mt: 1 }}
                            />
                          )}
                          {event.image_url && (
                            <Box mt={2}>
                              <img 
                                src={event.image_url} 
                                alt="Battle scene" 
                                style={{ maxWidth: '100%', borderRadius: 8 }}
                              />
                            </Box>
                          )}
                          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                            {new Date(event.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Participants */}
        <Grid item xs={12} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Participants
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List>
                {participants.map((participant) => (
                  <ListItem key={participant.id} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: participant.is_active ? 'success.main' : 'grey.500' }}>
                        {participant.player_handle[0].toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={participant.player_handle}
                      secondary={
                        <>
                          Damage: {participant.total_damage_dealt} / Taken: {participant.total_damage_taken}
                          <br />
                          Turns: {participant.turns_taken}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Take Action</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Action Type</InputLabel>
            <Select
              value={actionType}
              label="Action Type"
              onChange={(e) => setActionType(e.target.value)}
            >
              <MenuItem value="attack">Attack</MenuItem>
              <MenuItem value="defend">Defend</MenuItem>
              <MenuItem value="special_ability">Special Ability</MenuItem>
            </Select>
          </FormControl>

          {actionType === 'attack' && (
            <FormControl fullWidth>
              <InputLabel>Target Player</InputLabel>
              <Select
                value={targetPlayerId}
                label="Target Player"
                onChange={(e) => setTargetPlayerId(e.target.value)}
              >
                {participants.filter(p => p.is_active).map(p => (
                  <MenuItem key={p.player_id} value={p.player_id}>
                    {p.player_handle}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAction}
            disabled={submitting || (actionType === 'attack' && !targetPlayerId)}
          >
            {submitting ? 'Processing...' : 'Execute'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
