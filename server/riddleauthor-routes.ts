import { Router } from 'express';
import { z } from 'zod';
import { TheOracleAIService } from './riddleauthor-ai-service';
import { sessionAuth } from './middleware/session-auth';
import { db } from './db';
import { 
  riddleAuthorConversations, 
  riddleAuthorMessages, 
  riddleAuthorStories,
  riddleAuthorTweets,
  riddleAuthorNftBooks,
  riddleAuthorKnowledgeBase,
  riddleAuthorPersonality,
  type InsertRiddleAuthorConversation,
  type InsertRiddleAuthorMessage,
  type InsertRiddleAuthorStory,
  type InsertRiddleAuthorTweet,
  type InsertRiddleAuthorNftBook,
} from '../shared/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { generateRTN } from './utils/rtn-generator';

// Initialize THE ORACLE AI service
const theOracle = new TheOracleAIService();

// Validation schemas
const conversationSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.object({
    userHandle: z.string().optional(),
    walletAddress: z.string().optional(),
    gameContext: z.string().optional(),
    nftCollection: z.string().optional(),
    tradingContext: z.string().optional()
  }).optional()
});

const storyGenerationSchema = z.object({
  storyType: z.enum(['adventure', 'collection', 'trading', 'bridge', 'mystery', 'legend']),
  context: z.object({
    userHandle: z.string().optional(),
    collection: z.string().optional(),
    gameElement: z.string().optional(),
    length: z.enum(['short', 'medium', 'long']).default('medium')
  }).optional()
});

const tweetGenerationSchema = z.object({
  type: z.enum(['nft_drop', 'achievement', 'community', 'trading', 'story']),
  content: z.string().max(280),
  context: z.object({
    userHandle: z.string().optional(),
    eventData: z.record(z.any()).optional(),
    mediaUrls: z.array(z.string()).optional()
  }).optional()
});

const tweetRecommendationSchema = z.object({
  content: z.string().min(1).max(500),
  category: z.enum(['general', 'nft', 'gaming', 'trading', 'community']).default('general'),
  priority: z.number().min(1).max(5).default(1)
});


const router = Router();

/**
 * GET /api/riddleauthor/conversation
 * Get latest conversation with messages for current user
 */
router.get('/conversation', async (req, res) => {
  try {
    const handle = req.session?.handle || 'anonymous';
    
    // Get the latest conversation for this user
    const latestConversation = await db
      .select()
      .from(riddleAuthorConversations)
      .where(eq(riddleAuthorConversations.user_handle, handle))
      .orderBy(desc(riddleAuthorConversations.created_at))
      .limit(1);
    
    if (latestConversation.length === 0) {
      return res.json({
        success: true,
        id: null,
        messages: [],
        status: 'new',
        message_count: 0
      });
    }
    
    const conversation = latestConversation[0];
    
    // Get messages for this conversation
    const messages = await db
      .select()
      .from(riddleAuthorMessages)
      .where(eq(riddleAuthorMessages.conversation_id, conversation.id))
      .orderBy(riddleAuthorMessages.created_at);
    
    console.log(`🤖 [RiddleAuthor API] Retrieved conversation with ${messages.length} messages for ${handle}`);
    
    res.json({
      success: true,
      id: conversation.id,
      messages: messages.map(m => ({
        id: m.id,
        message_role: m.message_role,
        content: m.message_content,
        created_at: m.created_at,
        ai_confidence: m.ai_confidence
      })),
      status: conversation.status || 'active',
      message_count: messages.length
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve conversation"
    });
  }
});

/**
 * GET /api/riddleauthor/conversations
 * Get conversation history for user
 */
router.get('/conversations', async (req, res) => {
  try {
    const handle = req.session?.handle || 'system';
    const { limit = 10, offset = 0 } = req.query;
    
    const conversations = await theOracle.getConversationHistory(
      handle, 
      undefined, 
      Number(limit)
    );
    
    console.log(`🤖 [RiddleAuthor API] Retrieved ${conversations.length} conversations for ${handle}`);
    
    res.json({
      success: true,
      conversations,
      total: conversations.length
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve conversations"
    });
  }
});

/**
 * POST /api/riddleauthor/chat
 * Send message to RiddleAuthor AI
 */
