// Achievement System Types and Definitions
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  type: AchievementType;
  rarity: AchievementRarity;
  icon: string;
  requirements: AchievementRequirement[];
  rewards: AchievementReward[];
  hidden: boolean; // Secret achievements
  points: number;
  order: number; // Display order within category
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  progress: number;
  maxProgress: number;
  completed: boolean;
  completedAt?: Date;
  notified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementProgress {
  achievementId: string;
  progress: number;
  maxProgress: number;
  percentage: number;
  completed: boolean;
  achievement: Achievement;
}

export type AchievementCategory = 
  | 'collector' 
  | 'trader' 
  | 'social' 
  | 'explorer' 
  | 'milestone' 
  | 'special';

export type AchievementType = 
  | 'count' 
  | 'value' 
  | 'streak' 
  | 'first_time' 
  | 'special_event';

export type AchievementRarity = 
  | 'common' 
  | 'uncommon' 
  | 'rare' 
  | 'epic' 
  | 'legendary' 
  | 'mythic';

export interface AchievementRequirement {
  type: 'nft_purchase' | 'nft_sale' | 'trade_volume' | 'collection_complete' | 'days_active' | 'social_follow' | 'social_post';
  target: number;
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
  metadata?: Record<string, any>;
}

export interface AchievementReward {
  type: 'points' | 'badge' | 'title' | 'nft' | 'discount' | 'special_access';
  value: string | number;
  metadata?: Record<string, any>;
}

