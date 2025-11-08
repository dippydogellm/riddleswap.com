import { db } from './db';
import { swapAnnouncements, swapAnnouncementSettings } from '../shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { twitterService } from './twitter-service';
import { telegramService } from './telegram-service';

interface SwapData {
  txHash: string;
  chain: string;
  swapType: 'buy' | 'sell';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  usdValue?: number;
  traderAddress: string;
  traderHandle?: string;
  timestamp: Date;
}

export class SwapAnnouncementService {
  private isInitialized = false;
  private lastAnnouncementTime: Date | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    console.log('📊 [SWAP-ANNOUNCEMENTS] Swap announcement service initializing...');
    this.isInitialized = true;
    console.log('✅ [SWAP-ANNOUNCEMENTS] Service initialized');
  }

  /**
   * Process a swap and potentially create announcement
   */
  async processSwap(swapData: SwapData): Promise<void> {
    try {
      // Check if already announced
      const existing = await db.query.swapAnnouncements.findFirst({
        where: eq(swapAnnouncements.tx_hash, swapData.txHash),
      });

      if (existing) {
        console.log(`ℹ️ [SWAP-ANNOUNCEMENTS] Swap ${swapData.txHash} already announced`);
        return;
      }

      // Get settings
      const settings = await db.query.swapAnnouncementSettings.findFirst({
        where: eq(swapAnnouncementSettings.id, 1),
      });

      if (!settings || !settings.enabled) {
        console.log('ℹ️ [SWAP-ANNOUNCEMENTS] Announcements disabled');
        return;
      }

      // Check if meets minimum value threshold
      if (swapData.usdValue && Number(swapData.usdValue) < Number(settings.min_usd_value)) {
        console.log(`ℹ️ [SWAP-ANNOUNCEMENTS] Swap value $${swapData.usdValue} below minimum $${settings.min_usd_value}`);
        return;
      }

      // Check rate limiting
      if (!(await this.checkRateLimit(settings))) {
        console.log('⚠️ [SWAP-ANNOUNCEMENTS] Rate limit reached');
        return;
      }

      // Check cooldown
      if (!(await this.checkCooldown(settings.cooldown_minutes))) {
        console.log(`⚠️ [SWAP-ANNOUNCEMENTS] Cooldown active (${settings.cooldown_minutes} min)`);
        return;
      }

      // Determine if significant
      const isSignificant = swapData.usdValue ? Number(swapData.usdValue) >= Number(settings.whale_threshold) : false;
      const significanceReason = isSignificant ? 'whale_trade' : undefined;

      // Generate announcement text
      const announcementText = this.generateAnnouncementText(swapData, settings, isSignificant);
      const announcementType = isSignificant ? 'whale' : 'standard';

      console.log(`📊 [SWAP-ANNOUNCEMENTS] Creating announcement for ${swapData.swapType} swap of ${swapData.amountOut} ${swapData.tokenOut}`);

      // Create announcement record
      const announcementId = crypto.randomUUID();
      
      await db.insert(swapAnnouncements).values({
        tx_hash: swapData.txHash,
        chain: swapData.chain,
        swap_type: swapData.swapType,
        token_in: swapData.tokenIn,
        token_out: swapData.tokenOut,
        amount_in: swapData.amountIn,
        amount_out: swapData.amountOut,
        usd_value: swapData.usdValue?.toString(),
        trader_address: swapData.traderAddress,
        trader_handle: swapData.traderHandle,
        announcement_text: announcementText,
        announcement_type: announcementType,
        is_significant: isSignificant,
        significance_reason: significanceReason,
        swap_timestamp: swapData.timestamp,
      } as any) as any;

      console.log(`✅ [SWAP-ANNOUNCEMENTS] Announcement record created for ${swapData.txHash}`);

      // Post to platforms
      await this.postAnnouncement(announcementId, announcementText, settings);

      this.lastAnnouncementTime = new Date();
    } catch (error: any) {
      console.error('❌ [SWAP-ANNOUNCEMENTS] Error processing swap:', error.message);
    }
  }

  /**
   * Generate announcement text
   */
  private generateAnnouncementText(
    swapData: SwapData,
    settings: any,
    isSignificant: boolean
  ): string {
    const emojis = settings.use_emojis;
    const includeUSD = settings.include_usd_value && swapData.usdValue;
    const includeHandle = settings.include_trader_handle && swapData.traderHandle;

    let text = '';

    // Opening emoji and indicator
    if (emojis) {
      if (isSignificant) {
        text += '🐋 WHALE ALERT! 🐋\n\n';
      } else if (swapData.swapType === 'buy') {
        text += '🟢 RDL BUY\n\n';
      } else {
        text += '🔴 RDL SELL\n\n';
      }
    } else {
      if (isSignificant) {
        text += 'WHALE ALERT!\n\n';
      } else {
        text += `RDL ${swapData.swapType.toUpperCase()}\n\n`;
      }
    }

    // Trade details
    const amountFormatted = this.formatNumber(swapData.amountOut);
    text += `${amountFormatted} ${swapData.tokenOut}`;

    if (includeUSD && swapData.usdValue) {
      text += ` ($${this.formatNumber(swapData.usdValue.toString())})`;
    }

    text += '\n';

    // Trader info
    if (includeHandle) {
      text += `\nTrader: @${swapData.traderHandle}`;
    }

    // Call to action
    if (emojis) {
      text += '\n\n🔥 Trade $RDL on RiddleSwap!';
      text += '\n💎 riddleswap.com';
    } else {
      text += '\n\nTrade $RDL on RiddleSwap!';
      text += '\nriddleswap.com';
    }

    // Hashtags
    text += '\n\n#RiddleSwap #RDL #XRPL #DeFi';
    if (isSignificant) {
      text += ' #WhaleAlert';
    }

    return text;
  }

  /**
   * Format number for display
   */
  private formatNumber(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    } else {
      return num.toFixed(2);
    }
  }

  /**
   * Post announcement to configured platforms
   */
  private async postAnnouncement(
    announcementId: string,
    text: string,
    settings: any
  ): Promise<void> {
    // Post to Twitter
    if (settings.announce_on_twitter) {
      try {
        const tweetResult = await twitterService.postTweet(text, 'automatic', {
          announcement_id: announcementId,
        });

        if (tweetResult.success && tweetResult.tweetId) {
          await db.update(swapAnnouncements)
            .set({ 
              posted_to_twitter: true,
              twitter_tweet_id: tweetResult.tweetId,
              twitter_posted_at: new Date(),
             } as any)
            .where(eq(swapAnnouncements.id, announcementId));

          console.log(`🐦 [SWAP-ANNOUNCEMENTS] Posted to Twitter: ${tweetResult.tweetId}`);
        } else {
          await db.update(swapAnnouncements)
            .set({ 
              twitter_error: tweetResult.error || 'Unknown error',
             } as any)
            .where(eq(swapAnnouncements.id, announcementId));

          console.error('❌ [SWAP-ANNOUNCEMENTS] Twitter post failed:', tweetResult.error);
        }
      } catch (error: any) {
        console.error('❌ [SWAP-ANNOUNCEMENTS] Twitter error:', error.message);
        
        await db.update(swapAnnouncements)
          .set({ 
            twitter_error: error.message,
           } as any)
          .where(eq(swapAnnouncements.id, announcementId));
      }
    }

    // Post to Telegram
    if (settings.announce_on_telegram) {
      try {
        const telegramResult = await telegramService.sendMessage(text);

        if (telegramResult.success) {
          await db.update(swapAnnouncements)
            .set({ 
              posted_to_telegram: true,
              telegram_message_id: telegramResult.messageId,
              telegram_posted_at: new Date(),
             } as any)
            .where(eq(swapAnnouncements.id, announcementId));

          console.log(`📱 [SWAP-ANNOUNCEMENTS] Posted to Telegram: ${telegramResult.messageId}`);
        } else {
          await db.update(swapAnnouncements)
            .set({ 
              telegram_error: telegramResult.error || 'Unknown error',
             } as any)
            .where(eq(swapAnnouncements.id, announcementId));

          console.error('❌ [SWAP-ANNOUNCEMENTS] Telegram post failed:', telegramResult.error);
        }
      } catch (error: any) {
        console.error('❌ [SWAP-ANNOUNCEMENTS] Telegram error:', error.message);
        
        await db.update(swapAnnouncements)
          .set({ 
            telegram_error: error.message,
           } as any)
          .where(eq(swapAnnouncements.id, announcementId));
      }
    }
  }

  /**
   * Check if rate limit allows posting
   */
  private async checkRateLimit(settings: any): Promise<boolean> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentAnnouncements = await db.query.swapAnnouncements.findMany({
      where: gte(swapAnnouncements.created_at, hourAgo),
    });

    return recentAnnouncements.length < settings.max_announcements_per_hour;
  }

  /**
   * Check cooldown period
   */
  private async checkCooldown(cooldownMinutes: number): Promise<boolean> {
    if (!this.lastAnnouncementTime) {
      return true;
    }

    const cooldownMs = cooldownMinutes * 60 * 1000;
    const timeSinceLastPost = Date.now() - this.lastAnnouncementTime.getTime();

    return timeSinceLastPost >= cooldownMs;
  }

  /**
   * Get recent announcements
   */
  async getRecentAnnouncements(limit: number = 20) {
    return await db.query.swapAnnouncements.findMany({
      orderBy: desc(swapAnnouncements.created_at),
      limit,
    });
  }

  /**
   * Get settings
   */
  async getSettings() {
    return await db.query.swapAnnouncementSettings.findFirst({
      where: eq(swapAnnouncementSettings.id, 1),
    });
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<any>) {
    return await db.update(swapAnnouncementSettings)
      .set(updates)
      .where(eq(swapAnnouncementSettings.id, 1))
      .returning();
  }

  /**
   * Test announcement with sample data
   */
  async testAnnouncement(): Promise<void> {
    console.log('🧪 [SWAP-ANNOUNCEMENTS] Running test announcement...');

    const testSwap: SwapData = {
      txHash: `TEST_${Date.now()}`,
      chain: 'xrpl',
      swapType: 'buy',
      tokenIn: 'XRP',
      tokenOut: 'RDL',
      amountIn: '5000',
      amountOut: '125000',
      usdValue: 2500,
      traderAddress: 'rTestAddress123',
      traderHandle: 'TestTrader',
      timestamp: new Date(),
    };

    await this.processSwap(testSwap);
    console.log('✅ [SWAP-ANNOUNCEMENTS] Test announcement complete');
  }
}

export const swapAnnouncementService = new SwapAnnouncementService();