router.post('/chat', async (req, res) => {
  try {
    const validation = conversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid conversation data",
        details: validation.error.errors
      });
    }

    const handle = req.session?.handle || 'system';
    const { message, context } = validation.data;
    
    console.log(`🤖 [RiddleAuthor API] Processing chat message from ${handle}`);
    
    // Generate unique session ID for anonymous users to prevent collision
    const sessionId = req.session?.id || `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create or get conversation
    const conversationId = await theOracle.startConversation({
      userHandle: handle,
      sessionId: sessionId,
      conversationType: 'chat',
      gameMode: 'normal',
      ...context
    });
    
    // Process the message and get AI response
    const response = await theOracle.processMessage(
      conversationId, 
      message, 
      context
    );
    
    console.log(`🤖 [RiddleAuthor API] Generated AI response for ${handle}: ${response.content.substring(0, 100)}...`);
    
    res.json({
      success: true,
      conversation_id: conversationId,
      response: response
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to process chat:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process message"
    });
  }
});

/**
 * POST /api/riddleauthor/welcome
 * Generate personalized welcome message
 */
router.post('/welcome', async (req, res) => {
  try {
    const handle = req.session?.handle || 'system';
    // Generate unique session ID for anonymous users to prevent collision
    const sessionId = req.session?.id || `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🤖 [RiddleAuthor API] Generating welcome message for ${handle}`);
    
    const conversationId = await theOracle.startConversation({ 
      sessionId: sessionId,
      userHandle: handle,
      conversationType: 'welcome'
    });
    
    // Generate actual welcome message content
    const welcomeResponse = await theOracle.processMessage(
      conversationId,
      "Hello! Welcome to THE ORACLE. Please introduce yourself and tell me about your role.",
      { conversationType: 'welcome' }
    );
    
    res.json({
      success: true,
      conversation_id: conversationId,
      welcome_message: welcomeResponse.content
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to generate welcome:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate welcome message"
    });
  }
});

/**
 * POST /api/riddleauthor/story
 * Generate story content
 */
router.post('/story', async (req, res) => {
  try {
    const validation = storyGenerationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid story generation data",
        details: validation.error.errors
      });
    }

    const handle = req.session?.handle || 'system';
    const { storyType, context } = validation.data;
    
    console.log(`🤖 [RiddleAuthor API] Generating ${storyType} story for ${handle}`);
    
    const story = await theOracle.generateStory(storyType, {
      userHandle: handle,
      ...context
    });
    
    res.json({
      success: true,
      story: story
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to generate story:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate story"
    });
  }
});


/**
 * POST /api/riddleauthor/tweet
 * Generate and queue tweet (Twitter integration)
 */
router.post('/tweet', async (req, res) => {
  try {
    // Security: Require internal authorization for tweet creation
    const authToken = req.headers['x-internal-token'];
    if (!authToken || authToken !== process.env.INTERNAL_TWEET_TOKEN) {
      console.log(`🔒 [SECURITY] Unauthorized tweet creation attempt from ${req.ip}`);
      return res.status(403).json({
        success: false,
        error: "Unauthorized - internal access only"
      });
    }

    const validation = tweetGenerationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid tweet data",
        details: validation.error.errors
      });
    }

    const handle = req.session?.handle || 'system';
    const { type, content, context } = validation.data;
    
    console.log(`🐦 [RiddleAuthor API] Generating tweet for ${handle}: ${type}`);
    
    // Create tweet record that requires review
    const tweet: InsertRiddleAuthorTweet = {
      tweet_type: type,
      content: content,
      author_handle: handle,
      context: context || {},
      status: 'pending_review', // Requires manual approval
      scheduled_for: new Date()
    };
    
    const [newTweet] = await db.insert(riddleAuthorTweets).values(tweet as any).returning();
    
    console.log(`🐦 [RiddleAuthor API] Queued tweet for review: ${newTweet.id}`);
    
    res.json({
      success: true,
      tweet: newTweet,
      message: "Tweet queued for manual review before posting"
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to create tweet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create tweet"
    });
  }
});

/**
 * GET /api/riddleauthor/tweets
 * Get recent tweets from THE ORACLE (alias for /tweets/recent)
 */
router.get('/tweets', sessionAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    // Get recent tweets from database
    const dbTweets = await db
      .select()
      .from(riddleAuthorTweets)
      .orderBy(desc(riddleAuthorTweets.created_at))
      .limit(Number(limit));
    
    res.json(dbTweets);
  } catch (error) {
    console.error('❌ [RIDDLEAUTHOR API] Failed to fetch tweets:', error);
    res.status(500).json([]);
  }
});

/**
 * GET /api/riddleauthor/tweets/recent
 * Get recent tweets from THE ORACLE (both database + live from Twitter)
 */
router.get('/tweets/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get recent tweets from database
    const dbTweets = await db
      .select()
      .from(riddleAuthorTweets)
      .orderBy(desc(riddleAuthorTweets.created_at))
      .limit(Number(limit));
    
    // Try to fetch live tweets from Twitter API
    let liveTweets: any[] = [];
    try {
      const { TwitterApi } = await import('twitter-api-v2');
      
      if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET && 
          process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_ACCESS_TOKEN_SECRET) {
        
        const twitterClient = new TwitterApi({
          appKey: process.env.TWITTER_API_KEY,
          appSecret: process.env.TWITTER_API_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });
        
        const timeline = await twitterClient.v2.userTimeline('me', {
          max_results: Number(limit),
          'tweet.fields': ['created_at', 'public_metrics', 'entities']
        });
        
        liveTweets = timeline.data.data.map((tweet: any) => ({
          id: tweet.id,
          content: tweet.text,
          created_at: tweet.created_at,
          tweet_url: `https://twitter.com/i/web/status/${tweet.id}`,
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          source: 'twitter_api'
        }));
        
        console.log(`🐦 [RiddleAuthor API] Retrieved ${liveTweets.length} live tweets from Twitter`);
      }
    } catch (twitterError) {
      console.warn("🐦 [RiddleAuthor API] Could not fetch live tweets:", twitterError);
    }
    
    console.log(`🐦 [RiddleAuthor API] Retrieved ${dbTweets.length} database tweets`);
    
    res.json({
      success: true,
      tweets: dbTweets.map(tweet => ({
        id: tweet.id,
        content: tweet.content,
        tweet_type: tweet.tweet_type,
        created_at: tweet.created_at,
        status: tweet.status,
        tweet_url: tweet.platform_tweet_id ? `https://twitter.com/i/web/status/${tweet.platform_tweet_id}` : null,
        source: 'database'
      })),
      liveTweets,
      total: dbTweets.length + liveTweets.length
    });
  } catch (error) {
    console.error("🐦 [RiddleAuthor API] Failed to get recent tweets:", error);
    res.status(500).json({
      success: true,
      tweets: [],
      liveTweets: [],
      total: 0
    });
  }
});

