/**
 * NFT Traits Display Component
 * Material UI - Shows all traits with visual styling
 */

import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Star as StarIcon,
  Palette as PaletteIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';

interface NFTTraitsDisplayProps {
  allTraits: Record<string, any>;
  specialPowers?: string[];
  materialsFound?: string[];
  raritiesFound?: string[];
  collectionName: string;
}

export default function NFTTraitsDisplay({
  allTraits,
  specialPowers = [],
  materialsFound = [],
  raritiesFound = [],
  collectionName,
}: NFTTraitsDisplayProps) {
  const getRarityColor = (rarity: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    const r = rarity.toLowerCase();
    if (r.includes('legendary') || r.includes('mythic')) return 'error';
    if (r.includes('epic')) return 'secondary';
    if (r.includes('rare')) return 'primary';
    if (r.includes('uncommon')) return 'info';
    return 'default';
  };

  const formatTraitValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return value.value || value.trait_type || JSON.stringify(value);
    }
    return String(value);
  };

  // Group traits by category
  const groupedTraits: Record<string, Record<string, any>> = {};
  Object.entries(allTraits).forEach(([key, value]) => {
    const category = key.includes('armor') ? 'Armor' :
                     key.includes('weapon') ? 'Weapons' :
                     key.includes('background') || key.includes('setting') ? 'Background' :
                     key.includes('special') || key.includes('power') || key.includes('aura') ? 'Special' :
                     key.includes('class') || key.includes('type') || key.includes('race') ? 'Class' :
                     'Other';
    
    if (!groupedTraits[category]) groupedTraits[category] = {};
    groupedTraits[category][key] = value;
  });

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          NFT Traits & Attributes
        </Typography>

        {/* Special Powers */}
        {specialPowers.length > 0 && (
          <Box mb={3}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <StarIcon sx={{ color: '#ffd700' }} />
              <Typography variant="subtitle2">Special Powers</Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              {specialPowers.map((power, index) => (
                <Chip
                  key={index}
                  label={power}
                  color="secondary"
                  sx={{
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Materials */}
        {materialsFound.length > 0 && (
          <Box mb={3}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <PaletteIcon color="primary" />
              <Typography variant="subtitle2">Materials</Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              {materialsFound.map((material, index) => (
                <Chip
                  key={index}
                  label={material}
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Rarities */}
        {raritiesFound.length > 0 && (
          <Box mb={3}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <CategoryIcon color="secondary" />
              <Typography variant="subtitle2">Rarity Tiers</Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              {raritiesFound.map((rarity, index) => (
                <Chip
                  key={index}
                  label={rarity}
                  color={getRarityColor(rarity)}
                  variant="filled"
                />
              ))}
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Grouped Traits */}
        {Object.entries(groupedTraits).map(([category, traits]) => (
          <Accordion key={category} defaultExpanded={category === 'Class'}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" fontWeight="bold">
                {category} ({Object.keys(traits).length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {Object.entries(traits).map(([key, value]) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" display="block">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatTraitValue(value)}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}

        {Object.keys(groupedTraits).length === 0 && (
          <Typography color="text.secondary" align="center" py={2}>
            No traits available
          </Typography>
        )}

        {/* Collection Badge */}
        <Box mt={3} textAlign="center">
          <Chip
            label={`Collection: ${collectionName}`}
            variant="outlined"
            color="primary"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