// Predefined Achievement Definitions
export const ACHIEVEMENTS: Achievement[] = [
  // COLLECTOR ACHIEVEMENTS
  {
    id: 'first_nft',
    name: 'First Collection',
    description: 'Purchase your very first NFT',
    category: 'collector',
    type: 'first_time',
    rarity: 'common',
    icon: '🎨',
    requirements: [{ type: 'nft_purchase', target: 1 }],
    rewards: [{ type: 'points', value: 100 }, { type: 'badge', value: 'first_collector' }],
    hidden: false,
    points: 100,
    order: 1
  },
  {
    id: 'collector_10',
    name: 'Growing Collection',
    description: 'Own 10 NFTs in your collection',
    category: 'collector',
    type: 'count',
    rarity: 'common',
    icon: '📦',
    requirements: [{ type: 'nft_purchase', target: 10 }],
    rewards: [{ type: 'points', value: 250 }],
    hidden: false,
    points: 250,
    order: 2
  },
  {
    id: 'collector_50',
    name: 'Serious Collector',
    description: 'Build a collection of 50 NFTs',
    category: 'collector',
    type: 'count',
    rarity: 'uncommon',
    icon: '🏆',
    requirements: [{ type: 'nft_purchase', target: 50 }],
    rewards: [{ type: 'points', value: 1000 }, { type: 'title', value: 'Serious Collector' }],
    hidden: false,
    points: 1000,
    order: 3
  },
  {
    id: 'collector_100',
    name: 'Master Collector',
    description: 'Amass an impressive collection of 100 NFTs',
    category: 'collector',
    type: 'count',
    rarity: 'rare',
    icon: '👑',
    requirements: [{ type: 'nft_purchase', target: 100 }],
    rewards: [{ type: 'points', value: 2500 }, { type: 'title', value: 'Master Collector' }],
    hidden: false,
    points: 2500,
    order: 4
  },
  {
    id: 'whale_collector',
    name: 'Digital Whale',
    description: 'Own 500 NFTs - you are a true whale!',
    category: 'collector',
    type: 'count',
    rarity: 'legendary',
    icon: '🐋',
    requirements: [{ type: 'nft_purchase', target: 500 }],
    rewards: [{ type: 'points', value: 10000 }, { type: 'title', value: 'Digital Whale' }],
    hidden: false,
    points: 10000,
    order: 5
  },

  // TRADER ACHIEVEMENTS
  {
    id: 'first_sale',
    name: 'First Sale',
    description: 'Make your first NFT sale',
    category: 'trader',
    type: 'first_time',
    rarity: 'common',
    icon: '💰',
    requirements: [{ type: 'nft_sale', target: 1 }],
    rewards: [{ type: 'points', value: 150 }],
    hidden: false,
    points: 150,
    order: 1
  },
  {
    id: 'volume_1000',
    name: 'Trading Volume Milestone',
    description: 'Achieve 1,000 XRP in total trading volume',
    category: 'trader',
    type: 'value',
    rarity: 'uncommon',
    icon: '📈',
    requirements: [{ type: 'trade_volume', target: 1000 }],
    rewards: [{ type: 'points', value: 500 }],
    hidden: false,
    points: 500,
    order: 2
  },
  {
    id: 'volume_10000',
    name: 'High Volume Trader',
    description: 'Reach 10,000 XRP in trading volume',
    category: 'trader',
    type: 'value',
    rarity: 'epic',
    icon: '🚀',
    requirements: [{ type: 'trade_volume', target: 10000 }],
    rewards: [{ type: 'points', value: 2000 }, { type: 'title', value: 'High Volume Trader' }],
    hidden: false,
    points: 2000,
    order: 3
  },

  // SOCIAL ACHIEVEMENTS
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Follow 10 other collectors',
    category: 'social',
    type: 'count',
    rarity: 'common',
    icon: '🦋',
    requirements: [{ type: 'social_follow', target: 10 }],
    rewards: [{ type: 'points', value: 200 }],
    hidden: false,
    points: 200,
    order: 1
  },
  {
    id: 'influencer',
    name: 'Community Influencer',
    description: 'Make 25 posts to share your collection',
    category: 'social',
    type: 'count',
    rarity: 'uncommon',
    icon: '📢',
    requirements: [{ type: 'social_post', target: 25 }],
    rewards: [{ type: 'points', value: 750 }, { type: 'title', value: 'Influencer' }],
    hidden: false,
    points: 750,
    order: 2
  },

  // EXPLORER ACHIEVEMENTS
  {
    id: 'daily_visitor',
    name: 'Daily Visitor',
    description: 'Visit RiddleSwap for 7 consecutive days',
    category: 'explorer',
    type: 'streak',
    rarity: 'common',
    icon: '📅',
    requirements: [{ type: 'days_active', target: 7, timeframe: 'daily' }],
    rewards: [{ type: 'points', value: 300 }],
    hidden: false,
    points: 300,
    order: 1
  },
  {
    id: 'monthly_explorer',
    name: 'Monthly Explorer',
    description: 'Stay active for 30 days',
    category: 'explorer',
    type: 'streak',
    rarity: 'uncommon',
    icon: '🗓️',
    requirements: [{ type: 'days_active', target: 30 }],
    rewards: [{ type: 'points', value: 1000 }, { type: 'title', value: 'Explorer' }],
    hidden: false,
    points: 1000,
    order: 2
  },

  // SPECIAL ACHIEVEMENTS
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'One of the first 100 users on RiddleSwap',
    category: 'special',
    type: 'special_event',
    rarity: 'legendary',
    icon: '⭐',
    requirements: [],
    rewards: [{ type: 'points', value: 5000 }, { type: 'title', value: 'Early Adopter' }],
    hidden: true,
    points: 5000,
    order: 1
  },
  {
    id: 'beta_tester',
    name: 'Beta Tester',
    description: 'Helped test RiddleSwap during beta phase',
    category: 'special',
    type: 'special_event',
    rarity: 'epic',
    icon: '🧪',
    requirements: [],
    rewards: [{ type: 'points', value: 2500 }, { type: 'title', value: 'Beta Tester' }],
    hidden: true,
    points: 2500,
    order: 2
  }
];

// Achievement utilities
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(achievement => achievement.category === category)
    .sort((a, b) => a.order - b.order);
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(achievement => achievement.id === id);
}

export function getRarityColor(rarity: AchievementRarity): string {
  const colors = {
    common: '#9ca3af',     // gray-400
    uncommon: '#10b981',   // emerald-500
    rare: '#3b82f6',       // blue-500
    epic: '#8b5cf6',       // violet-500
    legendary: '#f59e0b',  // amber-500
    mythic: '#ef4444'      // red-500
  };
  return colors[rarity];
}

export function getRarityGradient(rarity: AchievementRarity): string {
  const gradients = {
    common: 'from-gray-400 to-gray-600',
    uncommon: 'from-emerald-400 to-emerald-600',
    rare: 'from-blue-400 to-blue-600',
    epic: 'from-violet-400 to-violet-600',
    legendary: 'from-amber-400 to-amber-600',
    mythic: 'from-red-400 to-red-600'
  };
  return gradients[rarity];
}