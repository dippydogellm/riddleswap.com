import { Client, Wallet, xrpToDrops, NFTokenMint, convertStringToHex } from 'xrpl';
import { storage } from './storage.js';
import { aiWeaponImageService } from './ai-weapon-image-service.js';
import crypto from 'crypto';

export interface WeaponMintRequest {
  playerHandle: string;
  weaponType: 'sword' | 'axe' | 'bow' | 'armor' | 'shield' | 'staff' | 'dagger' | 'mace' | 'spear' | 'crossbow';
  techLevel: 'primitive' | 'medieval' | 'advanced' | 'futuristic' | 'magical';
  color: 'bronze' | 'iron' | 'steel' | 'gold' | 'silver' | 'crystal' | 'obsidian' | 'mithril' | 'adamantine';
  armyColor?: 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'black' | 'white' | 'cyan' | 'yellow';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  customDetails?: string;
  paymentMethod?: 'XRP' | 'RDL'; // Payment method preference
  mintPriceXRP?: number; // Optional custom mint price
}

export interface WeaponNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: {
    weaponType: string;
    techLevel: string;
    color: string;
    armyColor?: string;
    rarity: string;
    power: number;
    speed: number;
    durability: number;
    cost: number;
    supplyLimit: number;
    createdBy: string;
    mintedAt: string;
  };
  gameData: {
    statsBoost: {
      attack: number;
      defense: number;
      speed: number;
    };
    armyPowerBonus: number;
    equipmentSlot: string;
    upgradeLevel: number;
    canUpgrade: boolean;
  };
}

export interface MintResult {
  success: boolean;
  nftTokenId?: string;
  transactionHash?: string;
  imageUrl?: string;
  metadata?: WeaponNFTMetadata;
  mintCostXRP?: number;
  mintCostRDL?: number;
  paymentMethod?: 'XRP' | 'RDL';
  rdlOnlyEnforced?: boolean;
  error?: string;
  queueId?: string;
}

