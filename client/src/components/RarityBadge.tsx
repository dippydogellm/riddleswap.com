import { Chip, ChipProps } from '@mui/material';
import { Star, EmojiEvents, Whatshot, TrendingUp } from '@mui/icons-material';

interface RarityBadgeProps {
  tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common' | string;
  size?: 'small' | 'medium';
  showIcon?: boolean;
}

const tierConfig = {
  legendary: {
    color: '#FFD700' as const,
    bgcolor: 'rgba(255, 215, 0, 0.1)',
    label: 'Legendary',
    icon: EmojiEvents,
  },
  epic: {
    color: '#9C27B0' as const,
    bgcolor: 'rgba(156, 39, 176, 0.1)',
    label: 'Epic',
    icon: Star,
  },
  rare: {
    color: '#2196F3' as const,
    bgcolor: 'rgba(33, 150, 243, 0.1)',
    label: 'Rare',
    icon: Whatshot,
  },
  uncommon: {
    color: '#4CAF50' as const,
    bgcolor: 'rgba(76, 175, 80, 0.1)',
    label: 'Uncommon',
    icon: TrendingUp,
  },
  common: {
    color: '#9E9E9E' as const,
    bgcolor: 'rgba(158, 158, 158, 0.1)',
    label: 'Common',
    icon: undefined,
  },
};

export default function RarityBadge({ tier, size = 'medium', showIcon = true }: RarityBadgeProps) {
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.common;
  const Icon = config.icon;

  return (
    <Chip
      label={config.label}
      size={size}
      icon={showIcon && Icon ? <Icon sx={{ fontSize: size === 'small' ? 16 : 20 }} /> : undefined}
      sx={{
        color: config.color,
        bgcolor: config.bgcolor,
        border: `1px solid ${config.color}`,
        fontWeight: 600,
        '& .MuiChip-icon': {
          color: config.color,
        },
      }}
    />
  );
}