/**
 * POST /api/riddleauthor/tweet-recommendations
 * Submit user recommendation for automated tweets
 */
router.post('/tweet-recommendations', async (req, res) => {
  try {
    const validation = tweetRecommendationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid recommendation data",
        details: validation.error.errors
      });
    }

    const handle = req.session?.handle || 'system';
    const { content, category, priority } = validation.data;
    
    console.log(`💡 [RiddleAuthor API] Tweet recommendation from ${handle}: ${category}`);
    
    // For now, store in riddleAuthorTweets with special status for recommendations
    const recommendation: InsertRiddleAuthorTweet = {
      tweet_type: 'user_recommendation',
      content: content,
      initiated_by_user: handle,
      user_input: content,
      status: 'pending_review',
      game_context: category,
      generation_prompt: `User recommendation from ${handle}: ${content}`
    };
    
    const [newRec] = await db.insert(riddleAuthorTweets).values(recommendation as any).returning();
    
    console.log(`💡 [RiddleAuthor API] Stored recommendation: ${newRec.id}`);
    
    res.json({
      success: true,
      recommendation: {
        id: newRec.id,
        content: newRec.content,
        category: category,
        priority: priority,
        status: 'submitted'
      }
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to store recommendation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to store recommendation"
    });
  }
});

/**
 * GET /api/riddleauthor/tweet-recommendations
 * Get user's tweet recommendations
 */
