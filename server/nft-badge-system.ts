/**
 * NFT Badge System
 * Awards special badges to users based on their NFT collection ownership
 */

import { db } from "./db";
import { gamingNfts, gamingPlayers, nftPowerAttributes } from "@shared/schema";
import { eq, sql, and, inArray } from "drizzle-orm";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  requirements: {
    collection?: string;
    minNfts?: number;
    minPower?: number;
    specificNfts?: string[];
    powerType?: 'army' | 'religion' | 'civilization' | 'economic';
  };
}

const COLLECTION_BADGES: Badge[] = [
  // Under the Bridge (Banker) Badges
  {
    id: 'banker_initiate',
    name: 'Banker Initiate',
    description: 'Own at least 1 Under the Bridge NFT',
    icon: '🏦',
    color: '#FFD700',
    rarity: 'common',
    requirements: {
      collection: 'Under the Bridge',
      minNfts: 1
    }
  },
  {
    id: 'master_banker',
    name: 'Master Banker',
    description: 'Own 5+ Under the Bridge NFTs',
    icon: '💰',
    color: '#FFD700',
    rarity: 'rare',
    requirements: {
      collection: 'Under the Bridge',
      minNfts: 5
    }
  },
  {
    id: 'financial_titan',
    name: 'Financial Titan',
    description: 'Own 10+ Under the Bridge NFTs with 1000+ Economic Power',
    icon: '👑',
    color: '#FFD700',
    rarity: 'legendary',
    requirements: {
      collection: 'Under the Bridge',
      minNfts: 10,
      minPower: 1000,
      powerType: 'economic'
    }
  },

  // The Inquiry (Gods) Badges
  {
    id: 'disciple',
    name: 'Divine Disciple',
    description: 'Own at least 1 Inquiry NFT',
    icon: '✨',
    color: '#9B59B6',
    rarity: 'uncommon',
    requirements: {
      collection: 'The Inquiry',
      minNfts: 1
    }
  },
  {
    id: 'prophet',
    name: 'Sacred Prophet',
    description: 'Own 5+ Inquiry NFTs',
    icon: '🔮',
    color: '#9B59B6',
    rarity: 'epic',
    requirements: {
      collection: 'The Inquiry',
      minNfts: 5
    }
  },
  {
    id: 'god_touched',
    name: 'God-Touched',
    description: 'Own 10+ Inquiry NFTs with 2000+ Religion Power',
    icon: '⚡',
    color: '#9B59B6',
    rarity: 'legendary',
    requirements: {
      collection: 'The Inquiry',
      minNfts: 10,
      minPower: 2000,
      powerType: 'religion'
    }
  },

  // Dantes Aurum (Sacred) Badges
  {
    id: 'relic_keeper',
    name: 'Relic Keeper',
    description: 'Own at least 1 Dantes Aurum NFT',
    icon: '📿',
    color: '#E74C3C',
    rarity: 'common',
    requirements: {
      collection: 'Dantes Aurum',
      minNfts: 1
    }
  },
  {
    id: 'sacred_guardian',
    name: 'Sacred Guardian',
    description: 'Own 5+ Dantes Aurum NFTs',
    icon: '🛡️',
    color: '#E74C3C',
    rarity: 'rare',
    requirements: {
      collection: 'Dantes Aurum',
      minNfts: 5
    }
  },
  {
    id: 'holy_champion',
    name: 'Holy Champion',
    description: 'Own 10+ Dantes Aurum NFTs with 1500+ Religion Power',
    icon: '⛪',
    color: '#E74C3C',
    rarity: 'legendary',
    requirements: {
      collection: 'Dantes Aurum',
      minNfts: 10,
      minPower: 1500,
      powerType: 'religion'
    }
  },

  // The Lost Emporium (Weapons) Badges
  {
    id: 'weapon_collector',
    name: 'Weapon Collector',
    description: 'Own at least 1 Lost Emporium NFT',
    icon: '⚔️',
    color: '#C0C0C0',
    rarity: 'common',
    requirements: {
      collection: 'The Lost Emporium',
      minNfts: 1
    }
  },
  {
    id: 'arsenal_master',
    name: 'Arsenal Master',
    description: 'Own 5+ Lost Emporium NFTs',
    icon: '🗡️',
    color: '#C0C0C0',
    rarity: 'rare',
    requirements: {
      collection: 'The Lost Emporium',
      minNfts: 5
    }
  },
  {
    id: 'warlord',
    name: 'Supreme Warlord',
    description: 'Own 10+ Lost Emporium NFTs with 1500+ Army Power',
    icon: '⚡',
    color: '#C0C0C0',
    rarity: 'legendary',
    requirements: {
      collection: 'The Lost Emporium',
      minNfts: 10,
      minPower: 1500,
      powerType: 'army'
    }
  },

  // Cross-Collection Badges
  {
    id: 'grand_collector',
    name: 'Grand Collector',
    description: 'Own NFTs from all 4 collections',
    icon: '🏆',
    color: '#FFD700',
    rarity: 'epic',
    requirements: {
      minNfts: 4 // At least 1 from each collection
    }
  },
  {
    id: 'ultimate_collector',
    name: 'Ultimate Collector',
    description: 'Own 10+ NFTs from all 4 collections',
    icon: '👑',
    color: '#FFD700',
    rarity: 'legendary',
    requirements: {
      minNfts: 40 // 10+ from each collection
    }
  }
];

