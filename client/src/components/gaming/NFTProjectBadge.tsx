/**
 * NFT Project Badge Component
 * Shows if NFT is from our project or partner project with fun styling
 */

import {
  Box,
  Chip,
  Stack,
  Typography,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Verified as VerifiedIcon,
  Handshake as PartnerIcon,
  Star as StarIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';

interface NFTProjectBadgeProps {
  collectionName: string;
  isOurProject: boolean;
  isPartnerProject: boolean;
  projectScore?: number;
  partnerTier?: 'gold' | 'silver' | 'bronze';
}

export default function NFTProjectBadge({
  collectionName,
  isOurProject,
  isPartnerProject,
  projectScore = 0,
  partnerTier,
}: NFTProjectBadgeProps) {
  const getProjectEmoji = () => {
    if (isOurProject) return '🏰';
    if (isPartnerProject) {
      if (partnerTier === 'gold') return '🥇';
      if (partnerTier === 'silver') return '🥈';
      if (partnerTier === 'bronze') return '🥉';
      return '🤝';
    }
    return '🎮';
  };

  const getScoreLevel = (score: number) => {
    if (score >= 90) return { label: 'Legendary', color: '#ff6b6b', icon: '🔥' };
    if (score >= 75) return { label: 'Epic', color: '#9b59b6', icon: '⭐' };
    if (score >= 60) return { label: 'Rare', color: '#3498db', icon: '💎' };
    if (score >= 40) return { label: 'Uncommon', color: '#2ecc71', icon: '✨' };
    return { label: 'Common', color: '#95a5a6', icon: '🎯' };
  };

  const scoreLevel = getScoreLevel(projectScore);

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        background: isOurProject 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : isPartnerProject
          ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
          : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background effect */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.1)',
          animation: 'pulse 3s infinite',
          '@keyframes pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
            '50%': { transform: 'scale(1.1)', opacity: 0.3 },
          },
        }}
      />

      <Stack spacing={2} position="relative">
        {/* Project Type Badge */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {isOurProject && (
            <Tooltip title="Official RiddleSwap Collection">
              <Chip
                icon={<VerifiedIcon />}
                label="Our Project"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  backdropFilter: 'blur(10px)',
                }}
              />
            </Tooltip>
          )}

          {isPartnerProject && (
            <Tooltip title={`${partnerTier ? partnerTier.toUpperCase() : ''} Partner Collection`}>
              <Chip
                icon={<PartnerIcon />}
                label={`Partner ${partnerTier ? `(${partnerTier})` : ''}`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  backdropFilter: 'blur(10px)',
                }}
              />
            </Tooltip>
          )}

          <Box sx={{ fontSize: '2rem' }}>
            {getProjectEmoji()}
          </Box>
        </Stack>

        {/* Collection Name */}
        <Typography variant="h6" fontWeight="bold">
          {collectionName}
        </Typography>

        {/* Score Display */}
        {projectScore > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Project Score
              </Typography>
              <Tooltip title={`${scoreLevel.label} tier collection`}>
                <Typography variant="caption">
                  {scoreLevel.icon}
                </Typography>
              </Tooltip>
            </Stack>
            
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{
                    width: '100%',
                    height: 8,
                    bgcolor: 'rgba(255,255,255,0.3)',
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${projectScore}%`,
                      height: '100%',
                      bgcolor: scoreLevel.color,
                      transition: 'width 1s ease-in-out',
                      boxShadow: `0 0 10px ${scoreLevel.color}`,
                    }}
                  />
                </Box>
              </Box>
              <Typography variant="h6" fontWeight="bold">
                {projectScore}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} mt={1}>
              <Chip
                label={scoreLevel.label}
                size="small"
                sx={{
                  bgcolor: scoreLevel.color,
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.7rem',
                }}
              />
              {projectScore >= 80 && (
                <Chip
                  icon={<TrophyIcon sx={{ fontSize: 14 }} />}
                  label="Top Tier"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,215,0,0.9)',
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                  }}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Fun Facts */}
        {isOurProject && (
          <Stack direction="row" spacing={1} alignItems="center">
            <StarIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Verified & Battle-Ready
            </Typography>
          </Stack>
        )}

        {isPartnerProject && partnerTier === 'gold' && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TrophyIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Premium Partner Benefits
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
