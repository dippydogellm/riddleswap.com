/**
 * Activity Monitor Service
 * Monitors user activities and generates automatic tweets for:
 * - New wallet registrations
 * - Large trades/swaps
 * - New NFT mints
 * - Battle victories
 * - Any significant platform activity
 */

import { db } from './db';
import { users, transactions, gamingNfts, gamingNftCollections, battles, riddleWallets } from '../shared/schema';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { twitterService } from './twitter-service';

interface ActivityEvent {
  type: 'new_user' | 'big_trade' | 'nft_mint' | 'battle_win' | 'milestone';
  data: any;
  timestamp: Date;
}

class ActivityMonitorService {
  private lastCheckTime: Date = new Date();
  private processedEvents: Set<string> = new Set();
  
  // Thresholds for "big" events
  private readonly BIG_TRADE_THRESHOLD_XRP = 1000; // 1000+ XRP
  private readonly BIG_TRADE_THRESHOLD_USD = 500;  // $500+ USD value

  /**
   * Check for new activities and generate tweets
   */
  async checkForActivities(): Promise<ActivityEvent[]> {
    const activities: ActivityEvent[] = [];

    try {
      console.log('🔍 [ACTIVITY-MONITOR] Checking for new activities...');
      
      // Check for new users
      const newUsers = await this.checkNewUsers();
      activities.push(...newUsers);

      // Check for big trades
      const bigTrades = await this.checkBigTrades();
      activities.push(...bigTrades);

      // Check for new NFT mints
      const nftMints = await this.checkNFTMints();
      activities.push(...nftMints);

      // Check for battle victories
      const battleWins = await this.checkBattleWins();
      activities.push(...battleWins);

      // Check for platform milestones
      const milestones = await this.checkMilestones();
      activities.push(...milestones);

      this.lastCheckTime = new Date();
      
      if (activities.length > 0) {
        console.log(`✅ [ACTIVITY-MONITOR] Found ${activities.length} activities to tweet about`);
      }

      return activities;
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error checking activities:', error);
      return activities;
    }
  }

  /**
   * Check for new user registrations
   */
  private async checkNewUsers(): Promise<ActivityEvent[]> {
    try {
      // Skip if riddleWallets table not properly initialized
      if (!riddleWallets) {
        return [];
      }
      
      const recentUsers = await db
        .select({
          handle: riddleWallets.handle,
          createdAt: riddleWallets.createdAt,
        })
        .from(riddleWallets)
        .where(gte(riddleWallets.createdAt, this.lastCheckTime))
        .orderBy(desc(riddleWallets.createdAt))
        .limit(5);

      return recentUsers.map(user => ({
        type: 'new_user' as const,
        data: {
          handle: user.handle,
          createdAt: user.createdAt,
        },
        timestamp: new Date(user.createdAt as Date),
      }));
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error checking new users:', error);
      return [];
    }
  }

  /**
   * Check for big trades (transactions over threshold)
   */
  private async checkBigTrades(): Promise<ActivityEvent[]> {
    try {
      const recentTrades = await db
        .select()
        .from(transactions)
        .where(gte(transactions.created_at, this.lastCheckTime))
        .orderBy(desc(transactions.created_at))
        .limit(10);

      const bigTrades = recentTrades.filter(trade => {
        // Check if trade is "big" enough using from_amount
        const amount = parseFloat(trade.from_amount || '0');
        return amount >= this.BIG_TRADE_THRESHOLD_USD; // Using USD threshold for now
      });

      return bigTrades.map(trade => ({
        type: 'big_trade' as const,
        data: {
          amount: trade.from_amount,
          currency: 'TOKENS',
          fromChain: 'multi-chain',
          toChain: 'multi-chain',
          hash: trade.transaction_hash || 'pending',
        },
        timestamp: trade.created_at ? new Date(trade.created_at) : new Date(),
      }));
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error checking big trades:', error);
      return [];
    }
  }

  /**
   * Check for new NFT mints
   */
  private async checkNFTMints(): Promise<ActivityEvent[]> {
    try {
      // Query gaming NFTs with collection info
      const recentMints = await db
        .select({
          nft_name: gamingNfts.name,
          nft_id: gamingNfts.nft_id,
          owner_address: gamingNfts.owner_address,
          created_at: gamingNfts.created_at,
          collection_name: gamingNftCollections.collection_name,
        })
        .from(gamingNfts)
        .leftJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
        .where(gte(gamingNfts.created_at, this.lastCheckTime))
        .orderBy(desc(gamingNfts.created_at))
        .limit(5);

      return recentMints.map(nft => ({
        type: 'nft_mint' as const,
        data: {
          name: nft.nft_name || 'Unknown NFT',
          collection: nft.collection_name || 'Unknown Collection',
          owner: nft.owner_address || 'Unknown',
        },
        timestamp: nft.created_at ? new Date(nft.created_at) : new Date(),
      }));
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error checking NFT mints:', error);
      return [];
    }
  }

  /**
   * Check for battle victories
   */
  private async checkBattleWins(): Promise<ActivityEvent[]> {
    try {
      const recentBattles = await db
        .select()
        .from(battles)
        .where(gte(battles.created_at, this.lastCheckTime))
        .orderBy(desc(battles.created_at))
        .limit(5);

      return recentBattles
        .filter(battle => battle.winner_player_id)
        .map(battle => ({
          type: 'battle_win' as const,
          data: {
            winner: battle.winner_player_id || 'Unknown',
            wagerAmount: battle.wager_amount,
            battleType: battle.battle_type,
          },
          timestamp: new Date(battle.created_at),
        }));
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error checking battle wins:', error);
      return [];
    }
  }

