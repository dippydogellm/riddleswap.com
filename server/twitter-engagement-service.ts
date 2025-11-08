import { TwitterApi } from 'twitter-api-v2';
import { db } from './db';
import { twitterMentions, twitterEngagementSettings, twitterEngagementActions } from '../shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class TwitterEngagementService {
  private twitterClient: TwitterApi | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
        console.log('⚠️ [ENGAGEMENT] Twitter API credentials not configured');
        return;
      }

      if (!process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
        console.log('⚠️ [ENGAGEMENT] Twitter access tokens not configured');
        return;
      }

      this.twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });

      this.isInitialized = true;
      console.log('✅ [ENGAGEMENT] Twitter engagement service initialized');
    } catch (error) {
      console.error('❌ [ENGAGEMENT] Failed to initialize:', error);
    }
  }

  async scanMentions(): Promise<void> {
    if (!this.isInitialized || !this.twitterClient) {
      console.log('⚠️ [ENGAGEMENT] Service not initialized');
      return;
    }

    try {
      const settings = await db.query.twitterEngagementSettings.findFirst({
        where: eq(twitterEngagementSettings.id, 1),
      });

      if (!settings) {
        console.log('⚠️ [ENGAGEMENT] No settings found');
        return;
      }

      if (!settings.enabled_by_admin) {
        console.log('ℹ️ [ENGAGEMENT] Engagement scanning disabled by admin');
        return;
      }

      const keywords = settings.monitored_keywords as string[];
      console.log(`🔍 [ENGAGEMENT] Scanning for keywords:`, keywords);

      const searchQuery = keywords.join(' OR ');
      
      const response = await this.twitterClient.v2.search(searchQuery, {
        max_results: 10,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
        'user.fields': ['username', 'name', 'public_metrics', 'verified'],
        expansions: ['author_id'],
      });

      const tweets = response.tweets || [];
      const users = response.includes?.users || [];

      console.log(`📊 [ENGAGEMENT] Found ${tweets.length} tweets`);
      console.log(`📊 [ENGAGEMENT] Includes ${users.length} users`);

      if (tweets.length === 0) {
        console.log('ℹ️ [ENGAGEMENT] No tweets found in search results');
        return;
      }

      for (const tweet of tweets) {
        await this.processTweet(tweet, users, settings, keywords);
      }

      console.log('✅ [ENGAGEMENT] Mention scan complete');
    } catch (error: any) {
      console.error('❌ [ENGAGEMENT] Error scanning mentions:', error.message);
    }
  }

  private async processTweet(
    tweet: any,
    users: any[],
    settings: any,
    keywords: string[]
  ): Promise<void> {
    try {
      const existing = await db.query.twitterMentions.findFirst({
        where: eq(twitterMentions.tweet_id, tweet.id),
      });

      if (existing) {
        return;
      }

      const author = users.find(u => u.id === tweet.author_id);
      if (!author) {
        console.log(`⚠️ [ENGAGEMENT] Author not found for tweet ${tweet.id}`);
        return;
      }

      const matchedKeywords = keywords.filter(kw =>
        tweet.text.toLowerCase().includes(kw.toLowerCase())
      );

      const sentiment = await this.analyzeSentiment(tweet.text);
      const isSpam = await this.detectSpam(tweet.text, settings.block_keywords as string[]);

      let mentionType = 'keyword_match';
      if (tweet.text.includes('@RiddleSwap')) {
        mentionType = 'direct_mention';
      } else if (tweet.in_reply_to_user_id) {
        mentionType = 'reply';
      } else if (tweet.referenced_tweets?.some((rt: any) => rt.type === 'quoted')) {
        mentionType = 'quote_tweet';
      }

      const priority = this.calculatePriority(sentiment, author.public_metrics?.followers_count || 0);
      const requiresResponse = sentiment !== 'negative' && !isSpam && mentionType === 'direct_mention';

      const mentionId = crypto.randomUUID();
      
      // Cast values block due to additional fields (id) or complex arrays not reflected in inferred insert type
      await db.insert(twitterMentions).values({
        id: mentionId,
        tweet_id: tweet.id,
        tweet_url: `https://twitter.com/${author.username}/status/${tweet.id}`,
        tweet_text: tweet.text,
        author_username: author.username,
        author_name: author.name,
        author_followers: author.public_metrics?.followers_count || 0,
        author_verified: author.verified || false,
        mention_type: mentionType,
        matched_keywords: matchedKeywords,
        sentiment,
        is_spam: isSpam,
        requires_response: requiresResponse,
        priority,
        engagement_status: 'pending',
        tweet_created_at: new Date(tweet.created_at as any),
      } as any);

      console.log(`✅ [ENGAGEMENT] Saved mention from @${author.username} (${sentiment}, ${priority} priority, ${matchedKeywords.length} keywords)`);
      console.log(`📝 [ENGAGEMENT] Tweet: "${tweet.text.substring(0, 100)}..."`);

      if (requiresResponse && settings.auto_reply_enabled) {
        console.log(`🤖 [ENGAGEMENT] Generating AI response for @${author.username}...`);
        await this.generateAIResponse(mentionId, tweet.text, author.username, settings);
      }

      if (settings.auto_like_enabled) {
        await this.autoLike(mentionId, tweet.id, author, sentiment, settings);
      }

      if (settings.auto_retweet_enabled) {
        await this.autoRetweet(mentionId, tweet.id, author, sentiment, settings);
      }
    } catch (error: any) {
      console.error(`❌ [ENGAGEMENT] Error processing tweet:`, error.message);
    }
  }

  private async analyzeSentiment(text: string): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return 'neutral';
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content: 'Analyze the sentiment of the tweet. Respond with only one word: positive, neutral, negative, or spam.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 10,
      });

      const sentiment = response.choices[0]?.message?.content?.trim().toLowerCase() || 'neutral';
      return ['positive', 'neutral', 'negative', 'spam'].includes(sentiment) ? sentiment : 'neutral';
    } catch (error) {
      console.error('❌ [ENGAGEMENT] Error analyzing sentiment:', error);
      return 'neutral';
    }
  }

  private async detectSpam(text: string, blockKeywords: string[]): Promise<boolean> {
    const lowerText = text.toLowerCase();
    return blockKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private calculatePriority(sentiment: string, followers: number): string {
    if (sentiment === 'spam') return 'low';
    if (sentiment === 'negative') return 'high';
    if (followers > 10000) return 'high';
    if (followers > 1000) return 'normal';
    return 'low';
  }

  private async generateAIResponse(
    mentionId: string,
    tweetText: string,
    authorUsername: string,
    settings: any
  ): Promise<void> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return;
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content: `You are THE ORACLE, the AI assistant for RiddleSwap - a multi-chain DeFi platform with NFT gaming. Generate a friendly, helpful reply to this tweet. Keep it under 280 characters. Be professional but casual. If they're asking a question, answer it helpfully. If they're giving positive feedback, thank them. Mention relevant features of RiddleSwap if appropriate (multi-chain swaps, NFT marketplace, The Trolls Inquisition game).`,
          },
          {
            role: 'user',
            content: `Tweet from @${authorUsername}: "${tweetText}"`,
          },
        ],
        temperature: 0.8,
        max_tokens: 100,
      });

      const aiResponse = response.choices[0]?.message?.content || '';

      await db.update(twitterMentions)
        .set({ 
          ai_response_generated: true,
          ai_response_text: aiResponse,
          ai_response_approved: !settings.auto_reply_requires_approval,
         } as any)
        .where(eq(twitterMentions.id, mentionId));

      console.log(`🤖 [ENGAGEMENT] Generated AI response for mention ${mentionId}`);

      if (!settings.auto_reply_requires_approval) {
        await this.sendReply(mentionId, aiResponse, settings);
      }
    } catch (error) {
      console.error('❌ [ENGAGEMENT] Error generating AI response:', error);
    }
  }

  private async sendReply(mentionId: string, replyText: string, settings: any): Promise<void> {
    try {
      const mention = await db.query.twitterMentions.findFirst({
        where: eq(twitterMentions.id, mentionId),
      });

      if (!mention || !this.twitterClient) {
        return;
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentReplies = await db.query.twitterEngagementActions.findMany({
        where: and(
          eq(twitterEngagementActions.action_type, 'reply'),
          gte(twitterEngagementActions.action_performed_at, hourAgo)
        ),
      });

      if (recentReplies.length >= settings.auto_reply_max_per_hour) {
        console.log('⚠️ [ENGAGEMENT] Reply rate limit reached');
        return;
      }

      const tweet = await this.twitterClient.v2.reply(replyText, mention.tweet_id);

      await db.insert(twitterEngagementActions).values({
        id: crypto.randomUUID(),
        action_type: 'reply',
        target_tweet_id: mention.tweet_id,
        target_author: mention.author_username,
        status: 'success',
        reply_text: replyText,
        reply_tweet_id: tweet.data.id,
        automated: true,
        triggered_by_mention_id: mentionId,
        ai_generated: true,
        ai_model_used: 'gpt-5',
        action_performed_at: new Date(),
      } as any);

      await db.update(twitterMentions)
        .set({ 
          replied: true,
          reply_tweet_id: tweet.data.id,
          engagement_status: 'responded',
          engaged_at: new Date(),
         } as any)
        .where(eq(twitterMentions.id, mentionId));

      console.log(`✅ [ENGAGEMENT] Replied to @${mention.author_username}`);
    } catch (error: any) {
      console.error('❌ [ENGAGEMENT] Error sending reply:', error.message);

      await db.insert(twitterEngagementActions).values({
        id: crypto.randomUUID(),
        action_type: 'reply',
        target_tweet_id: '',
        target_author: '',
        status: 'failed',
        error_message: error.message,
        automated: true,
        triggered_by_mention_id: mentionId,
      } as any);
    }
  }

  private async autoLike(
    mentionId: string,
    tweetId: string,
    author: any,
    sentiment: string,
    settings: any
  ): Promise<void> {
    try {
      if (!this.twitterClient) return;

      if (settings.auto_like_positive_only && sentiment !== 'positive') {
        return;
      }

      if (author.public_metrics?.followers_count < settings.auto_like_min_followers) {
        return;
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentLikes = await db.query.twitterEngagementActions.findMany({
        where: and(
          eq(twitterEngagementActions.action_type, 'like'),
          gte(twitterEngagementActions.action_performed_at, hourAgo)
        ),
      });

      if (recentLikes.length >= settings.auto_like_max_per_hour) {
        return;
      }

      await this.twitterClient.v2.like('me', tweetId);

      await db.insert(twitterEngagementActions).values({
        id: crypto.randomUUID(),
        action_type: 'like',
        target_tweet_id: tweetId,
        target_author: author.username,
        status: 'success',
        automated: true,
        triggered_by_mention_id: mentionId,
        action_performed_at: new Date(),
      } as any);

      await db.update(twitterMentions)
        .set({  liked: true, engaged_at: new Date()  } as any)
        .where(eq(twitterMentions.id, mentionId));

      console.log(`❤️ [ENGAGEMENT] Liked tweet from @${author.username}`);
    } catch (error: any) {
      console.error('❌ [ENGAGEMENT] Error liking tweet:', error.message);
    }
  }

  private async autoRetweet(
    mentionId: string,
    tweetId: string,
    author: any,
    sentiment: string,
    settings: any
  ): Promise<void> {
    try {
      if (!this.twitterClient) return;

      if (settings.auto_retweet_positive_only && sentiment !== 'positive') {
        return;
      }

      if (author.public_metrics?.followers_count < settings.auto_retweet_min_followers) {
        return;
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentRetweets = await db.query.twitterEngagementActions.findMany({
        where: and(
          eq(twitterEngagementActions.action_type, 'retweet'),
          gte(twitterEngagementActions.action_performed_at, hourAgo)
        ),
      });

      if (recentRetweets.length >= settings.auto_retweet_max_per_hour) {
        return;
      }

      await this.twitterClient.v2.retweet('me', tweetId);

      await db.insert(twitterEngagementActions).values({
        id: crypto.randomUUID(),
        action_type: 'retweet',
        target_tweet_id: tweetId,
        target_author: author.username,
        status: 'success',
        automated: true,
        triggered_by_mention_id: mentionId,
        action_performed_at: new Date(),
      } as any);

      await db.update(twitterMentions)
        .set({  retweeted: true, engaged_at: new Date()  } as any)
        .where(eq(twitterMentions.id, mentionId));

      console.log(`🔄 [ENGAGEMENT] Retweeted from @${author.username}`);
    } catch (error: any) {
      console.error('❌ [ENGAGEMENT] Error retweeting:', error.message);
    }
  }

  async getMentions(limit: number = 50) {
    return await db.query.twitterMentions.findMany({
      orderBy: desc(twitterMentions.detected_at),
      limit,
    });
  }

  async getSettings() {
    return await db.query.twitterEngagementSettings.findFirst({
      where: eq(twitterEngagementSettings.id, 1),
    });
  }

  async updateSettings(settings: Partial<any>) {
    return await db.update(twitterEngagementSettings)
      .set(settings)
      .where(eq(twitterEngagementSettings.id, 1))
      .returning();
  }

  async approveReply(mentionId: string): Promise<void> {
    const mention = await db.query.twitterMentions.findFirst({
      where: eq(twitterMentions.id, mentionId),
    });

    if (!mention || !mention.ai_response_text) {
      throw new Error('Mention not found or no AI response generated');
    }

    const settings = await this.getSettings();
    if (!settings) {
      throw new Error('Settings not found');
    }

    await db.update(twitterMentions)
      .set({  ai_response_approved: true  } as any)
      .where(eq(twitterMentions.id, mentionId));

    await this.sendReply(mentionId, mention.ai_response_text, settings);
  }

  async getActions(limit: number = 50) {
    return await db.query.twitterEngagementActions.findMany({
      orderBy: desc(twitterEngagementActions.created_at),
      limit,
    });
  }
}

export const twitterEngagementService = new TwitterEngagementService();