class NFTWeaponMintingService {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client('wss://s1.ripple.com');
  }

  async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log('🔗 [NFT-MINT] Connected to XRPL network');
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 [NFT-MINT] Disconnected from XRPL network');
    }
  }

  private generateWeaponStats(weaponType: string, techLevel: string, rarity: string): {
    power: number;
    speed: number;
    durability: number;
    cost: number;
    supplyLimit: number;
    statsBoost: { attack: number; defense: number; speed: number };
    armyPowerBonus: number;
  } {
    // Base stats by weapon type
    const baseStats: Record<string, { power: number; speed: number; durability: number; attack: number; defense: number; speed_boost: number }> = {
      sword: { power: 75, speed: 80, durability: 70, attack: 15, defense: 5, speed_boost: 10 },
      axe: { power: 90, speed: 60, durability: 85, attack: 20, defense: 8, speed_boost: 5 },
      bow: { power: 70, speed: 95, durability: 60, attack: 18, defense: 2, speed_boost: 15 },
      armor: { power: 40, speed: 50, durability: 95, attack: 0, defense: 25, speed_boost: -5 },
      shield: { power: 30, speed: 65, durability: 90, attack: 2, defense: 20, speed_boost: 0 },
      staff: { power: 85, speed: 70, durability: 50, attack: 22, defense: 3, speed_boost: 8 },
      dagger: { power: 60, speed: 100, durability: 45, attack: 12, defense: 1, speed_boost: 20 },
      mace: { power: 95, speed: 55, durability: 80, attack: 25, defense: 5, speed_boost: 0 },
      spear: { power: 80, speed: 75, durability: 70, attack: 18, defense: 8, speed_boost: 12 },
      crossbow: { power: 85, speed: 65, durability: 75, attack: 20, defense: 3, speed_boost: 7 }
    };

    // Tech level multipliers
    const techMultipliers: Record<string, number> = {
      primitive: 0.8,
      medieval: 1.0,
      advanced: 1.3,
      futuristic: 1.6,
      magical: 1.8
    };

    // Rarity multipliers and supply limits
    const rarityData: Record<string, { multiplier: number; supply: number; cost: number }> = {
      common: { multiplier: 1.0, supply: 1000, cost: 10 },
      rare: { multiplier: 1.4, supply: 500, cost: 25 },
      epic: { multiplier: 1.8, supply: 100, cost: 50 },
      legendary: { multiplier: 2.5, supply: 25, cost: 100 }
    };

    const base = baseStats[weaponType] || baseStats.sword;
    const techMult = techMultipliers[techLevel] || 1.0;
    const rarityMult = rarityData[rarity]?.multiplier || 1.0;
    const totalMult = techMult * rarityMult;

    return {
      power: Math.round(base.power * totalMult),
      speed: Math.round(base.speed * totalMult),
      durability: Math.round(base.durability * totalMult),
      cost: rarityData[rarity]?.cost || 10,
      supplyLimit: rarityData[rarity]?.supply || 1000,
      statsBoost: {
        attack: Math.round(base.attack * totalMult),
        defense: Math.round(base.defense * totalMult),
        speed: Math.round(base.speed_boost * totalMult)
      },
      armyPowerBonus: Math.round(base.power * totalMult * 0.1) // 10% of power as army bonus
    };
  }

  private createWeaponMetadata(request: WeaponMintRequest, imageUrl: string, stats: any): WeaponNFTMetadata {
    const weaponName = `${request.rarity.charAt(0).toUpperCase() + request.rarity.slice(1)} ${request.color.charAt(0).toUpperCase() + request.color.slice(1)} ${request.weaponType.charAt(0).toUpperCase() + request.weaponType.slice(1)}`;
    
    const description = `A ${request.rarity} ${request.techLevel} ${request.weaponType} forged from ${request.color} materials${request.armyColor ? ` with ${request.armyColor} army insignia` : ''}. This weapon grants significant power to any army that wields it in The Trolls Inquisition Multi-Chain Mayhem Edition.${request.customDetails ? ` ${request.customDetails}` : ''}`;

    return {
      name: weaponName,
      description: description,
      image: imageUrl,
      attributes: {
        weaponType: request.weaponType,
        techLevel: request.techLevel,
        color: request.color,
        armyColor: request.armyColor,
        rarity: request.rarity,
        power: stats.power,
        speed: stats.speed,
        durability: stats.durability,
        cost: stats.cost,
        supplyLimit: stats.supplyLimit,
        createdBy: request.playerHandle,
        mintedAt: new Date().toISOString()
      },
      gameData: {
        statsBoost: stats.statsBoost,
        armyPowerBonus: stats.armyPowerBonus,
        equipmentSlot: ['armor', 'shield'].includes(request.weaponType) ? 'defense' : 'offense',
        upgradeLevel: 1,
        canUpgrade: true
      }
    };
  }

  private calculateMintPrice(techLevel: string, rarity: string, paymentMethod: 'XRP' | 'RDL' = 'XRP', customPrice?: number): { xrpPrice: number; rdlPrice: number; currency: string; amount: number } {
    if (customPrice && customPrice > 0) {
      const xrpPrice = customPrice;
      const rdlPrice = customPrice * 1000; // 1 XRP = 1000 RDL conversion
      return {
        xrpPrice,
        rdlPrice,
        currency: paymentMethod,
        amount: paymentMethod === 'RDL' ? rdlPrice : xrpPrice
      };
    }

    const basePrices: Record<string, number> = {
      primitive: 5,
      medieval: 10,
      advanced: 20,
      futuristic: 35,
      magical: 50
    };

    const rarityMultipliers: Record<string, number> = {
      common: 1.0,
      rare: 2.5,
      epic: 5.0,
      legendary: 10.0
    };

    const basePrice = basePrices[techLevel] || 10;
    const multiplier = rarityMultipliers[rarity] || 1.0;
    const xrpPrice = basePrice * multiplier;
    const rdlPrice = xrpPrice * 1000; // 1 XRP = 1000 RDL conversion
    
    return {
      xrpPrice,
      rdlPrice,
      currency: paymentMethod,
      amount: paymentMethod === 'RDL' ? rdlPrice : xrpPrice
    };
  }

  async queueWeaponMint(request: WeaponMintRequest): Promise<string> {
    try {
      const queueId = crypto.randomUUID();
      
      // Check if user has RDL-only payment preference
      let enforceRDL = false;
      let paymentMethod = request.paymentMethod || 'XRP';
      
      try {
        const userPreference = await storage.getUserPaymentPreference(request.playerHandle);
        if (userPreference === 'RDL_ONLY') {
          enforceRDL = true;
          paymentMethod = 'RDL';
          console.log(`🎯 [NFT-MINT] ${request.playerHandle} is in RDL-only mode - enforcing RDL payment`);
        }
      } catch (error) {
        console.warn(`⚠️ [NFT-MINT] Could not check payment preference for ${request.playerHandle}:`, error);
      }
      
      // Reject XRP payment if user is in RDL-only mode
      if (enforceRDL && request.paymentMethod === 'XRP') {
        throw new Error('RDL_ONLY_MODE: You must use RDL tokens for all purchases after buying a plot with RDL');
      }
      
      const pricing = this.calculateMintPrice(request.techLevel, request.rarity, paymentMethod, request.mintPriceXRP);
      
      console.log(`🎯 [NFT-MINT] Queuing weapon mint for ${request.playerHandle}: ${request.rarity} ${request.weaponType} (${pricing.currency} payment)`);

      await storage.addWeaponMintQueue({
        id: queueId,
        player_handle: request.playerHandle,
        weapon_type: request.weaponType,
        tech_level: request.techLevel,
        color: request.color,
        army_color: request.armyColor || null,
        rarity: request.rarity,
        custom_details: request.customDetails || null,
        mint_price_xrp: pricing.xrpPrice,
        mint_price_rdl: pricing.rdlPrice,
        payment_method: paymentMethod,
        rdl_only_enforced: enforceRDL,
        status: 'queued',
        priority: request.rarity === 'legendary' ? 'high' : (request.rarity === 'epic' ? 'medium' : 'normal')
      });

      console.log(`✅ [NFT-MINT] Weapon mint queued with ID: ${queueId}, price: ${pricing.amount} ${pricing.currency}`);
      return queueId;

    } catch (error) {
      console.error('❌ [NFT-MINT] Failed to queue weapon mint:', error);
      throw new Error(`Failed to queue mint: ${error}`);
    }
  }

  async processQueuedMint(queueId: string, playerWalletSeed: string): Promise<MintResult> {
    try {
      console.log(`🔧 [NFT-MINT] Processing queued mint: ${queueId}`);
      
      // Get queued mint request
      const queuedMint = await storage.getWeaponMintQueue(queueId);
      if (!queuedMint) {
        throw new Error('Queued mint not found');
      }

      if (queuedMint.status !== 'queued') {
        throw new Error(`Mint ${queueId} is not in queued status: ${queuedMint.status}`);
      }

      // Update status to processing
      await storage.updateWeaponMintQueueStatus(queueId, 'processing');

      // Generate weapon image using AI service
      console.log(`🎨 [NFT-MINT] Generating weapon image for ${queuedMint.weapon_type}`);
      const imageGeneration = await aiWeaponImageService.generateWeaponImage({
        weaponType: queuedMint.weapon_type as any,
        techLevel: queuedMint.tech_level as any,
        color: queuedMint.color as any,
        armyColor: queuedMint.army_color as any,
        rarity: queuedMint.rarity as any,
        customDetails: queuedMint.custom_details || undefined
      });

      // Generate weapon stats and metadata
      const stats = this.generateWeaponStats(queuedMint.weapon_type, queuedMint.tech_level, queuedMint.rarity);
      const metadata = this.createWeaponMetadata({
        playerHandle: queuedMint.player_handle,
        weaponType: queuedMint.weapon_type as any,
        techLevel: queuedMint.tech_level as any,
        color: queuedMint.color as any,
        armyColor: queuedMint.army_color as any,
        rarity: queuedMint.rarity as any,
        customDetails: queuedMint.custom_details || undefined
      }, imageGeneration.imageUrl, stats);

      // Connect to XRPL and mint NFT
      await this.ensureConnection();
      
      const wallet = Wallet.fromSeed(playerWalletSeed);
      console.log(`🔗 [NFT-MINT] Minting NFT from wallet: ${wallet.address}`);

      // Create NFT mint transaction
      const mintTx: NFTokenMint = {
        TransactionType: 'NFTokenMint',
        Account: wallet.address,
        NFTokenTaxon: 1, // Weapon collection taxon
        Flags: 8, // Transferable
        URI: convertStringToHex(JSON.stringify(metadata))
      };

      // Submit and wait for validation
      const result = await this.client.submitAndWait(mintTx, { wallet });
      
      if (result.result.meta && 'TransactionResult' in result.result.meta && result.result.meta.TransactionResult === 'tesSUCCESS') {
        // Extract NFTokenID from transaction metadata
        const nftTokenId = this.extractNFTokenID(result.result.meta);
        
        if (nftTokenId) {
          console.log(`✅ [NFT-MINT] NFT minted successfully: ${nftTokenId}`);

          // Store the minted NFT in database
          await storage.addPlayerNftWeapon({
            id: crypto.randomUUID(),
            player_handle: queuedMint.player_handle,
            nft_token_id: nftTokenId,
            chain: 'xrpl',
            weapon_definition_id: crypto.randomUUID(), // Link to weapon definitions if needed
            mint_transaction_hash: result.result.hash,
            image_url: imageGeneration.imageUrl,
            metadata: metadata,
            current_owner: wallet.address,
            is_listed: false,
            is_equipped: false
          });

          // Update queue status to completed
          await storage.updateWeaponMintQueueStatus(queueId, 'completed', {
            nft_token_id: nftTokenId,
            transaction_hash: result.result.hash,
            image_url: imageGeneration.imageUrl
          });

          return {
            success: true,
            nftTokenId: nftTokenId,
            transactionHash: result.result.hash,
            imageUrl: imageGeneration.imageUrl,
            metadata: metadata,
            mintCostXRP: queuedMint.mint_price_xrp,
            queueId: queueId
          };

        } else {
          throw new Error('Failed to extract NFTokenID from transaction result');
        }
      } else {
        throw new Error(`NFT mint transaction failed: ${result.result.meta}`);
      }

    } catch (error) {
      console.error(`❌ [NFT-MINT] Failed to process mint ${queueId}:`, error);
      
      // Update queue status to failed
      await storage.updateWeaponMintQueueStatus(queueId, 'failed', {
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        queueId: queueId
      };
    }
  }

  private extractNFTokenID(meta: any): string | null {
    try {
      if (meta && meta.CreatedNode) {
        const createdNodes = Array.isArray(meta.CreatedNode) ? meta.CreatedNode : [meta.CreatedNode];
        for (const node of createdNodes) {
          if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFToken') {
            return node.CreatedNode.NewFields?.NFTokenID || null;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ [NFT-MINT] Failed to extract NFTokenID:', error);
      return null;
    }
  }

  async batchMintWeapons(requests: WeaponMintRequest[]): Promise<string[]> {
    console.log(`🔄 [NFT-MINT] Batch queuing ${requests.length} weapon mints`);
    
    const queueIds: string[] = [];
    const errors: string[] = [];

    for (const request of requests) {
      try {
        const queueId = await this.queueWeaponMint(request);
        queueIds.push(queueId);
      } catch (error) {
        const errorMsg = `Failed to queue ${request.weaponType} for ${request.playerHandle}: ${error}`;
        errors.push(errorMsg);
        console.error(`❌ [NFT-MINT] ${errorMsg}`);
      }
    }

    console.log(`✅ [NFT-MINT] Batch queue complete: ${queueIds.length} queued, ${errors.length} failed`);
    
    if (errors.length > 0) {
      console.warn(`⚠️ [NFT-MINT] Batch errors:`, errors);
    }

    return queueIds;
  }

  async getQueueStatus(queueId: string): Promise<any> {
    return await storage.getWeaponMintQueue(queueId);
  }

  async getPlayerWeapons(playerHandle: string): Promise<any[]> {
    return await storage.getPlayerNftWeapons(playerHandle);
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.disconnect();
  }
}

export const nftWeaponMintingService = new NFTWeaponMintingService();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 [NFT-MINT] Shutting down service...');
  await nftWeaponMintingService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 [NFT-MINT] Shutting down service...');
  await nftWeaponMintingService.cleanup();
  process.exit(0);
});