router.get('/tweet-recommendations', async (req, res) => {
  try {
    const handle = 'system'; // No auth required - works in background
    const { limit = 20 } = req.query;
    
    const recommendations = await db
      .select()
      .from(riddleAuthorTweets)
      .where(
        and(
          eq(riddleAuthorTweets.tweet_type, 'user_recommendation'),
          eq(riddleAuthorTweets.initiated_by_user, handle)
        )
      )
      .orderBy(desc(riddleAuthorTweets.created_at))
      .limit(Number(limit));
    
    console.log(`💡 [RiddleAuthor API] Retrieved ${recommendations.length} recommendations for ${handle}`);
    
    res.json({
      success: true,
      recommendations: recommendations.map(rec => ({
        id: rec.id,
        content: rec.content,
        category: rec.game_context || 'general',
        status: rec.status,
        created_at: rec.created_at,
        used_in_tweet: rec.platform_tweet_id ? true : false
      }))
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve recommendations"
    });
  }
});

/**
 * GET /api/riddleauthor/personality
 * Get current AI personality settings
 */
router.get('/personality', async (req, res) => {
  try {
    const personality = await db
      .select()
      .from(riddleAuthorPersonality)
      .where(eq(riddleAuthorPersonality.is_active, true))
      .limit(1);
    
    const currentPersonality = personality[0] || null;
    
    res.json({
      success: true,
      personality: currentPersonality
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get personality:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve personality"
    });
  }
});

/**
 * GET /api/riddleauthor/stories
 * Get generated stories
 */
router.get('/stories', async (req, res) => {
  try {
    const handle = 'system'; // No auth required - works in background
    const { limit = 10, story_type } = req.query;
    
    let queryBuilder = db
      .select()
      .from(riddleAuthorStories)
      .where(eq(riddleAuthorStories.author_handle, handle));
    
    if (story_type) {
      queryBuilder = queryBuilder.where(
        and(
          eq(riddleAuthorStories.author_handle, handle),
          eq(riddleAuthorStories.story_type, story_type as string)
        )
      );
    }
    
    const stories = await queryBuilder
      .orderBy(desc(riddleAuthorStories.created_at))
      .limit(Number(limit));
    
    console.log(`📚 [RiddleAuthor API] Retrieved ${stories.length} stories for ${handle}`);
    
    res.json({
      success: true,
      stories,
      total: stories.length
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get stories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve stories"
    });
  }
});

/**
 * GET /api/riddleauthor/nft-books
 * Get available NFT books
 */
router.get('/nft-books', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    
    const books = await db
      .select()
      .from(riddleAuthorNftBooks)
      .orderBy(desc(riddleAuthorNftBooks.created_at))
      .limit(Number(limit));
    
    console.log(`📖 [RiddleAuthor API] Retrieved ${books.length} NFT books`);
    
    res.json({
      success: true,
      books,
      total: books.length
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get NFT books:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve NFT books"
    });
  }
});

/**
 * POST /api/riddleauthor/stories/create
 * Create a new story or chapter
 */
router.post('/stories/create', async (req, res) => {
  try {
    const handle = req.session?.handle || 'anonymous';
    const { title, content, storyType, nftBookId } = req.body;
    
    const newStory: InsertRiddleAuthorStory = {
      title,
      content,
      story_type: storyType || 'user_adventure',
      author_handle: handle,
      generation_prompt: `User-created story: ${title}`,
      belongs_to_nft_book: nftBookId || null,
      is_published: false,
      word_count: content.split(' ').length
    };
    
    const [story] = await db.insert(riddleAuthorStories).values(newStory as any).returning();
    
    console.log(`📚 [RiddleAuthor API] Created story: ${story.id} by ${handle}`);
    
    res.json({
      success: true,
      story
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to create story:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create story"
    });
  }
});

/**
 * PUT /api/riddleauthor/stories/:id
 * Update existing story
 */
router.put('/stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    
    const [updatedStory] = await db
      .update(riddleAuthorStories)
      .set({ 
        title,
        content,
        word_count: content.split(' ').length,
        updated_at: new Date()
       } as any)
      .where(eq(riddleAuthorStories.id, id))
      .returning();
    
    console.log(`📝 [RiddleAuthor API] Updated story: ${id}`);
    
    res.json({
      success: true,
      story: updatedStory
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to update story:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update story"
    });
  }
});

