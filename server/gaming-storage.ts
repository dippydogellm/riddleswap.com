// Gaming Storage Interface and Implementation
// Separate storage system for The Trolls Inquisition gaming functionality
// Uses in-memory storage initially, will be migrated to database later

import { 
  GamePlayer, GamePlayerWallet, InsertGamePlayer, InsertGamePlayerWallet,
  InsertGameLandBlock, GameLandBlock, GameLandClaim, InsertGameLandClaim,
  GameCollection, InsertGameCollection, GameNftTrait, InsertGameNftTrait,
  GameBattle, InsertGameBattle, GameBattleParticipant, InsertGameBattleParticipant,
  GameProgression, InsertGameProgression
} from '../shared/schema';

export interface IGamingStorage {
  // Player management
  getGamePlayerByHandle(handle: string): Promise<GamePlayer | null>;
  getGamePlayerByUserId(userId: string): Promise<GamePlayer | null>;
  createGamePlayer(player: InsertGamePlayer): Promise<GamePlayer>;
  updateGamePlayerActivity(playerId: string): Promise<void>;
  
  // Player wallets
  createGamePlayerWallet(wallet: InsertGamePlayerWallet): Promise<GamePlayerWallet>;
  getGamePlayerWallets(playerId: string): Promise<GamePlayerWallet[]>;
  
  // Land system
  getLandBlocks(chain?: string, limit?: number): Promise<GameLandBlock[]>;
  getLandBlock(blockId: string): Promise<GameLandBlock | null>;
  claimLandBlock(claim: InsertGameLandClaim): Promise<GameLandClaim>;
  getPlayerLandClaims(playerId: string): Promise<GameLandClaim[]>;
  
  // Gaming collections and NFTs
  getGameCollections(): Promise<GameCollection[]>;
  getGameCollection(key: string): Promise<GameCollection | null>;
  createGameNftTrait(trait: InsertGameNftTrait): Promise<GameNftTrait>;
  getPlayerNfts(playerId: string): Promise<GameNftTrait[]>;
  
  // Battle system
  createBattle(battle: InsertGameBattle): Promise<GameBattle>;
  joinBattle(participant: InsertGameBattleParticipant): Promise<GameBattleParticipant>;
  getPlayerBattles(playerId: string): Promise<GameBattle[]>;
  
  // Player progression
  getPlayerProgression(playerId: string): Promise<GameProgression | null>;
  updatePlayerProgression(playerId: string, updates: Partial<InsertGameProgression>): Promise<GameProgression>;
}

// In-memory implementation for initial development
export class MemoryGamingStorage implements IGamingStorage {
  private players = new Map<string, GamePlayer>();
  private playersByHandle = new Map<string, string>(); // handle -> playerId
  private playersByUserId = new Map<string, string>(); // userId -> playerId
  private playerWallets = new Map<string, GamePlayerWallet[]>(); // playerId -> wallets
  private landBlocks = new Map<string, GameLandBlock>();
  private landClaims = new Map<string, GameLandClaim[]>(); // playerId -> claims
  private collections = new Map<string, GameCollection>();
  private nftTraits = new Map<string, GameNftTrait[]>(); // playerId -> traits
  private battles = new Map<string, GameBattle>();
  private battleParticipants = new Map<string, GameBattleParticipant[]>(); // battleId -> participants
  private playerBattles = new Map<string, string[]>(); // playerId -> battleIds
  private progression = new Map<string, GameProgression>(); // playerId -> progression

