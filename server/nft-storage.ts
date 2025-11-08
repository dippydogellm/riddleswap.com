import { 
  nftCollections, 
  nfts, 
  nftListings, 
  launchpadProjects, 
  apiCache, 
  ipfsStorage,
  type NftCollection,
  type Nft,
  type NftListing,
  type LaunchpadProject,
  type InsertNftCollection,
  type InsertNft,
  type InsertNftListing,
  type InsertLaunchpadProject
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
      .where(eq(nftCollections.isActive, true))
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
      .where(and(
        eq(nftCollections.creatorAddress, creatorAddress),
        eq(nftCollections.isActive, true)
      ))
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
    return await db
      .select()
      .from(nfts)
      .where(eq(nfts.collectionId, collectionId))
      .orderBy(nfts.tokenId);
  }

  async getNftsByOwner(ownerAddress: string): Promise<Nft[]> {
    return await db
      .select()
      .from(nfts)
      .where(and(
        eq(nfts.ownerAddress, ownerAddress),
        eq(nfts.isMinted, true)
      ))
      .orderBy(desc(nfts.mintedAt));
  }

  async mintNft(id: string, ownerAddress: string, mintFeeHash: string): Promise<Nft | null> {
    const [nft] = await db
      .update(nfts)
      .set({ 
        isMinted: true,
        ownerAddress,
        mintFeeHash,
        mintedAt: new Date()
       } as any)
      .where(eq(nfts.id, id))
      .returning();

    if (nft) {
      // Update collection minted count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(nfts)
        .where(and(
          eq(nfts.collectionId, nft.collectionId),
          eq(nfts.isMinted, true)
        ));
      
      await db
        .update(nftCollections)
        .set({  mintedCount: count  } as any)
        .where(eq(nftCollections.id, nft.collectionId));
    }

    return nft || null;
  }

  // Marketplace Methods
  async createListing(data: InsertNftListing): Promise<NftListing> {
    const id = nanoid();
    const [listing] = await db
      .insert(nftListings)
      .values({ ...data, id } as any)
      .returning();
    return listing;
  }

  async getActiveListings(): Promise<any[]> {
    // Use Drizzle query builder instead of raw SQL
    const results = await db
      .select({
        id: nftListings.id,
        nftId: nftListings.nftId,
        sellerAddress: nftListings.sellerAddress,
        price: nftListings.price,
        currency: nftListings.currency,
        isActive: nftListings.isActive,
        expiresAt: nftListings.expiresAt,
        createdAt: nftListings.createdAt,
        nft_id: nfts.id,
        nft_name: nfts.name,
        nft_description: nfts.description,
        nft_image: nfts.image,
        nft_attributes: nfts.attributes,
        nft_rarity: nfts.rarity,
        collection_id: nftCollections.id,
        collection_name: nftCollections.name,
        collection_image: nftCollections.image
      })
      .from(nftListings)
      .innerJoin(nfts, eq(nftListings.nftId, nfts.id))
      .innerJoin(nftCollections, eq(nfts.collectionId, nftCollections.id))
      .where(eq(nftListings.isActive, true));
    return results.map((row) => ({
      id: row.id,
      nftId: row.nftId,
      sellerAddress: row.sellerAddress,
      price: row.price,
      currency: row.currency,
      isActive: row.isActive,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      nft: {
        id: row.nft_id,
        name: row.nft_name,
        description: row.nft_description,
        image: row.nft_image,
        attributes: row.nft_attributes,
        rarity: row.nft_rarity,
        collection: {
          id: row.collection_id,
          name: row.collection_name,
          image: row.collection_image
        }
      }
    }));
  }

  async getListingsByCollection(collectionId: string): Promise<NftListing[]> {
    const listings = await db
      .select()
      .from(nftListings)
      .innerJoin(nfts, eq(nftListings.nftId, nfts.id))
      .where(and(
        eq(nfts.collectionId, collectionId),
        eq(nftListings.isActive, true)
      ))
      .orderBy(desc(nftListings.createdAt));
    
    return listings.map(row => row.nft_listings) as NftListing[];
  }

  async deactivateListing(id: string): Promise<boolean> {
    const result = await db
      .update(nftListings)
      .set({  isActive: false, updatedAt: new Date()  } as any)
      .where(eq(nftListings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Launchpad Methods
  async createLaunchpadProject(data: InsertLaunchpadProject): Promise<LaunchpadProject> {
    const id = nanoid();
    const [project] = await db
      .insert(launchpadProjects)
      .values({ ...data, id } as any)
      .returning();
    return project;
  }

  async getAllLaunchpadProjects(): Promise<LaunchpadProject[]> {
    return await db
      .select()
      .from(launchpadProjects)
      .orderBy(desc(launchpadProjects.createdAt));
  }

  async getFeaturedProjects(): Promise<LaunchpadProject[]> {
    return await db
      .select()
      .from(launchpadProjects)
      .where(eq(launchpadProjects.status, 'launched'))
      .orderBy(desc(launchpadProjects.launchDate))
      .limit(6);
  }

  async getLaunchpadProject(id: string): Promise<LaunchpadProject | null> {
    const [project] = await db
      .select()
      .from(launchpadProjects)
      .where(eq(launchpadProjects.id, id))
      .limit(1);
    return project || null;
  }

  async updateLaunchpadProject(id: string, data: Partial<InsertLaunchpadProject>): Promise<LaunchpadProject | null> {
    const [project] = await db
      .update(launchpadProjects)
      .set({  ...data, updatedAt: new Date()  } as any)
      .where(eq(launchpadProjects.id, id))
      .returning();
    return project || null;
  }

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
    const [cache] = await db
      .select()
      .from(apiCache)
      .where(and(
        eq(apiCache.cacheKey, key),
        gt(apiCache.expiresAt, new Date())
      ))
      .limit(1);
    
    if (cache) {
      // Calculate TTL for CDN headers
      const ttl = Math.floor((cache.expiresAt.getTime() - Date.now()) / 1000);
      return {
        data: cache.data,
        ttl: ttl.toString(),
        cachedAt: cache.createdAt,
        expiresAt: cache.expiresAt
      };
    }
    
    return null;
  }

  async setCache(key: string, data: any, minutesToExpire: number): Promise<void> {
    const expiresAt = new Date(Date.now() + minutesToExpire * 60 * 1000);
    
    await db
      .insert(apiCache)
      .values({
        cacheKey: key,
        data,
        expiresAt
      } as any)
      .onConflictDoUpdate({
        target: [apiCache.cacheKey],
        set: {
          data,
          expiresAt
        }
      });
  }

  async clearExpiredCache(): Promise<void> {
    await db
      .delete(apiCache)
      .where(lt(apiCache.expiresAt, new Date()));
  }

  // IPFS Methods
  async storeIpfsHash(hash: string, fileName: string, contentType?: string, size?: number): Promise<void> {
    await db
      .insert(ipfsStorage)
      .values({
        hash,
        fileName,
        contentType,
        size
      } as any)
      .onConflictDoNothing();
  }

  async getIpfsEntry(hash: string): Promise<any | null> {
    const [entry] = await db
      .select()
      .from(ipfsStorage)
      .where(eq(ipfsStorage.hash, hash))
      .limit(1);
    return entry || null;
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
          nfts: data.nfts,
          metadata: data.metadata,
          lastSearched: new Date(),
          cachedUntil
        }
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
          uri: data.uri,
          metadata: data.metadata,
          traits: data.traits,
          imageUrl: data.imageUrl,
          cachedAt: new Date(),
          expiresAt
        }
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