/**
 * POST /api/riddleauthor/books/create
 * Create a new NFT book project
 */
router.post('/books/create', async (req, res) => {
  try {
    const handle = req.session?.handle || 'anonymous';
    const { title, subtitle, description, bookType } = req.body;
    
    const currentDate = new Date();
    const newBook: InsertRiddleAuthorNftBook = {
      title,
      subtitle,
      description,
      book_month: currentDate,
      book_year: currentDate.getFullYear(),
      author_handle: handle,
      book_type: bookType || 'anthology',
      status: 'draft'
    };
    
    const [book] = await db.insert(riddleAuthorNftBooks).values(newBook as any).returning();
    
    console.log(`📖 [RiddleAuthor API] Created NFT book: ${book.id} by ${handle}`);
    
    res.json({
      success: true,
      book
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to create book:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create book"
    });
  }
});

/**
 * GET /api/riddleauthor/books/:id/stories
 * Get all stories/chapters for a book
 */
router.get('/books/:id/stories', async (req, res) => {
  try {
    const { id } = req.params;
    
    const stories = await db
      .select()
      .from(riddleAuthorStories)
      .where(eq(riddleAuthorStories.belongs_to_nft_book, id))
      .orderBy(riddleAuthorStories.created_at);
    
    console.log(`📚 [RiddleAuthor API] Retrieved ${stories.length} stories for book ${id}`);
    
    res.json({
      success: true,
      stories
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get book stories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve book stories"
    });
  }
});

/**
 * POST /api/riddleauthor/books/:id/mint
 * Mint completed book as NFT on XRPL
 */
router.post('/books/:id/mint', async (req, res) => {
  try {
    const { id } = req.params;
    const handle = req.session?.handle || 'anonymous';
    
    // Get book and its stories
    const [book] = await db
      .select()
      .from(riddleAuthorNftBooks)
      .where(eq(riddleAuthorNftBooks.id, id))
      .limit(1);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        error: "Book not found"
      });
    }
    
    const stories = await db
      .select()
      .from(riddleAuthorStories)
      .where(eq(riddleAuthorStories.belongs_to_nft_book, id));
    
    // Calculate total words
    const totalWords = stories.reduce((sum, story) => sum + (story.word_count || 0), 0);
    
    // Update book with final stats
    await db
      .update(riddleAuthorNftBooks)
      .set({ 
        total_chapters: stories.length,
        total_words: totalWords,
        status: 'ready_for_mint',
        updated_at: new Date()
       } as any)
      .where(eq(riddleAuthorNftBooks.id, id));
    
    console.log(`🎨 [RiddleAuthor API] Book ${id} prepared for NFT minting: ${stories.length} chapters, ${totalWords} words`);
    
    res.json({
      success: true,
      message: "Book prepared for NFT minting",
      stats: {
        chapters: stories.length,
        words: totalWords,
        title: book.title
      }
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to prepare book for minting:", error);
    res.status(500).json({
      success: false,
      error: "Failed to prepare book for minting"
    });
  }
});

/**
 * GET /api/riddleauthor/knowledge
 * Get knowledge base entries
 */
router.get('/knowledge', async (req, res) => {
  try {
    const { topic, limit = 20 } = req.query;
    
    let queryBuilder = db
      .select()
      .from(riddleAuthorKnowledgeBase)
      .where(eq(riddleAuthorKnowledgeBase.status, 'active'));
    
    if (topic) {
      queryBuilder = queryBuilder.where(
        and(
          eq(riddleAuthorKnowledgeBase.status, 'active'),
          eq(riddleAuthorKnowledgeBase.topic, topic as string)
        )
      );
    }
    
    const knowledge = await queryBuilder
      .orderBy(desc(riddleAuthorKnowledgeBase.usage_count))
      .limit(Number(limit));
    
    console.log(`🧠 [RiddleAuthor API] Retrieved ${knowledge.length} knowledge entries`);
    
    res.json({
      success: true,
      knowledge,
      total: knowledge.length
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get knowledge:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve knowledge"
    });
  }
});

/**
 * GET /api/riddleauthor/status
 * Get RiddleAuthor system status
 */
