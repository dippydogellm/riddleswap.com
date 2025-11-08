/**
 * NFT Power Breakdown Component
 * Material UI - Shows power levels with visual breakdown
 */

import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Grid,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Church as ChurchIcon,
  AccountBalance as CivilizationIcon,
  MonetizationOn as EconomicIcon,
  Star as StarIcon,
} from '@mui/icons-material';

interface PowerBreakdownProps {
  armyPower: number;
  religionPower: number;
  civilizationPower: number;
  economicPower: number;
  totalPower: number;
  materialMultiplier?: number;
  rarityMultiplier?: number;
  traitMapping?: Record<string, number>;
}

export default function NFTPowerBreakdown({
  armyPower,
  religionPower,
  civilizationPower,
  economicPower,
  totalPower,
  materialMultiplier = 1,
  rarityMultiplier = 1,
  traitMapping = {},
}: PowerBreakdownProps) {
  const maxPower = Math.max(armyPower, religionPower, civilizationPower, economicPower);

  const powers = [
    {
      name: 'Army Power',
      value: armyPower,
      icon: <ShieldIcon />,
      color: '#e63946',
      description: 'Military strength and combat effectiveness',
    },
    {
      name: 'Religion Power',
      value: religionPower,
      icon: <ChurchIcon />,
      color: '#f1c40f',
      description: 'Religious influence and divine authority',
    },
    {
      name: 'Civilization Power',
      value: civilizationPower,
      icon: <CivilizationIcon />,
      color: '#3498db',
      description: 'Cultural influence and development',
    },
    {
      name: 'Economic Power',
      value: economicPower,
      icon: <EconomicIcon />,
      color: '#2ecc71',
      description: 'Wealth and trade influence',
    },
  ];

  const getPowerRank = (power: number): string => {
    if (power >= 1000) return 'Legendary';
    if (power >= 500) return 'Epic';
    if (power >= 250) return 'Rare';
    if (power >= 100) return 'Uncommon';
    return 'Common';
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Stack spacing={3}>
          {/* Total Power Header */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Total Power
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <StarIcon sx={{ color: '#ffd700' }} />
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {totalPower.toLocaleString()}
                </Typography>
              </Stack>
            </Stack>
            <Chip
              label={getPowerRank(totalPower)}
              color="primary"
              size="small"
            />
          </Box>

          {/* Individual Powers */}
          <Grid container spacing={2}>
            {powers.map((power) => (
              <Grid item xs={12} key={power.name}>
                <Tooltip title={power.description} arrow>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: power.color }}>
                          {power.icon}
                        </Box>
                        <Typography variant="body2" fontWeight="medium">
                          {power.name}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="bold">
                        {power.value.toLocaleString()}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={maxPower > 0 ? (power.value / maxPower) * 100 : 0}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'rgba(0,0,0,0.1)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: power.color,
                          borderRadius: 1,
                        },
                      }}
                    />
                  </Box>
                </Tooltip>
              </Grid>
            ))}
          </Grid>

          {/* Multipliers */}
          {(materialMultiplier !== 1 || rarityMultiplier !== 1) && (
            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Power Multipliers
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Material Bonus
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ×{materialMultiplier.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Rarity Bonus
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ×{rarityMultiplier.toFixed(2)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Trait Contributions */}
          {Object.keys(traitMapping).length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Trait Power Contributions
              </Typography>
              <Stack spacing={1}>
                {Object.entries(traitMapping)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([trait, value]) => (
                    <Stack
                      key={trait}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="caption" color="text.secondary">
                        {trait}
                      </Typography>
                      <Chip label={`+${value}`} size="small" />
                    </Stack>
                  ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
