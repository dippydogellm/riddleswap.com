import { 
  nftCollections, 
  nfts, 
  type NftCollection,
  type Nft,
  type InsertNftCollection,
  type InsertNft
} from "@shared/nft-schema";
import {
  messages,
  nftSwapOffers,
  walletNftSearches,
  nftMetadataCache,
  type InsertMessage,
  type Message,
  type InsertNftSwapOffer,
  type NftSwapOffer,
  type InsertWalletNftSearch,
  type WalletNftSearch,
  type InsertNftMetadataCache,
  type NftMetadataCache
} from "@shared/schema";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and, desc, gt, isNotNull, gte, lt, sql, or } from "drizzle-orm";

export class NFTStorage {
  // Collection Methods
  async createCollection(data: InsertNftCollection): Promise<NftCollection> {
    const id = nanoid();
    const [collection] = await db
      .insert(nftCollections)
      .values({ ...data, id } as any)
      .returning();
    return collection;
  }

  async getAllCollections(): Promise<NftCollection[]> {
    return await db
      .select()
      .from(nftCollections)
      .orderBy(desc(nftCollections.createdAt));
  }

  async getCollection(id: string): Promise<NftCollection | null> {
    const [collection] = await db
      .select()
      .from(nftCollections)
      .where(eq(nftCollections.id, id))
      .limit(1);
    return collection || null;
  }

  async getCollectionsByCreator(creatorAddress: string): Promise<NftCollection[]> {
    return await db
      .select()
      .from(nftCollections)
      .where(
        eq(nftCollections.issuer, creatorAddress)
      )
      .orderBy(desc(nftCollections.createdAt));
  }

  async updateCollection(id: string, data: Partial<InsertNftCollection>): Promise<NftCollection | null> {
    const [collection] = await db
      .update(nftCollections)
      .set({  ...data, updatedAt: new Date()  } as any)
      .where(eq(nftCollections.id, id))
      .returning();
    return collection || null;
  }

  // NFT Methods
  async createNft(data: InsertNft): Promise<Nft> {
    const id = nanoid();
    const [nft] = await db
      .insert(nfts)
      .values({ ...data, id } as any)
      .returning();
    return nft;
  }

  async getNft(id: string): Promise<Nft | null> {
    const [nft] = await db
      .select()
      .from(nfts)
      .where(eq(nfts.id, id))
      .limit(1);
    return nft || null;
  }

  async getNftsByCollection(collectionId: string): Promise<Nft[]> {
    // The minimal NFT schema doesn't have a collectionId relationship.
    // Return an empty array to avoid relying on non-existent fields.
    return [];
  }

  async getNftsByOwner(ownerAddress: string): Promise<Nft[]> {
    return await db
      .select()
      .from(nfts)
      .where(
        eq(nfts.owner, ownerAddress)
      )
      .orderBy(desc(nfts.updatedAt));
  }

  async mintNft(id: string, ownerAddress: string, mintFeeHash: string): Promise<Nft | null> {
    const [nft] = await db
      .update(nfts)
      .set({ 
        owner: ownerAddress,
        // Persist fee hash in metadata if needed by upstream callers
        metadata: sql`${nfts.metadata} || ${JSON.stringify({ mintFeeHash })}::jsonb`,
        updatedAt: new Date()
       } as any)
      .where(eq(nfts.id, id))
      .returning();

    return nft || null;
  }

  // Marketplace Methods
  // Not supported in minimal schema; keep method for compatibility and return a stub
  async createListing(data: any): Promise<any> {
    return { ...data, id: nanoid(), status: 'unsupported' };
  }

  async getActiveListings(): Promise<any[]> {
    // Listings are not modeled in the minimal schema
    return [];
  }

  async getListingsByCollection(collectionId: string): Promise<any[]> {
    return [];
  }

  async deactivateListing(id: string): Promise<boolean> {
    return false;
  }

  // Launchpad Methods
  async createLaunchpadProject(data: any): Promise<any> { return { ...data, id: nanoid(), status: 'unsupported' }; }

  async getAllLaunchpadProjects(): Promise<any[]> { return []; }

  async getFeaturedProjects(): Promise<any[]> { return []; }

  async getLaunchpadProject(id: string): Promise<any | null> { return null; }

  async updateLaunchpadProject(id: string, data: any): Promise<any | null> { return null; }

  // Statistics Methods - NO FAKE DATA
  async getCollectionStats(collectionId: string): Promise<any> {
    // Return empty stats - no fake data generation
    return {
      totalMinted: 0,
      uniqueHolders: 0,
      volume24h: '0',
      floorPrice: '0',
      sales24h: 0
    };
  }

  async getTop24hCollections(): Promise<any[]> {
    // Return empty array - no fake data generation
    return [];
  }

  // Cache Methods
  async getCache(key: string): Promise<any | null> {
    // Not modeled in minimal schema
    return null;
  }

