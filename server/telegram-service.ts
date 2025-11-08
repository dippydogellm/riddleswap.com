/**
 * Telegram Service - Auto-post tweets and Oracle AI recommendations
 * Integrates with Twitter scheduler to send content to Telegram channel
 */

import axios from 'axios';

interface TelegramMessage {
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
}

interface TelegramConfig {
  botToken: string;
  channelId: string;
}

class TelegramService {
  private config: TelegramConfig;
  private baseUrl: string;

  /**
   * Escape HTML entities for Telegram HTML parse mode
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  constructor() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!botToken || !channelId) {
      console.warn('⚠️ [TELEGRAM] Bot token or channel ID not configured');
      this.config = { botToken: '', channelId: '' };
      this.baseUrl = '';
      return;
    }

    this.config = { botToken, channelId };
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    
    console.log('✅ [TELEGRAM] Telegram service initialized');
    console.log(`📱 [TELEGRAM] Channel ID: ${channelId}`);
  }

  /**
   * Check if Telegram is configured
   */
  isConfigured(): boolean {
    return !!(this.config.botToken && this.config.channelId);
  }

  /**
   * Send a text message to the Telegram channel
   */
  async sendMessage(text: string, options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disablePreview?: boolean;
  }): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Telegram not configured' };
    }

    try {
      const message: TelegramMessage = {
        text,
        parse_mode: options?.parseMode || 'HTML',
        disable_web_page_preview: options?.disablePreview || false
      };

      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.config.channelId,
        ...message
      });

      if (response.data.ok) {
        console.log('✅ [TELEGRAM] Message sent successfully');
        return { 
          success: true, 
          messageId: response.data.result.message_id 
        };
      } else {
        console.error('❌ [TELEGRAM] API returned error:', response.data);
        return { 
          success: false, 
          error: response.data.description || 'Unknown error' 
        };
      }
    } catch (error: any) {
      console.error('❌ [TELEGRAM] Failed to send message:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Post a tweet notification to Telegram
   */
  async postTweetNotification(tweetContent: string, tweetUrl?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ [TELEGRAM] Skipping tweet notification - not configured');
      return false;
    }

    try {
      // Escape HTML entities to prevent parsing errors
      const escapedContent = this.escapeHtml(tweetContent);
      let message = `🐦 <b>New Tweet Posted</b>\n\n${escapedContent}`;
      
      if (tweetUrl) {
        message += `\n\n🔗 <a href="${tweetUrl}">View on Twitter/X</a>`;
      }

      const result = await this.sendMessage(message, { parseMode: 'HTML' });
      
      if (result.success) {
        console.log('✅ [TELEGRAM] Tweet notification posted to channel');
        return true;
      } else {
        console.error('❌ [TELEGRAM] Failed to post tweet notification:', result.error);
        return false;
      }
    } catch (error: any) {
      console.error('❌ [TELEGRAM] Error posting tweet notification:', error.message);
      return false;
    }
  }

  /**
   * Send Oracle AI tweet recommendation to Telegram
   */
  async sendOracleTweetSuggestion(
    suggestion: string,
    category: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ [TELEGRAM] Skipping Oracle suggestion - not configured');
      return false;
    }

    try {
      // Escape HTML entities to prevent parsing errors
      const escapedSuggestion = this.escapeHtml(suggestion);
      const escapedCategory = this.escapeHtml(category);
      
      let message = `🔮 <b>Oracle AI Tweet Recommendation</b>\n\n`;
      message += `📁 Category: <code>${escapedCategory}</code>\n\n`;
      message += `${escapedSuggestion}\n\n`;
      
      if (metadata) {
        const escapedMetadata = this.escapeHtml(JSON.stringify(metadata, null, 2));
        message += `📊 <i>Metadata: ${escapedMetadata}</i>`;
      }
      
      message += `\n\n💡 <i>Review and approve to post this tweet</i>`;

      const result = await this.sendMessage(message, { parseMode: 'HTML' });
      
      if (result.success) {
        console.log('✅ [TELEGRAM] Oracle suggestion sent to channel');
        return true;
      } else {
        console.error('❌ [TELEGRAM] Failed to send Oracle suggestion:', result.error);
        return false;
      }
    } catch (error: any) {
      console.error('❌ [TELEGRAM] Error sending Oracle suggestion:', error.message);
      return false;
    }
  }

  /**
   * Send a daily summary of scheduled tweets
   */
  async sendDailySummary(stats: {
    tweetsPosted: number;
    lastTweetTime?: Date;
    nextTweetTime?: Date;
    categories: string[];
  }): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      let message = `📊 <b>Daily Twitter Activity Summary</b>\n\n`;
      message += `✅ Tweets Posted Today: ${stats.tweetsPosted}\n`;
      
      if (stats.lastTweetTime) {
        message += `🕐 Last Tweet: ${stats.lastTweetTime.toLocaleString()}\n`;
      }
      
      if (stats.nextTweetTime) {
        message += `⏰ Next Tweet: ${stats.nextTweetTime.toLocaleString()}\n`;
      }
      
      if (stats.categories.length > 0) {
        message += `\n📁 Categories Posted:\n`;
        stats.categories.forEach(cat => {
          message += `  • ${cat}\n`;
        });
      }

      const result = await this.sendMessage(message, { parseMode: 'HTML' });
      return result.success;
    } catch (error: any) {
      console.error('❌ [TELEGRAM] Error sending daily summary:', error.message);
      return false;
    }
  }

  /**
   * Test the Telegram connection
   */
  async testConnection(): Promise<{ success: boolean; botInfo?: any; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Telegram not configured' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      
      if (response.data.ok) {
        const botInfo = response.data.result;
        console.log('✅ [TELEGRAM] Connection test successful');
        console.log(`🤖 [TELEGRAM] Bot: @${botInfo.username}`);
        return { success: true, botInfo };
      } else {
        return { success: false, error: 'Invalid response from Telegram API' };
      }
    } catch (error: any) {
      console.error('❌ [TELEGRAM] Connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const telegramService = new TelegramService();