router.get('/status', async (req, res) => {
  try {
    // Get basic system statistics
    const [conversationCount] = await db
      .select({ count: sql`count(*)` })
      .from(riddleAuthorConversations);
    
    const [messageCount] = await db
      .select({ count: sql`count(*)` })
      .from(riddleAuthorMessages);
    
    const [storyCount] = await db
      .select({ count: sql`count(*)` })
      .from(riddleAuthorStories);
    
    
    res.json({
      success: true,
      status: 'operational',
      statistics: {
        conversations: Number(conversationCount.count),
        messages: Number(messageCount.count),
        stories: Number(storyCount.count),
      },
      ai_model: 'gpt-5',
      features: {
        conversations: true,
        story_generation: true,
        nft_books: true,
        twitter_integration: true,
        personality_learning: true
      }
    });
  } catch (error) {
    console.error("🤖 [RiddleAuthor API] Failed to get status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve status"
    });
  }
});

/**
 * Twitter Engagement Routes - Admin Only
 */

/**
 * GET /api/riddleauthor/engagement/mentions
 * Get all Twitter mentions
 */
router.get('/engagement/mentions', sessionAuth, async (req, res) => {
  try {
    const { twitterEngagementService } = await import('./twitter-engagement-service');
    
    const { limit = 50 } = req.query;
    const mentions = await twitterEngagementService.getMentions(Number(limit));
    
    res.json({
      success: true,
      mentions,
      total: mentions.length
    });
  } catch (error) {
    console.error('❌ [ENGAGEMENT API] Failed to get mentions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve mentions'
    });
  }
});

/**
 * GET /api/riddleauthor/engagement/settings
 * Get engagement settings
 */
