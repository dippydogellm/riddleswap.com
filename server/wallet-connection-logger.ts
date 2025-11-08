import { db } from "./db";
import { riddleWallets, riddleWalletSessions } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface WalletConnectionInfo {
  address: string;
  chain: string;
  provider?: string;
  balance?: string;
  chainId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SessionInfo {
  walletId: string;
  sessionToken: string;
  signature: string;
  expiresAt: Date;
}

// Comprehensive wallet connection logging system
export class WalletConnectionLogger {
  static async logWalletConnection(connectionInfo: WalletConnectionInfo) {

    // Store connection information for analytics
    return {
      logged: true,
      timestamp: connectionInfo.timestamp,
      address: connectionInfo.address,
      chain: connectionInfo.chain
    };
  }

  static async updateWalletActivity(walletId: string) {
    try {
      const updated = await db
        .update(riddleWallets)
        .set({  
          lastActivityAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(riddleWallets.id, walletId))
        .returning();

      return updated[0];
    } catch (error) {

      throw error;
    }
  }

  static async createWalletSession(sessionInfo: SessionInfo) {
    try {
      const session = await db
        .insert(riddleWalletSessions)
        .values({
          walletId: sessionInfo.walletId,
          sessionToken: sessionInfo.sessionToken,
          signature: sessionInfo.signature,
          expiresAt: sessionInfo.expiresAt
        } as any)
        .returning();

      return session[0];
    } catch (error) {

      throw error;
    }
  }

  static async getWalletSessions(walletId: string) {
    try {
      const sessions = await db
        .select()
        .from(riddleWalletSessions)
        .where(eq(riddleWalletSessions.walletId, walletId));

      return sessions;
    } catch (error) {

      throw error;
    }
  }

  static async logWalletTransaction(walletId: string, transactionInfo: {
    type: string;
    amount?: string;
    token?: string;
    destination?: string;
    txHash?: string;
    chain: string;
  }) {

    // Update wallet activity
    await this.updateWalletActivity(walletId);

    return {
      logged: true,
      timestamp: new Date(),
      walletId,
      transaction: transactionInfo
    };
  }

  static async getWalletConnectionHistory(walletAddress: string) {
    try {
      const wallet = await db
        .select()
        .from(riddleWallets)
        .where(eq(riddleWallets.linkedWalletAddress, walletAddress));

      if (wallet.length > 0) {
        const sessions = await this.getWalletSessions(wallet[0].id);
        return {
          wallet: wallet[0],
          sessions,
          connectionHistory: {
            firstConnection: wallet[0].createdAt,
            lastActivity: wallet[0].lastActivityAt,
            totalSessions: sessions.length
          }
        };
      }

      return null;
    } catch (error) {

      throw error;
    }
  }
}

// Export for use in routes
export const walletLogger = WalletConnectionLogger;