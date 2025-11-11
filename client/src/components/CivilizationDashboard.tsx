import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  Chip,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
  Badge,
  Divider,
  Stack,
  useTheme,
  alpha,
  Collapse,
} from '@mui/material';
import {
  Castle as CastleIcon,
  Church as ReligionIcon,
  AccountBalance as BankIcon,
  Store as MerchantIcon,
  AutoAwesome as SpecialIcon,
  Terrain as LandIcon,
  DirectionsBoat as ShipIcon,
  Security as BattleIcon,
  TrendingUp as TrendingIcon,
  EmojiEvents as TrophyIcon,
  ExpandMore as ExpandIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

interface CivilizationData {
  wallet_address: string;
  civilization_name: string;
  army_power: number;
  religion_power: number;
  bank_power: number;
  merchant_power: number;
  special_power: number;
  total_power: number;
  army_count: number;
  religion_count: number;
  bank_count: number;
  merchant_count: number;
  special_count: number;
  land_count: number;
  ship_count: number;
  material_output: number;
  battle_readiness: number;
  overall_rank: number;
}

export default function CivilizationDashboard() {
  const theme = useTheme();
  const [civilization, setCivilization] = useState<CivilizationData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCivilizationData();
  }, []);

  const fetchCivilizationData = async () => {
    try {
      const response = await fetch('/api/player/civilization');
      const data = await response.json();
      setCivilization(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch civilization data:', error);
      setLoading(false);
    }
  };

  if (loading || !civilization) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress />
      </Box>
    );
  }

  const powerSections = [
    { 
      icon: CastleIcon, 
      label: 'Army', 
      power: civilization.army_power, 
      count: civilization.army_count,
      color: '#ff4444',
      gradient: 'linear-gradient(135deg, #ff4444 0%, #ff6666 100%)'
    },
    { 
      icon: ReligionIcon, 
      label: 'Religion', 
      power: civilization.religion_power, 
      count: civilization.religion_count,
      color: '#ffaa00',
      gradient: 'linear-gradient(135deg, #ffaa00 0%, #ffcc00 100%)'
    },
    { 
      icon: BankIcon, 
      label: 'Bank', 
      power: civilization.bank_power, 
      count: civilization.bank_count,
      color: '#44ff44',
      gradient: 'linear-gradient(135deg, #44ff44 0%, #66ff66 100%)'
    },
    { 
      icon: MerchantIcon, 
      label: 'Merchant', 
      power: civilization.merchant_power, 
      count: civilization.merchant_count,
      color: '#4444ff',
      gradient: 'linear-gradient(135deg, #4444ff 0%, #6666ff 100%)'
    },
    { 
      icon: SpecialIcon, 
      label: 'Special', 
      power: civilization.special_power, 
      count: civilization.special_count,
      color: '#ff44ff',
      gradient: 'linear-gradient(135deg, #ff44ff 0%, #ff66ff 100%)'
    },
  ];

  const maxPower = Math.max(...powerSections.map(s => s.power));

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Hero Header */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.secondary.main, 0.9)} 100%)`,
          borderRadius: 4,
          p: 4,
          mb: 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url(/medieval-pattern.png)',
            opacity: 0.1,
          }
        }}
      >
        <Stack direction="row" spacing={3} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
          <Avatar
            sx={{
              width: 120,
              height: 120,
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              fontSize: 48,
              border: '4px solid rgba(255,255,255,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <ShieldIcon sx={{ fontSize: 64 }} />
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3" sx={{ color: 'white', fontWeight: 800, mb: 1 }}>
              {civilization.civilization_name}
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', mb: 2 }}>
              {civilization.wallet_address.substring(0, 16)}...
            </Typography>
            
            <Stack direction="row" spacing={2}>
              <Chip
                icon={<TrophyIcon />}
                label={`Rank #${civilization.overall_rank.toLocaleString()}`}
                sx={{
                  bgcolor: 'rgba(255,215,0,0.9)',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
              />
              <Chip
                icon={<TrendingIcon />}
                label={`Power: ${civilization.total_power.toLocaleString()}`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.9)',
                  color: '#000',
                  fontWeight: 'bold',
                }}
              />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Key Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card
            elevation={4}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BattleIcon sx={{ fontSize: 48 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {civilization.battle_readiness.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Battle Readiness</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            elevation={4}
            sx={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <TrendingIcon sx={{ fontSize: 48 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {civilization.material_output.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Material Output</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            elevation={4}
            sx={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <LandIcon sx={{ fontSize: 48 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {civilization.land_count}
                  </Typography>
                  <Typography variant="body2">Land Plots</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Power Distribution */}
      <Card elevation={4} sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <TrophyIcon sx={{ mr: 1, color: 'gold' }} />
            Civilization Power Distribution
          </Typography>

          <Grid container spacing={3}>
            {powerSections.map((section, index) => {
              const Icon = section.icon;
              const percentage = maxPower > 0 ? (section.power / maxPower) * 100 : 0;

              return (
                <Grid item xs={12} key={index}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            background: section.gradient,
                            boxShadow: `0 4px 12px ${alpha(section.color, 0.4)}`,
                          }}
                        >
                          <Icon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {section.label}
                        </Typography>
                        <Badge badgeContent={section.count} color="primary" sx={{ ml: 1 }} />
                      </Stack>
                      
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: section.color }}>
                        {section.power.toLocaleString()}
                      </Typography>
                    </Stack>

                    <Box sx={{ position: 'relative' }}>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{
                          height: 16,
                          borderRadius: 2,
                          bgcolor: alpha(section.color, 0.1),
                          '& .MuiLinearProgress-bar': {
                            background: section.gradient,
                            borderRadius: 2,
                            boxShadow: `0 2px 8px ${alpha(section.color, 0.4)}`,
                          }
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Assets Summary */}
      <Card elevation={4} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
            Civilization Assets
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                }}
              >
                <CastleIcon sx={{ fontSize: 48, color: '#ff4444', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {civilization.army_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Army Units
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                }}
              >
                <ReligionIcon sx={{ fontSize: 48, color: '#ffaa00', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {civilization.religion_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Religious Sites
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                }}
              >
                <BankIcon sx={{ fontSize: 48, color: '#44ff44', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {civilization.bank_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Banks
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                }}
              >
                <ShipIcon sx={{ fontSize: 48, color: '#4444ff', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {civilization.ship_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Naval Fleet
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
