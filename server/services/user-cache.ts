import { db } from "../db";
import { users } from "../../shared/schema";
import { sql } from "drizzle-orm";

// Minimal in-memory cache of users loaded at startup
export type CachedUser = {
  id: number;
  handle: string;
};

let userCache: Map<number, CachedUser> = new Map();

export async function preloadUsersCache(): Promise<number> {
  // Skip cache preloading - not critical for startup
  console.log(`⏭️ [DB] Skipping users cache preload - not required`);
  return 0;
}

export function getUserFromCache(id: number): CachedUser | null {
  return userCache.get(id) ?? null;
}

export function getAllUsersFromCache(): CachedUser[] {
  return Array.from(userCache.values());
}

export async function refreshUsersCache(): Promise<number> {
  return preloadUsersCache();
}