  /**
   * Check for platform milestones
   */
  private async checkMilestones(): Promise<ActivityEvent[]> {
    try {
      // Count total users
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      const totalUsers = userCount[0]?.count || 0;

      // Count total transactions
      const txCount = await db.select({ count: sql<number>`count(*)` }).from(transactions);
      const totalTx = txCount[0]?.count || 0;

      const milestones: ActivityEvent[] = [];

      // Check for user milestones (100, 500, 1000, 5000, 10000)
      const userMilestones = [100, 500, 1000, 5000, 10000];
      for (const milestone of userMilestones) {
        if (totalUsers === milestone) {
          milestones.push({
            type: 'milestone' as const,
            data: {
              type: 'users',
              count: milestone,
              message: `${milestone} users joined RiddleSwap! 🎉`,
            },
            timestamp: new Date(),
          });
        }
      }

      // Check for transaction milestones
      const txMilestones = [1000, 5000, 10000, 50000, 100000];
      for (const milestone of txMilestones) {
        if (totalTx === milestone) {
          milestones.push({
            type: 'milestone' as const,
            data: {
              type: 'transactions',
              count: milestone,
              message: `${milestone} transactions processed! 💫`,
            },
            timestamp: new Date(),
          });
        }
      }

      return milestones;
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error checking milestones:', error);
      return [];
    }
  }

  /**
   * Generate and post tweet for an activity
   */
  async tweetActivity(activity: ActivityEvent): Promise<boolean> {
    try {
      // Generate unique event ID based on activity type and data
      const eventId = this.generateUniqueEventId(activity);
      
      // Skip if already processed
      if (this.processedEvents.has(eventId)) {
        return false;
      }

      const tweetContent = this.generateTweetContent(activity);
      
      console.log(`🐦 [ACTIVITY-MONITOR] Tweeting activity: ${activity.type}`);
      const result = await twitterService.postTweet(tweetContent, 'automatic', {
        activity_type: activity.type,
        activity_data: activity.data,
      });

      if (result.success) {
        this.processedEvents.add(eventId);
        console.log(`✅ [ACTIVITY-MONITOR] Posted tweet for ${activity.type}: ${result.tweetId}`);
        return true;
      } else {
        console.error(`❌ [ACTIVITY-MONITOR] Failed to post tweet:`, result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ [ACTIVITY-MONITOR] Error tweeting activity:', error);
      return false;
    }
  }

  /**
   * Generate tweet content based on activity type
   */
  private generateTweetContent(activity: ActivityEvent): string {
    switch (activity.type) {
      case 'new_user':
        return `🎉 Welcome to RiddleSwap, @${activity.data.handle}! 

Join them on the multi-chain DeFi journey across 17 blockchains!

🔗 XRPL | 🔷 Ethereum | 🟣 Solana | ₿ Bitcoin
💱 Best rates • 🎨 NFT Marketplace • ⚔️ Gaming Battles

#RiddleSwap #XRPL #DeFi`;

      case 'big_trade':
        const amount = parseFloat(activity.data.amount);
        const formattedAmount = amount.toLocaleString();
        return `🚀 Big Move Alert! 

${formattedAmount} ${activity.data.currency} swapped on RiddleSwap!

From: ${activity.data.fromChain}
To: ${activity.data.toChain}

💰 Join the action and get the best rates across 17 chains!

#DeFi #CryptoTrading #XRPL`;

      case 'nft_mint':
        return `🎨 New NFT Minted!

"${activity.data.name}" from ${activity.data.collection}

Minted by @${activity.data.owner}

Explore our NFT marketplace and gaming battles!

#NFT #XRPL #Gaming`;

      case 'battle_win':
        const wager = activity.data.wagerAmount ? `${activity.data.wagerAmount} XRP` : 'glory';
        return `⚔️ Battle Victory!

@${activity.data.winner} wins in ${activity.data.battleType} combat!
Wager: ${wager}

Join the NFT gaming battles and prove your strategy!

#NFTGaming #XRPL #Battles`;

      case 'milestone':
        return `🎊 MILESTONE ACHIEVED! 

${activity.data.message}

Thank you to our amazing community! Together we're building the future of multi-chain DeFi.

#RiddleSwap #Milestone #XRPL #DeFi`;

      default:
        return `🔥 Exciting activity on RiddleSwap!

Join our growing community of traders, collectors, and gamers!

#RiddleSwap #XRPL #DeFi`;
    }
  }

  /**
   * Generate unique event ID based on activity type and specific data
   */
  private generateUniqueEventId(activity: ActivityEvent): string {
    switch (activity.type) {
      case 'new_user':
        return `new_user_${activity.data.handle}`;
      
      case 'big_trade':
        return `big_trade_${activity.data.hash}`;
      
      case 'nft_mint':
        return `nft_mint_${activity.data.name}_${activity.data.owner}_${activity.timestamp.getTime()}`;
      
      case 'battle_win':
        return `battle_win_${activity.data.winner}_${activity.timestamp.getTime()}`;
      
      case 'milestone':
        return `milestone_${activity.data.type}_${activity.data.count}`;
      
      default:
        return `${activity.type}_${activity.timestamp.getTime()}`;
    }
  }

  /**
   * Clean up old processed events (keep last 1000)
   */
  cleanupProcessedEvents() {
    if (this.processedEvents.size > 1000) {
      const eventsArray = Array.from(this.processedEvents);
      this.processedEvents = new Set(eventsArray.slice(-1000));
    }
  }
}

export const activityMonitor = new ActivityMonitorService();
export default activityMonitor;
