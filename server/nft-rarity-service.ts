import { db } from './db';
import { sql } from 'drizzle-orm';

interface TraitFrequency {
  traitType: string;
  value: string;
  count: number;
  percentage: number;
}

interface RarityScore {
  nftId: string;
  score: number;
  rank: number;
  rarityTier: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  traitScores: Array<{
    traitType: string;
    value: string;
    rarity: number;
  }>;
}

interface CollectionRarity {
  collectionId: string;
  totalSupply: number;
  traitFrequencies: Map<string, TraitFrequency[]>;
  nftRarities: Map<string, RarityScore>;
}

/**
 * NFT Rarity Calculation Service
 * Analyzes trait frequencies across collections and calculates rarity scores
 */
export class NFTRarityService {
  private rarityCache: Map<string, CollectionRarity> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate rarity for all NFTs in a collection
   */
  async calculateCollectionRarity(collectionId: string, nfts: any[]): Promise<CollectionRarity> {
    console.log(`📊 [RARITY] Calculating rarity for collection: ${collectionId}`);
    
    // Check cache
    const cached = this.rarityCache.get(collectionId);
    const expiry = this.cacheExpiry.get(collectionId) || 0;
    if (cached && Date.now() < expiry) {
      console.log(`✅ [RARITY] Using cached rarity data for ${collectionId}`);
      return cached;
    }

    const totalSupply = nfts.length;
    
    // Guard: Handle empty collections to prevent division by zero
    if (totalSupply === 0) {
      console.log(`⚠️ [RARITY] Empty collection ${collectionId} - no rarity data available`);
      return {
        collectionId,
        totalSupply: 0,
        traitFrequencies: new Map(),
        nftRarities: new Map()
      };
    }
    
    const traitFrequencies = new Map<string, TraitFrequency[]>();
    const nftRarities = new Map<string, RarityScore>();

    // Step 1: Calculate trait frequencies
    const traitCounts = new Map<string, Map<string, number>>();
    
    nfts.forEach(nft => {
      const traits = nft.attributes || nft.traits || [];
      traits.forEach((trait: any) => {
        const traitType = trait.trait_type || trait.type;
        const value = trait.value;
        
        if (!traitType || !value) return;
        
        if (!traitCounts.has(traitType)) {
          traitCounts.set(traitType, new Map());
        }
        
        const valueCounts = traitCounts.get(traitType)!;
        valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
      });
    });

    // Convert counts to frequencies
    traitCounts.forEach((valueCounts, traitType) => {
      const frequencies: TraitFrequency[] = [];
      valueCounts.forEach((count, value) => {
        frequencies.push({
          traitType,
          value,
          count,
          percentage: (count / totalSupply) * 100
        });
      });
      traitFrequencies.set(traitType, frequencies.sort((a, b) => a.count - b.count));
    });

    // Step 2: Calculate rarity score for each NFT
    const nftScores: Array<{ nftId: string; score: number; traitScores: any[] }> = [];
    
    nfts.forEach(nft => {
      const traits = nft.attributes || nft.traits || [];
      let totalScore = 0;
      const traitScores: Array<{ traitType: string; value: string; rarity: number }> = [];
      
      traits.forEach((trait: any) => {
        const traitType = trait.trait_type || trait.type;
        const value = trait.value;
        
        if (!traitType || !value) return;
        
        const frequencies = traitFrequencies.get(traitType);
        if (!frequencies) return;
        
        const traitFreq = frequencies.find(f => f.value === value);
        if (!traitFreq) return;
        
        // Rarity score = 1 / (frequency percentage / 100)
        // Lower frequency = higher rarity score
        const rarityScore = 1 / (traitFreq.percentage / 100);
        totalScore += rarityScore;
        
        traitScores.push({
          traitType,
          value,
          rarity: traitFreq.percentage
        });
      });
      
      nftScores.push({
        nftId: nft.nft_id || nft.NFTokenID || nft.id,
        score: totalScore,
        traitScores
      });
    });

    // Step 3: Rank NFTs and assign rarity tiers
    nftScores.sort((a, b) => b.score - a.score);
    
    nftScores.forEach((nftScore, index) => {
      const rank = index + 1;
      const percentile = (rank / totalSupply) * 100;
      
      let rarityTier: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
      if (percentile <= 1) {
        rarityTier = 'Legendary';
      } else if (percentile <= 5) {
        rarityTier = 'Epic';
      } else if (percentile <= 15) {
        rarityTier = 'Rare';
      } else if (percentile <= 40) {
        rarityTier = 'Uncommon';
      } else {
        rarityTier = 'Common';
      }
      
      nftRarities.set(nftScore.nftId, {
        nftId: nftScore.nftId,
        score: nftScore.score,
        rank,
        rarityTier,
        traitScores: nftScore.traitScores
      });
    });

    const collectionRarity: CollectionRarity = {
      collectionId,
      totalSupply,
      traitFrequencies,
      nftRarities
    };

    // Cache results
    this.rarityCache.set(collectionId, collectionRarity);
    this.cacheExpiry.set(collectionId, Date.now() + this.CACHE_TTL);
    
    console.log(`✅ [RARITY] Calculated rarity for ${totalSupply} NFTs in collection ${collectionId}`);
    
    return collectionRarity;
  }

  /**
   * Get rarity data for a specific NFT
   */
  async getNFTRarity(nftId: string, collectionId: string, allCollectionNFTs: any[]): Promise<RarityScore | null> {
    const collectionRarity = await this.calculateCollectionRarity(collectionId, allCollectionNFTs);
    return collectionRarity.nftRarities.get(nftId) || null;
  }

  /**
   * Get trait frequencies for a collection
   */
  async getTraitFrequencies(collectionId: string, allCollectionNFTs: any[]): Promise<Map<string, TraitFrequency[]>> {
    const collectionRarity = await this.calculateCollectionRarity(collectionId, allCollectionNFTs);
    return collectionRarity.traitFrequencies;
  }

  /**
   * Clear rarity cache for a collection
   */
  clearCache(collectionId?: string): void {
    if (collectionId) {
      this.rarityCache.delete(collectionId);
      this.cacheExpiry.delete(collectionId);
      console.log(`🗑️ [RARITY] Cleared cache for collection: ${collectionId}`);
    } else {
      this.rarityCache.clear();
      this.cacheExpiry.clear();
      console.log(`🗑️ [RARITY] Cleared all rarity cache`);
    }
  }
}

// Singleton instance
export const nftRarityService = new NFTRarityService();