  constructor() {
    // Initialize with default land blocks for testing
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default collections
    const collections = [
      { key: 'trolls', chain: 'xrpl', name: 'The Trolls', description: 'Tax-collecting trolls', baseTraits: { type: 'troll' }, powerMultiplier: 1.2 },
      { key: 'inquisition', chain: 'ethereum', name: 'The Inquisition', description: 'Divine warriors', baseTraits: { type: 'inquisitor' }, powerMultiplier: 1.1 },
      { key: 'inquiry', chain: 'xrpl', name: 'The Inquiry', description: 'Swift scouts', baseTraits: { type: 'scout' }, powerMultiplier: 1.0 },
      { key: 'dantes_aurum', chain: 'ethereum', name: 'Dantes Aurum', description: 'Golden elites', baseTraits: { type: 'aurum' }, powerMultiplier: 1.3 },
      { key: 'lost_imperium', chain: 'polygon', name: 'Lost Imperium', description: 'Fallen empire', baseTraits: { type: 'imperium' }, powerMultiplier: 1.1 }
    ];

    collections.forEach(col => {
      this.collections.set(col.key, {
        ...col,
        powerMultiplier: col.powerMultiplier.toString(),
        createdAt: new Date()
      } as GameCollection);
    });

    // Create some sample land blocks for testing
    const sampleBlocks = [
      // XRPL blocks (0-1999)
      { id: 'xrpl:0', chain: 'xrpl', blockIndex: 0, claimCostRdl: '3.0', yieldRdlPerDay: '1.2', traits: { type: 'vault', bonus: 'speed' } },
      { id: 'xrpl:1', chain: 'xrpl', blockIndex: 1, claimCostRdl: '3.0', yieldRdlPerDay: '1.2', traits: { type: 'vault', bonus: 'speed' } },
      { id: 'xrpl:2', chain: 'xrpl', blockIndex: 2, claimCostRdl: '3.0', yieldRdlPerDay: '1.2', traits: { type: 'vault', bonus: 'speed' } },
      
      // Ethereum blocks (2000-3499)
      { id: 'ethereum:2000', chain: 'ethereum', blockIndex: 2000, claimCostRdl: '7.0', yieldRdlPerDay: '2.0', traits: { type: 'spire', bonus: 'defi' } },
      { id: 'ethereum:2001', chain: 'ethereum', blockIndex: 2001, claimCostRdl: '7.0', yieldRdlPerDay: '2.0', traits: { type: 'spire', bonus: 'defi' } },
      
      // Polygon blocks (3500-4999)
      { id: 'polygon:3500', chain: 'polygon', blockIndex: 3500, claimCostRdl: '2.0', yieldRdlPerDay: '0.8', traits: { type: 'ruins', bonus: 'mass' } },
      { id: 'polygon:3501', chain: 'polygon', blockIndex: 3501, claimCostRdl: '2.0', yieldRdlPerDay: '0.8', traits: { type: 'ruins', bonus: 'mass' } },
    ];

    sampleBlocks.forEach(block => {
      this.landBlocks.set(block.id, {
        ...block,
        ownerPlayerId: null,
        status: 'unclaimed',
        lastClaimedAt: null,
        createdAt: new Date()
      } as GameLandBlock);
    });
  }

  // Player management
  async getGamePlayerByHandle(handle: string): Promise<GamePlayer | null> {
    const playerId = this.playersByHandle.get(handle);
    if (!playerId) return null;
    return this.players.get(playerId) || null;
  }

  async getGamePlayerByUserId(userId: string): Promise<GamePlayer | null> {
    const playerId = this.playersByUserId.get(userId);
    if (!playerId) return null;
    return this.players.get(playerId) || null;
  }