router.get('/engagement/settings', sessionAuth, async (req, res) => {
  try {
    const { twitterEngagementService } = await import('./twitter-engagement-service');
    
    const settings = await twitterEngagementService.getSettings();
    
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('❌ [ENGAGEMENT API] Failed to get settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
});

/**
 * POST /api/riddleauthor/engagement/settings
 * Update engagement settings
 */
router.post('/engagement/settings', sessionAuth, async (req, res) => {
  try {
    const { twitterEngagementService } = await import('./twitter-engagement-service');
    
    const updated = await twitterEngagementService.updateSettings(req.body);
    
    console.log('✅ [ENGAGEMENT API] Settings updated');
    
    res.json({
      success: true,
      settings: updated[0]
    });
  } catch (error) {
    console.error('❌ [ENGAGEMENT API] Failed to update settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

/**
 * POST /api/riddleauthor/engagement/scan
 * Manually trigger mention scan
 */
router.post('/engagement/scan', sessionAuth, async (req, res) => {
  try {
    const { twitterEngagementService } = await import('./twitter-engagement-service');
    
    // Run scan in background
    twitterEngagementService.scanMentions().catch(err => {
      console.error('❌ [ENGAGEMENT API] Background scan error:', err);
    });
    
    console.log('🔍 [ENGAGEMENT API] Mention scan triggered');
    
    res.json({
      success: true,
      message: 'Mention scan started'
    });
  } catch (error) {
    console.error('❌ [ENGAGEMENT API] Failed to trigger scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scan'
    });
  }
});

/**
 * POST /api/riddleauthor/engagement/approve/:mentionId
 * Approve and send AI-generated reply
 */
router.post('/engagement/approve/:mentionId', sessionAuth, async (req, res) => {
  try {
    const { twitterEngagementService } = await import('./twitter-engagement-service');
    const { mentionId } = req.params;
    
    await twitterEngagementService.approveReply(mentionId);
    
    console.log(`✅ [ENGAGEMENT API] Reply approved and sent for mention ${mentionId}`);
    
    res.json({
      success: true,
      message: 'Reply sent'
    });
  } catch (error: any) {
    console.error('❌ [ENGAGEMENT API] Failed to approve reply:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve reply'
    });
  }
});

/**
 * GET /api/riddleauthor/engagement/actions
 * Get engagement action history
 */
router.get('/engagement/actions', sessionAuth, async (req, res) => {
  try {
    const { twitterEngagementService } = await import('./twitter-engagement-service');
    
    const { limit = 50 } = req.query;
    const actions = await twitterEngagementService.getActions(Number(limit));
    
    res.json({
      success: true,
      actions,
      total: actions.length
    });
  } catch (error) {
    console.error('❌ [ENGAGEMENT API] Failed to get actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve actions'
    });
  }
});

/**
 * Swap Announcement Routes - Admin Only
 */

/**
 * GET /api/riddleauthor/swap-announcements
 * Get recent swap announcements
 */
router.get('/swap-announcements', sessionAuth, async (req, res) => {
  try {
    const { swapAnnouncementService } = await import('./swap-announcement-service');
    
    const { limit = 20 } = req.query;
    const announcements = await swapAnnouncementService.getRecentAnnouncements(Number(limit));
    
    res.json({
      success: true,
      announcements,
      total: announcements.length
    });
  } catch (error) {
    console.error('❌ [SWAP-ANNOUNCEMENTS API] Failed to get announcements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve announcements'
    });
  }
});

/**
 * GET /api/riddleauthor/swap-announcements/settings
 * Get swap announcement settings
 */
router.get('/swap-announcements/settings', sessionAuth, async (req, res) => {
  try {
    const { swapAnnouncementService } = await import('./swap-announcement-service');
    
    const settings = await swapAnnouncementService.getSettings();
    
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('❌ [SWAP-ANNOUNCEMENTS API] Failed to get settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
});

/**
 * POST /api/riddleauthor/swap-announcements/settings
 * Update swap announcement settings
 */
router.post('/swap-announcements/settings', sessionAuth, async (req, res) => {
  try {
    const { swapAnnouncementService } = await import('./swap-announcement-service');
    
    const updated = await swapAnnouncementService.updateSettings(req.body);
    
    console.log('✅ [SWAP-ANNOUNCEMENTS API] Settings updated');
    
    res.json({
      success: true,
      settings: updated[0]
    });
  } catch (error) {
    console.error('❌ [SWAP-ANNOUNCEMENTS API] Failed to update settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

/**
 * POST /api/riddleauthor/swap-announcements/test
 * Trigger test swap announcement
 */
router.post('/swap-announcements/test', sessionAuth, async (req, res) => {
  try {
    const { swapAnnouncementService } = await import('./swap-announcement-service');
    
    // Run test in background
    swapAnnouncementService.testAnnouncement().catch(err => {
      console.error('❌ [SWAP-ANNOUNCEMENTS API] Test error:', err);
    });
    
    console.log('🧪 [SWAP-ANNOUNCEMENTS API] Test announcement triggered');
    
    res.json({
      success: true,
      message: 'Test announcement initiated'
    });
  } catch (error) {
    console.error('❌ [SWAP-ANNOUNCEMENTS API] Failed to trigger test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger test'
    });
  }
});

/**
 * GET /api/riddleauthor/swap-monitor/status
 * Get swap monitor status
 */
router.get('/swap-monitor/status', sessionAuth, async (req, res) => {
  try {
    const { swapMonitor } = await import('./swap-monitor');
    
    const status = swapMonitor.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('❌ [SWAP-MONITOR API] Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve status'
    });
  }
});

/**
 * POST /api/riddleauthor/swap-monitor/start
 * Start swap monitoring
 */
router.post('/swap-monitor/start', sessionAuth, async (req, res) => {
  try {
    const { swapMonitor } = await import('./swap-monitor');
    
    // Start in background
    swapMonitor.start().catch(err => {
      console.error('❌ [SWAP-MONITOR API] Start error:', err);
    });
    
    console.log('🚀 [SWAP-MONITOR API] Monitor start initiated');
    
    res.json({
      success: true,
      message: 'Monitor starting...'
    });
  } catch (error) {
    console.error('❌ [SWAP-MONITOR API] Failed to start monitor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start monitor'
    });
  }
});

/**
 * POST /api/riddleauthor/swap-monitor/stop
 * Stop swap monitoring
 */
router.post('/swap-monitor/stop', sessionAuth, async (req, res) => {
  try {
    const { swapMonitor } = await import('./swap-monitor');
    
    await swapMonitor.stop();
    
    console.log('🛑 [SWAP-MONITOR API] Monitor stopped');
    
    res.json({
      success: true,
      message: 'Monitor stopped'
    });
  } catch (error) {
    console.error('❌ [SWAP-MONITOR API] Failed to stop monitor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop monitor'
    });
  }
});

export default router;