  async setCache(key: string, data: any, minutesToExpire: number): Promise<void> {
    // No-op in minimal schema
    return;
  }

  async clearExpiredCache(): Promise<void> {
    // No-op in minimal schema
    return;
  }

  // IPFS Methods
  async storeIpfsHash(hash: string, fileName: string, contentType?: string, size?: number): Promise<void> {
    // Not modeled in minimal schema
    return;
  }

  async getIpfsEntry(hash: string): Promise<any | null> {
    // Not modeled in minimal schema
    return null;
  }

  // Message Methods
  async createMessage(data: InsertMessage): Promise<Message> {
    const id = nanoid();
    const [message] = await db
      .insert(messages)
      .values({ ...data, id } as any)
      .returning();
    return message;
  }

  async getMessages(userId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(or(
        eq(messages.fromUserId, userId),
        eq(messages.toUserId, userId)
      ))
      .orderBy(desc(messages.createdAt));
  }

  async getConversation(userId1: string, userId2: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(or(
        and(eq(messages.fromUserId, userId1), eq(messages.toUserId, userId2)),
        and(eq(messages.fromUserId, userId2), eq(messages.toUserId, userId1))
      ))
      .orderBy(messages.createdAt);
  }

  async markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
    await db
      .update(messages)
      .set({  read: true  } as any)
      .where(and(
        eq(messages.fromUserId, otherUserId),
        eq(messages.toUserId, userId),
        eq(messages.read, false)
      ));
  }

  // NFT Swap Offer Methods
  async createSwapOffer(data: InsertNftSwapOffer): Promise<NftSwapOffer> {
    const id = nanoid();
    const [offer] = await db
      .insert(nftSwapOffers)
      .values({ ...data, id } as any)
      .returning();
    return offer;
  }

  async getSwapOffers(userId: string): Promise<NftSwapOffer[]> {
    return await db
      .select()
      .from(nftSwapOffers)
      .where(or(
        eq(nftSwapOffers.fromUserId, userId),
        eq(nftSwapOffers.toUserId, userId)
      ))
      .orderBy(desc(nftSwapOffers.createdAt));
  }

  async updateSwapOfferStatus(offerId: string, status: string, txHash?: string): Promise<NftSwapOffer | null> {
    const [offer] = await db
      .update(nftSwapOffers)
      .set({  
        status, 
        txHash,
        updatedAt: new Date() 
       } as any)
      .where(eq(nftSwapOffers.id, offerId))
      .returning();
    return offer || null;
  }

  // Wallet NFT Search Methods
  async getWalletNftSearch(walletAddress: string): Promise<WalletNftSearch | null> {
    const [search] = await db
      .select()
      .from(walletNftSearches)
      .where(and(
        eq(walletNftSearches.walletAddress, walletAddress),
        gt(walletNftSearches.cachedUntil, new Date())
      ))
      .limit(1);
    return search || null;
  }

  async saveWalletNftSearch(data: InsertWalletNftSearch): Promise<WalletNftSearch> {
    const id = nanoid();
    const cachedUntil = new Date(Date.now() + 10 * 60 * 1000); // Cache for 10 minutes
    
    // Upsert - update if exists, insert if not
    const [search] = await db
      .insert(walletNftSearches)
      .values({ 
        ...data, 
        id,
        cachedUntil 
      } as any)
      .onConflictDoUpdate({
        target: [walletNftSearches.walletAddress],
        set: {
          nfts: (data as any).nfts,
          metadata: (data as any).metadata,
          lastSearched: new Date(),
          cachedUntil
        } as any
      })
      .returning();
    return search;
  }

  // NFT Metadata Cache Methods
  async getNftMetadata(nftId: string): Promise<NftMetadataCache | null> {
    const [metadata] = await db
      .select()
      .from(nftMetadataCache)
      .where(and(
        eq(nftMetadataCache.nftId, nftId),
        gt(nftMetadataCache.expiresAt, new Date())
      ))
      .limit(1);
    return metadata || null;
  }

  async saveNftMetadata(data: InsertNftMetadataCache): Promise<NftMetadataCache> {
    const id = nanoid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Cache for 24 hours
    
    const [metadata] = await db
      .insert(nftMetadataCache)
      .values({ 
        ...data, 
        id,
        expiresAt 
      } as any)
      .onConflictDoUpdate({
        target: [nftMetadataCache.nftId],
        set: {
          uri: (data as any).uri,
          metadata: (data as any).metadata,
          traits: (data as any).traits,
          imageUrl: (data as any).imageUrl,
          cachedAt: new Date(),
          expiresAt
        } as any
      })
      .returning();
    return metadata;
  }

  async clearExpiredMetadata(): Promise<void> {
    await db
      .delete(nftMetadataCache)
      .where(lt(nftMetadataCache.expiresAt, new Date()));
  }
}

export const nftStorage = new NFTStorage();