  async createGamePlayer(playerData: InsertGamePlayer): Promise<GamePlayer> {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const player: GamePlayer = {
      id: playerId,
      handle: (playerData as any).handle ?? null,
      userId: (playerData as any).userId ?? null,
      primaryChain: (playerData as any).primaryChain ?? 'xrpl',
      primaryAddress: (playerData as any).primaryAddress ?? '',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.players.set(playerId, player);
    if (player.handle) {
      this.playersByHandle.set(player.handle, playerId);
    }
    if (player.userId) {
      this.playersByUserId.set(player.userId, playerId);
    }

    // Initialize empty collections for this player
    this.playerWallets.set(playerId, []);
    this.landClaims.set(playerId, []);
    this.nftTraits.set(playerId, []);
    this.playerBattles.set(playerId, []);

    // Initialize default progression
    const defaultProgression: GameProgression = {
      playerId: playerId,
      level: 1,
      experience: '0',
      achievements: [],
      totalLandOwned: 0,
      totalBattlesWon: 0,
      totalRdlEarned: '0',
      lastActivity: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.progression.set(playerId, defaultProgression);

    console.log(`🎮 [MEMORY-STORAGE] Created game player: ${playerId}`);
    return player;
  }

  async updateGamePlayerActivity(playerId: string): Promise<void> {
    const player = this.players.get(playerId);
    if (player) {
      player.lastActivity = new Date();
      this.players.set(playerId, player);
    }
  }

  // Player wallets
  async createGamePlayerWallet(walletData: InsertGamePlayerWallet): Promise<GamePlayerWallet> {
    const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wallet: GamePlayerWallet = {
      id: walletId,
      playerId: (walletData as any).playerId,
      chain: (walletData as any).chain ?? 'xrpl',
      address: (walletData as any).address ?? '',
      isPrimary: !!(walletData as any).isPrimary,
      createdAt: new Date()
    };

  const playerWallets = this.playerWallets.get((walletData as any).playerId) || [];
    playerWallets.push(wallet);
  this.playerWallets.set((walletData as any).playerId, playerWallets);

    return wallet;
  }

  async getGamePlayerWallets(playerId: string): Promise<GamePlayerWallet[]> {
    return this.playerWallets.get(playerId) || [];
  }

  // Land system
  async getLandBlocks(chain?: string, limit?: number): Promise<GameLandBlock[]> {
    let blocks = Array.from(this.landBlocks.values());
    
    if (chain) {
      blocks = blocks.filter(block => block.chain === chain);
    }
    
    if (limit) {
      blocks = blocks.slice(0, limit);
    }
    
    return blocks;
  }

  async getLandBlock(blockId: string): Promise<GameLandBlock | null> {
    return this.landBlocks.get(blockId) || null;
  }

  async claimLandBlock(claimData: InsertGameLandClaim): Promise<GameLandClaim> {
    const claimId = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const claim: GameLandClaim = {
      id: claimId,
  blockId: (claimData as any).blockId,
  playerId: (claimData as any).playerId,
  chain: (claimData as any).chain ?? 'xrpl',
  stakedRdl: (claimData as any).stakedRdl ?? '0',
  status: (claimData as any).status ?? 'active',
      createdAt: new Date(),
      releasedAt: null
    };

    // Update land block ownership
  const block = this.landBlocks.get((claimData as any).blockId);
    if (block) {
  block.ownerPlayerId = (claimData as any).playerId;
      block.status = 'claimed';
      block.lastClaimedAt = new Date();
  this.landBlocks.set((claimData as any).blockId, block);
    }

    // Add to player's claims
  const playerClaims = this.landClaims.get((claimData as any).playerId) || [];
    playerClaims.push(claim);
  this.landClaims.set((claimData as any).playerId, playerClaims);

    return claim;
  }

  async getPlayerLandClaims(playerId: string): Promise<GameLandClaim[]> {
    return this.landClaims.get(playerId) || [];
  }

  // Gaming collections and NFTs
  async getGameCollections(): Promise<GameCollection[]> {
    return Array.from(this.collections.values());
  }

  async getGameCollection(key: string): Promise<GameCollection | null> {
    return this.collections.get(key) || null;
  }

  async createGameNftTrait(traitData: InsertGameNftTrait): Promise<GameNftTrait> {
    const traitId = `trait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trait: GameNftTrait = {
      id: traitId,
  chain: (traitData as any).chain ?? 'xrpl',
  nftId: (traitData as any).nftId ?? '',
  collectionKey: (traitData as any).collectionKey ?? '',
  traits: (traitData as any).traits ?? {},
  power: (traitData as any).power ?? '100.0',
  level: (traitData as any).level ?? 1,
  experience: (traitData as any).experience ?? '0',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Find player by NFT and add to their traits
    // Note: This is simplified - in real implementation we'd have proper NFT ownership tracking
    return trait;
  }

  async getPlayerNfts(playerId: string): Promise<GameNftTrait[]> {
    return this.nftTraits.get(playerId) || [];
  }

  // Battle system
  async createBattle(battleData: InsertGameBattle): Promise<GameBattle> {
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const battle: GameBattle = {
      id: battleId,
  chain: (battleData as any).chain ?? 'xrpl',
  locationBlockId: (battleData as any).locationBlockId ?? null,
  battleType: (battleData as any).battleType ?? 'land_claim',
  status: (battleData as any).status ?? 'pending',
  wagerRdl: (battleData as any).wagerRdl ?? '0',
      winnerPlayerId: null,
      startedAt: null,
      endedAt: null,
      createdAt: new Date()
    };

    this.battles.set(battleId, battle);
    this.battleParticipants.set(battleId, []);

    return battle;
  }

  async joinBattle(participantData: InsertGameBattleParticipant): Promise<GameBattleParticipant> {
    const participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const participant: GameBattleParticipant = {
      id: participantId,
  battleId: (participantData as any).battleId,
  playerId: (participantData as any).playerId,
  nftId: (participantData as any).nftId ?? null,
  totalPower: (participantData as any).totalPower ?? '0',
      outcome: null,
      rewardRdl: '0',
      experienceGained: '0',
      createdAt: new Date()
    };

    // Add to battle participants
  const participants = this.battleParticipants.get((participantData as any).battleId) || [];
    participants.push(participant);
  this.battleParticipants.set((participantData as any).battleId, participants);

    // Add to player's battles
    const playerBattles = this.playerBattles.get((participantData as any).playerId) || [];
    if (!playerBattles.includes((participantData as any).battleId)) {
      playerBattles.push((participantData as any).battleId);
      this.playerBattles.set((participantData as any).playerId, playerBattles);
    }

    return participant;
  }

  async getPlayerBattles(playerId: string): Promise<GameBattle[]> {
    const battleIds = this.playerBattles.get(playerId) || [];
    return battleIds.map(id => this.battles.get(id)).filter(battle => battle) as GameBattle[];
  }

  // Player progression
  async getPlayerProgression(playerId: string): Promise<GameProgression | null> {
    return this.progression.get(playerId) || null;
  }

  async updatePlayerProgression(playerId: string, updates: Partial<InsertGameProgression>): Promise<GameProgression> {
    const current = this.progression.get(playerId);
    if (!current) {
      throw new Error(`Player progression not found: ${playerId}`);
    }

    const updated: GameProgression = {
      ...current,
      ...updates,
      updatedAt: new Date(),
      lastActivity: new Date()
    };

    this.progression.set(playerId, updated);
    return updated;
  }
}

// Export singleton instance
export const gamingStorage: IGamingStorage = new MemoryGamingStorage();