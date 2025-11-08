import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Switch,
  Slider,
  Alert,
  Chip,
  Divider,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

const steps = ['Battle Settings', 'Wagering & Prizes', 'Review & Create'];

export default function BattleCreate() {
  const [, setLocation] = useLocation();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [squadrons, setSquadrons] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    // Battle Settings
    creator_squadron_id: '',
    battle_mode: '1v1',
    max_players: 2,
    battle_type: 'free_for_all',
    combat_type: 'military',
    land_type: 'plains',
    response_timeout_seconds: 300,
    battle_length_minutes: 30,
    is_private: false,
    invited_players: [] as string[],
    
    // Project Requirements
    required_project_nft: '',
    min_nfts_from_project: 1,
    
    // Wagering
    entry_fee: 0,
    entry_currency: 'XRP',
    payout_structure: {
      first_place_percent: 70,
      second_place_percent: 20,
      third_place_percent: 10,
    },
    
    // NFT Prizes
    nft_prizes: {
      first_place_nft_id: '',
      second_place_nft_id: '',
      third_place_nft_id: '',
    },
  });

  useEffect(() => {
    loadSquadrons();
  }, []);

  const loadSquadrons = async () => {
    try {
      const response = await fetch('/api/gaming/player/squadrons', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json() as any;
        setSquadrons(data.squadrons || []);
      }
    } catch (error) {
      console.error('Failed to load squadrons:', error);
    }
  };

  const handleNext = () => {
    // Validate current step
    if (activeStep === 0) {
      if (!formData.creator_squadron_id) {
        setError('Please select a squadron');
        return;
      }
    }
    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/gaming/battles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json() as any;

      if (response.ok) {
        setLocation(`/gaming/battles/${data.id}`);
      } else {
        setError(data.error || 'Failed to create battle');
      }
    } catch (error) {
      setError('Failed to create battle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...(formData as any)[parent],
          [child]: value,
        },
      });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const renderBattleSettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <FormControl fullWidth required>
          <InputLabel>Select Squadron</InputLabel>
          <Select
            value={formData.creator_squadron_id}
            label="Select Squadron"
            onChange={(e) => updateFormData('creator_squadron_id', e.target.value)}
          >
            {squadrons.map(squadron => (
              <MenuItem key={squadron.id} value={squadron.id}>
                {squadron.name || `Squadron ${squadron.id.slice(0, 8)}`} - Power: {squadron.total_power}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Battle Mode</InputLabel>
          <Select
            value={formData.battle_mode}
            label="Battle Mode"
            onChange={(e) => {
              updateFormData('battle_mode', e.target.value);
              updateFormData('max_players', e.target.value === '1v1' ? 2 : 4);
            }}
          >
            <MenuItem value="1v1">1v1 (Head to Head)</MenuItem>
            <MenuItem value="multiplayer">Multiplayer (2-20 players)</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      {formData.battle_mode === 'multiplayer' && (
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="number"
            label="Max Players"
            value={formData.max_players}
            onChange={(e) => updateFormData('max_players', parseInt(e.target.value))}
            inputProps={{ min: 2, max: 20 }}
            helperText="2-20 players"
          />
        </Grid>
      )}

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Battle Type</InputLabel>
          <Select
            value={formData.battle_type}
            label="Battle Type"
            onChange={(e) => updateFormData('battle_type', e.target.value)}
          >
            <MenuItem value="free_for_all">Free For All</MenuItem>
            <MenuItem value="team">Team Battle</MenuItem>
            <MenuItem value="elimination">Elimination</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Combat Type</InputLabel>
          <Select
            value={formData.combat_type}
            label="Combat Type"
            onChange={(e) => updateFormData('combat_type', e.target.value)}
          >
            <MenuItem value="military">Military</MenuItem>
            <MenuItem value="religious">Religious</MenuItem>
            <MenuItem value="social">Social</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Land Type</InputLabel>
          <Select
            value={formData.land_type}
            label="Land Type"
            onChange={(e) => updateFormData('land_type', e.target.value)}
          >
            <MenuItem value="plains">Plains</MenuItem>
            <MenuItem value="mountains">Mountains</MenuItem>
            <MenuItem value="forest">Forest</MenuItem>
            <MenuItem value="desert">Desert</MenuItem>
            <MenuItem value="coast">Coast</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography gutterBottom>Response Timeout: {formData.response_timeout_seconds}s</Typography>
        <Slider
          value={formData.response_timeout_seconds}
          onChange={(_, v) => updateFormData('response_timeout_seconds', v)}
          min={10}
          max={1800}
          step={10}
          marks={[
            { value: 10, label: '10s' },
            { value: 300, label: '5min' },
            { value: 1800, label: '30min' },
          ]}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography gutterBottom>Battle Length: {formData.battle_length_minutes} min</Typography>
        <Slider
          value={formData.battle_length_minutes}
          onChange={(_, v) => updateFormData('battle_length_minutes', v)}
          min={5}
          max={120}
          step={5}
          marks={[
            { value: 5, label: '5min' },
            { value: 30, label: '30min' },
            { value: 120, label: '2hr' },
          ]}
        />
      </Grid>

      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={formData.is_private}
              onChange={(e) => updateFormData('is_private', e.target.checked)}
            />
          }
          label="Private Battle (Invite Only)"
        />
      </Grid>
    </Grid>
  );

  const renderWageringPrizes = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>Entry Fee</Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          type="number"
          label="Entry Fee Amount"
          value={formData.entry_fee}
          onChange={(e) => updateFormData('entry_fee', parseFloat(e.target.value) || 0)}
          inputProps={{ min: 0, step: 0.01 }}
          InputProps={{
            endAdornment: <InputAdornment position="end">{formData.entry_currency}</InputAdornment>,
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Currency</InputLabel>
          <Select
            value={formData.entry_currency}
            label="Currency"
            onChange={(e) => updateFormData('entry_currency', e.target.value)}
          >
            <MenuItem value="XRP">XRP</MenuItem>
            <MenuItem value="RDL">RDL</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12}>
        <Divider />
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Prize Distribution (After 20% Riddle Fee)
        </Typography>
      </Grid>

      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          type="number"
          label="1st Place %"
          value={formData.payout_structure.first_place_percent}
          onChange={(e) => updateFormData('payout_structure.first_place_percent', parseFloat(e.target.value) || 0)}
          inputProps={{ min: 0, max: 100 }}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />
      </Grid>

      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          type="number"
          label="2nd Place %"
          value={formData.payout_structure.second_place_percent}
          onChange={(e) => updateFormData('payout_structure.second_place_percent', parseFloat(e.target.value) || 0)}
          inputProps={{ min: 0, max: 100 }}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />
      </Grid>

      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          type="number"
          label="3rd Place %"
          value={formData.payout_structure.third_place_percent}
          onChange={(e) => updateFormData('payout_structure.third_place_percent', parseFloat(e.target.value) || 0)}
          inputProps={{ min: 0, max: 100 }}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />
      </Grid>

      {(formData.payout_structure.first_place_percent + 
        formData.payout_structure.second_place_percent + 
        formData.payout_structure.third_place_percent) > 100 && (
        <Grid item xs={12}>
          <Alert severity="error">Payout percentages cannot exceed 100%</Alert>
        </Grid>
      )}
    </Grid>
  );

  const renderReview = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity="info">
          Review your battle settings before creating
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <Typography variant="h6">Battle Settings</Typography>
        <Box mt={1}>
          <Chip label={`Mode: ${formData.battle_mode}`} sx={{ mr: 1, mb: 1 }} />
          <Chip label={`Players: ${formData.max_players}`} sx={{ mr: 1, mb: 1 }} />
          <Chip label={`Type: ${formData.battle_type}`} sx={{ mr: 1, mb: 1 }} />
          <Chip label={`Combat: ${formData.combat_type}`} sx={{ mr: 1, mb: 1 }} />
        </Box>
      </Grid>

      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6">Wagering</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          Entry Fee: {formData.entry_fee} {formData.entry_currency}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Prize Pool: {formData.entry_fee * formData.max_players * 0.8} {formData.entry_currency} (after 20% fee)
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6">Prize Distribution</Typography>
        <Typography variant="body2">
          1st: {formData.payout_structure.first_place_percent}% | 
          2nd: {formData.payout_structure.second_place_percent}% | 
          3rd: {formData.payout_structure.third_place_percent}%
        </Typography>
      </Grid>
    </Grid>
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box mb={4}>
        <Button startIcon={<BackIcon />} onClick={() => setLocation('/gaming/battles')}>
          Back to Battles
        </Button>
        <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
          Create Battle
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your battle and challenge other players
        </Typography>
      </Box>

      <Card elevation={3}>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ minHeight: 400 }}>
            {activeStep === 0 && renderBattleSettings()}
            {activeStep === 1 && renderWageringPrizes()}
            {activeStep === 2 && renderReview()}
          </Box>

          <Box display="flex" justifyContent="space-between" mt={4}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<BackIcon />}
            >
              Back
            </Button>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                startIcon={<CheckIcon />}
              >
                {loading ? 'Creating...' : 'Create Battle'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<ForwardIcon />}
              >
                Next
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