/**
 * Calculate badges earned by a user
 */
export async function calculateUserBadges(userHandle: string): Promise<Badge[]> {
  try {
    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      return [];
    }

    // Get all NFTs owned by this player with their collection info
    const playerNfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.owner_address, player.wallet_address),
      with: {
        collection: true
      }
    });

    // Get power attributes
    const nftIds = playerNfts.map((nft: any) => nft.id);
    const powerAttributes = nftIds.length > 0
      ? await db.query.nftPowerAttributes.findMany({
          where: inArray(nftPowerAttributes.nft_id, nftIds)
        })
      : [];

    // Count NFTs by collection
    const collectionCounts: Record<string, number> = {};
    const collectionPower: Record<string, Record<string, number>> = {};

    for (const nft of playerNfts) {
      const collectionName = (nft as any).collection?.collection_name || 'unknown';
      collectionCounts[collectionName] = (collectionCounts[collectionName] || 0) + 1;

      if (!collectionPower[collectionName]) {
        collectionPower[collectionName] = {
          army: 0,
          religion: 0,
          civilization: 0,
          economic: 0
        };
      }

      // Add power from this NFT
      const power = powerAttributes.find((p: any) => p.nft_id === nft.id);
      if (power) {
        collectionPower[collectionName].army += power.army_power || 0;
        collectionPower[collectionName].religion += power.religion_power || 0;
        collectionPower[collectionName].civilization += power.civilization_power || 0;
        collectionPower[collectionName].economic += power.economic_power || 0;
      }
    }

    // Check which badges are earned
    const earnedBadges: Badge[] = [];

    for (const badge of COLLECTION_BADGES) {
      let earned = true;

      // Check collection requirement
      if (badge.requirements.collection) {
        const count = collectionCounts[badge.requirements.collection] || 0;
        if (badge.requirements.minNfts && count < badge.requirements.minNfts) {
          earned = false;
        }

        // Check power requirement
        if (badge.requirements.minPower && badge.requirements.powerType) {
          const power = collectionPower[badge.requirements.collection]?.[badge.requirements.powerType] || 0;
          if (power < badge.requirements.minPower) {
            earned = false;
          }
        }
      }

      // Check total NFT count (for cross-collection badges)
      if (!badge.requirements.collection && badge.requirements.minNfts) {
        const totalNfts = Object.values(collectionCounts as any).reduce((sum, count) => sum + count, 0);
        if (totalNfts < badge.requirements.minNfts) {
          earned = false;
        }

        // For grand collector, check all 4 collections
        if (badge.id === 'grand_collector') {
          const collectionNames = ['Under the Bridge', 'The Inquiry', 'Dantes Aurum', 'The Lost Emporium'];
          for (const name of collectionNames) {
            if (!collectionCounts[name] || collectionCounts[name] === 0) {
              earned = false;
              break;
            }
          }
        }

        // For ultimate collector, check 10+ from each
        if (badge.id === 'ultimate_collector') {
          const collectionNames = ['Under the Bridge', 'The Inquiry', 'Dantes Aurum', 'The Lost Emporium'];
          for (const name of collectionNames) {
            if (!collectionCounts[name] || collectionCounts[name] < 10) {
              earned = false;
              break;
            }
          }
        }
      }

      if (earned) {
        earnedBadges.push(badge);
      }
    }

    console.log(`🏅 User ${userHandle} earned ${earnedBadges.length} badges`);
    return earnedBadges;
  } catch (error) {
    console.error(`Error calculating badges for ${userHandle}:`, error);
    return [];
  }
}

/**
 * Get all available badges
 */
export function getAllBadges(): Badge[] {
  return COLLECTION_BADGES;
}

/**
 * Get badge by ID
 */
export function getBadgeById(badgeId: string): Badge | undefined {
  return COLLECTION_BADGES.find(b => b.id === badgeId);
}

export { COLLECTION_BADGES };
