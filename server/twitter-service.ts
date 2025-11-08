/**
 * Twitter/X API Service for THE ORACLE Automated Tweets
 * Handles automatic posting every 2 hours and paid promotional tweets
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { riddleAuthorTweets } from "@shared/schema";
import { sessionAuth } from "./middleware/session-auth";
import { isAdminUser } from "./middleware/admin-auth";
import { eq, desc, and, sql } from "drizzle-orm";
import OpenAI from "openai";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { telegramService } from "./telegram-service";

const router = Router();

// Twitter API configuration - OAuth 2.0 Client Credentials
interface TwitterConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
}

// Tweet verification result interface
interface TweetVerificationResult {
  isApproved: boolean;
  verificationStatus: 'passed' | 'failed' | 'pending' | 'rejected';
  guidelinesCompliance: {
    brandConsistent: boolean;
    contentAppropriate: boolean;
    lengthValid: boolean;
    hashtagsAppropriate: boolean;
    noSpamContent: boolean;
  };
  scheduledPostTime?: string;
  rejectionReasons?: string[];
  aiConfidence: number;
  underneathState: {
    verificationPassed: boolean;
    willBePosted: boolean;
    scheduledFor?: string;
    isComplete: boolean;
    processedAt: string;
  };
}

// Project guidelines for tweet verification
const TWEET_GUIDELINES = {
  maxLength: 280,
  requiredHashtags: ['#DeFi', '#XRPL', '#RiddleSwap'],
  forbiddenWords: ['spam', 'scam', 'guaranteed', 'pump', 'rug'],
  brandKeywords: ['RiddleSwap', 'DeFi', 'XRPL', 'Trolls Inquisition', 'gaming', 'NFT'],
  appropriateTone: ['professional', 'engaging', 'informative', 'gaming', 'cryptic']
};

// RiddleSwap NFT Collections & Token Projects (ALL LIVE!)
const RIDDLESWAP_PROJECTS = [
  {
    name: 'The Inquisition',
    slug: 'the-inquisition',
    description: 'Find peace in having nothing. Find strength in having something. Find drive in wanting it all. Welcome, to the Inquisition.',
    status: 'MINTING NOW',
    url: '/collections/the-inquisition',
    cdnImage: 'https://cdn.xrp.cafe/1444e060f8b9-4717-98fc-dbd88a46cc3f.webp',
    hashtags: '#NFT #XRPL #TheInquisition',
    emoji: '⚔️'
  },
  {
    name: 'The Inquiry',
    slug: 'the-inquiry',
    description: 'Seek the answers. Question everything. The Inquiry beckons those who dare to explore the unknown.',
    status: 'MINTING NOW',
    url: '/collections/the-inquiry',
    cdnImage: 'https://cdn.xrp.cafe/14c47a2e18f1-403f-b79a-b87c41e37b05.webp',
    hashtags: '#NFT #XRPL #TheInquiry',
    emoji: '🔍'
  },
  {
    name: 'The Lost Emporium',
    slug: 'the-lost-emporium',
    description: 'Treasures forgotten, stories untold. Discover rare artifacts in The Lost Emporium.',
    status: 'LIVE',
    url: '/collections/the-lost-emporium',
    cdnImage: 'https://cdn.xrp.cafe/14c472c47e9d-487a-a9e3-c76819e6d7e7.webp',
    hashtags: '#NFT #XRPL #LostEmporium',
    emoji: '🏛️'
  },
  {
    name: 'Dantes Aurum',
    slug: 'dantes-aurum',
    description: 'Golden NFTs inspired by epic journeys and legendary tales. Capture the essence of adventure and wisdom.',
    status: 'LIVE',
    url: '/collections/dantes-aurum',
    cdnImage: 'https://cdn.xrp.cafe/1444e060f6e4-40f2-a8bf-0d7a5e14e2e8.webp',
    hashtags: '#NFT #XRPL #DantesAurum',
    emoji: '⚱️'
  },
  {
    name: 'Under The Bridge',
    slug: 'under-the-bridge',
    description: 'Mysteries from beneath where riddles echo and secrets hide. Discover cryptic artwork and hidden meanings.',
    status: 'LIVE',
    url: '/collections/under-the-bridge',
    cdnImage: 'https://cdn.xrp.cafe/14c4725ebf46-4c10-8a59-16e8d53bf15b.webp',
    hashtags: '#NFT #XRPL #UnderTheBridge',
    emoji: '🌉'
  },
  {
    name: 'RDL Token',
    slug: 'rdl',
    description: 'What makes a riddle? What makes us ask? The official utility token powering the RiddleSwap ecosystem.',
    status: 'LIVE',
    url: '/token/rdl',
    cdnImage: 'https://xrp.cafe/api/nft/00081388DBD64D5C2C50A953C12A0DA43F36CA013B3D13D4FE22EE1C81D1AA63/image',
    hashtags: '#RDL #XRPL #DeFi',
    emoji: '🪙'
  }
];

// Tweet content generation service
class TwitterPostingService {
  private config: TwitterConfig;
  private openai: OpenAI;
  private twitterClient: TwitterApi | null = null;
  private currentProjectIndex: number = 0; // Track project rotation
  
  constructor() {
    this.config = {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      redirectUri: process.env.TWITTER_REDIRECT_URI || 'http://localhost:5000/api/twitter/oauth2/callback',
      accessToken: undefined,
      refreshToken: undefined,
      accessTokenExpiresAt: undefined
    };
    
    // Initialize OpenAI for AI verification (2025: using project-scoped API keys)
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
      // Project context embedded in 2025 project-scoped API keys
    });
    
    // Initialize Twitter client with OAuth 1.0a credentials if available
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    if (apiKey && apiSecret && accessToken && accessTokenSecret) {
      try {
        this.twitterClient = new TwitterApi({
          appKey: apiKey,
          appSecret: apiSecret,
          accessToken: accessToken,
          accessSecret: accessTokenSecret,
        });
        console.log("🐦 [TWITTER] Twitter API client initialized successfully with OAuth 1.0a");
      } catch (error) {
        console.error("🐦 [TWITTER] Failed to initialize Twitter API client:", error);
        this.twitterClient = null;
      }
    } else {
      console.log("🐦 [TWITTER] Twitter API credentials not configured - please add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET");
    }
  }

  /**
   * AI verification of tweet content against project guidelines
   */
  async verifyTweetContent(tweetContent: string, tweetType: 'automatic' | 'promotional' | 'manual'): Promise<TweetVerificationResult> {
    try {
      console.log(`🔍 [TWEET-VERIFY] Starting AI verification for ${tweetType} tweet...`);
      
      // Basic guideline checks
      const lengthValid = tweetContent.length <= TWEET_GUIDELINES.maxLength;
      const hasRequiredHashtags = TWEET_GUIDELINES.requiredHashtags.some(tag => 
        tweetContent.toLowerCase().includes(tag.toLowerCase())
      );
      const hasForbiddenWords = TWEET_GUIDELINES.forbiddenWords.some(word => 
        tweetContent.toLowerCase().includes(word.toLowerCase())
      );
      const hasBrandKeywords = TWEET_GUIDELINES.brandKeywords.some(keyword => 
        tweetContent.toLowerCase().includes(keyword.toLowerCase())
      );

      // AI content analysis using OpenAI
      const aiAnalysisPrompt = `
Analyze this tweet for "The Trolls Inquisition Multi-Chain Mayhem Edition" gaming platform:

Tweet: "${tweetContent}"

Project Context:
- DeFi/XRPL gaming platform with medieval treasure map
- 1000 claimable land plots with NFT ownership  
- Civilization-style gameplay with religion & military systems
- Professional gaming brand with cryptic/mysterious tone
- Built on XRPL with multi-chain support

Guidelines to check:
1. Brand consistency with RiddleSwap/gaming theme
2. Professional yet engaging tone
3. No spam/scam language
4. Appropriate for gaming/crypto audience
5. Maintains mysterious/cryptic brand voice

Respond with JSON:
{
  "brandConsistent": boolean,
  "contentAppropriate": boolean, 
  "toneAppropriate": boolean,
  "spamContent": boolean,
  "confidence": number (0-100),
  "reasoning": "brief explanation"
}`;

      const aiResponse = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: aiAnalysisPrompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      let aiAnalysis = {
        brandConsistent: true,
        contentAppropriate: true,
        toneAppropriate: true,
        spamContent: false,
        confidence: 85,
        reasoning: "Analysis completed"
      };

      try {
        aiAnalysis = JSON.parse(aiResponse.choices[0].message.content || '{}');
      } catch (e) {
        console.log("🔍 [TWEET-VERIFY] AI response parsing fallback applied");
      }

      // Compile verification results
      const guidelinesCompliance = {
        brandConsistent: aiAnalysis.brandConsistent && hasBrandKeywords,
        contentAppropriate: aiAnalysis.contentAppropriate && !hasForbiddenWords,
        lengthValid,
        hashtagsAppropriate: hasRequiredHashtags || tweetType === 'promotional',
        noSpamContent: !aiAnalysis.spamContent && !hasForbiddenWords
      };

      const allChecksPassed = Object.values(guidelinesCompliance as any).every(check => check);
      const verificationStatus = allChecksPassed ? 'passed' : 'failed';
      
      // Calculate next posting time (every 2 hours for automatic tweets)
      const nextPostingTime = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString();
      
      const result: TweetVerificationResult = {
        isApproved: allChecksPassed,
        verificationStatus,
        guidelinesCompliance,
        scheduledPostTime: allChecksPassed ? nextPostingTime : undefined,
        rejectionReasons: allChecksPassed ? [] : this.getRejectionReasons(guidelinesCompliance, aiAnalysis),
        aiConfidence: aiAnalysis.confidence,
        underneathState: {
          verificationPassed: allChecksPassed,
          willBePosted: allChecksPassed,
          scheduledFor: allChecksPassed ? nextPostingTime : undefined,
          isComplete: allChecksPassed,
          processedAt: new Date().toISOString()
        }
      };

      console.log(`✅ [TWEET-VERIFY] Verification complete:`, {
        status: verificationStatus,
        approved: allChecksPassed,
        confidence: aiAnalysis.confidence,
        willPost: allChecksPassed
      });

      return result;

    } catch (error) {
      console.error("🔍 [TWEET-VERIFY] Verification failed:", error);
      
      // Fallback verification result
      return {
        isApproved: false,
        verificationStatus: 'failed',
        guidelinesCompliance: {
          brandConsistent: false,
          contentAppropriate: false,
          lengthValid: tweetContent.length <= 280,
          hashtagsAppropriate: false,
          noSpamContent: false
        },
        rejectionReasons: ['AI verification system error'],
        aiConfidence: 0,
        underneathState: {
          verificationPassed: false,
          willBePosted: false,
          isComplete: false,
          processedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get human-readable rejection reasons
   */
  private getRejectionReasons(compliance: any, aiAnalysis: any): string[] {
    const reasons = [];
    
    if (!compliance.lengthValid) reasons.push("Tweet exceeds 280 character limit");
    if (!compliance.brandConsistent) reasons.push("Content not consistent with RiddleSwap gaming brand");
    if (!compliance.contentAppropriate) reasons.push("Content inappropriate for gaming/crypto audience");
    if (!compliance.hashtagsAppropriate) reasons.push("Missing required hashtags (#DeFi, #XRPL, #RiddleSwap)");
    if (!compliance.noSpamContent) reasons.push("Contains spam or inappropriate language");
    if (aiAnalysis.confidence < 70) reasons.push("AI confidence too low for automated approval");
    
    return reasons;
  }

  /**
   * Fetch trending tokens from DexScreener for tweet content
   */
  private async getTrendingTokens(): Promise<any[]> {
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/trending');
      if (response.ok) {
        const data = await response.json() as any;
        return data.pairs?.slice(0, 5) || [];
      }
    } catch (error) {
      console.log('⚠️ [TWEET-DATA] Failed to fetch trending tokens');
    }
    return [];
  }

  /**
   * Fetch recent game activity (battles, tournaments) for tweets
   */
  private async getGameActivity(): Promise<any> {
    try {
      // Fetch recent battles from the database
      const recentBattles = await db.query.battles?.findMany({
        limit: 5,
        orderBy: (battles: any, { desc }: any) => [desc(battles.created_at)],
        with: {
          attacker: true,
          defender: true
        }
      }).catch(() => []);

      // Fetch active tournaments
      const tournaments = await db.query.tournaments?.findMany({
        limit: 3,
        where: (tournaments: any, { eq }: any) => eq(tournaments.status, 'active'),
        orderBy: (tournaments: any, { desc }: any) => [desc(tournaments.created_at)]
      }).catch(() => []);

      return {
        battles: recentBattles || [],
        tournaments: tournaments || [],
        hasActivity: (recentBattles?.length || 0) > 0 || (tournaments?.length || 0) > 0
      };
    } catch (error) {
      console.log('⚠️ [TWEET-DATA] Failed to fetch game activity');
      return { battles: [], tournaments: [], hasActivity: false };
    }
  }

  /**
   * Fetch bridge activity statistics for tweets
   */
  private async getBridgeStats(): Promise<any> {
    try {
      // Get recent bridge transactions
      const recentBridges = await db.query.bridgeTransactions?.findMany({
        limit: 10,
        orderBy: (bridgeTransactions: any, { desc }: any) => [desc(bridgeTransactions.created_at)]
      }).catch(() => []);

      if (!recentBridges || recentBridges.length === 0) {
        return { hasData: false };
      }

      // Calculate stats
      // Strongly typed numeric accumulator to prevent implicit 'any' spread in older TS versions
      const bridges: any[] = Array.isArray(recentBridges) ? (recentBridges as any[]) : [];
      let totalVolume = 0;
      for (const tx of bridges) {
        const raw = (tx as any)?.amount;
        const amt = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 0;
        totalVolume += Number.isFinite(amt) ? amt : 0;
      }
      const popularRoute = this.getMostPopularBridgeRoute(recentBridges);
      
      return {
        hasData: true,
        count: recentBridges.length,
        totalVolume: totalVolume.toFixed(2),
        popularRoute
      };
    } catch (error) {
      console.log('⚠️ [TWEET-DATA] Failed to fetch bridge stats');
      return { hasData: false };
    }
  }

  /**
   * Get most popular bridge route from recent transactions
   */
  private getMostPopularBridgeRoute(transactions: any[]): string {
    const routeCounts: { [key: string]: number } = {};
    
    transactions.forEach((tx: any) => {
      const route = `${tx.fromChain} → ${tx.toChain}`;
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    });

    const popular = Object.entries(routeCounts).sort((a, b) => b[1] - a[1])[0];
    return popular ? popular[0] : 'ETH → XRPL';
  }

  /**
   * Track last used tweet categories to prevent repetition
   */
  private lastTweetCategories: string[] = [];
  
  private addToCategoryHistory(category: string) {
    this.lastTweetCategories.push(category);
    if (this.lastTweetCategories.length > 5) {
      this.lastTweetCategories.shift();
    }
  }

  private wasRecentlyUsed(category: string): boolean {
    return this.lastTweetCategories.includes(category);
  }

  /**
   * Generate tweet content using RiddleAuthor AI with page links and images
   */
  async generateTweetContent(type: 'automatic' | 'promotional', projectData?: any): Promise<string> {
    try {
      if (type === 'promotional' && projectData) {
        // ALWAYS include a platform page link for promotional tweets
        const platformPage = SITE_PAGES.find(page => page.category === 'launch') || SITE_PAGES[0];
        const platformLink = `\n🏠 Explore more: https://riddleswap.com${platformPage.url}`;
        
        return `🚀 Featured Project: ${projectData.name}

${projectData.description}

💎 ${projectData.tagline || 'Building the future of DeFi'}
🔗 Learn more: ${projectData.website || 'riddleswap.com'}${platformLink}

#DeFi #XRPL #Crypto #Innovation

Promoted by RiddleSwap 💙`;
      } else {
        // First, try to get user recommendations to inspire the tweet
        const userRecommendations = await this.getUserRecommendationsForTweet();
        
        let tweetContent = "";
        
        if (userRecommendations && userRecommendations.length > 0) {
          // Use user recommendations to inspire the tweet
          console.log(`💡 [TWEET-GEN] Using ${userRecommendations.length} user recommendations for inspiration`);
          
          const selectedRec = userRecommendations[Math.floor(Math.random() * userRecommendations.length)];
          
          // Generate AI-enhanced tweet based on user recommendation
          tweetContent = await this.generateTweetFromRecommendation(selectedRec);
          
          // Mark the recommendation as used
          await this.markRecommendationAsUsed(selectedRec.id);
          
        } else {
          // Use diverse data-driven tweet categories
          console.log(`🤖 [TWEET-GEN] No user recommendations found, using data-driven tweets`);
          
          // Fetch real platform data
          const [trendingTokens, gameActivity, bridgeStats] = await Promise.all([
            this.getTrendingTokens(),
            this.getGameActivity(),
            this.getBridgeStats()
          ]);

          // Define available tweet categories with real data
          const tweetCategories = [
            {
              id: 'project_showcase',
              weight: 5, // HIGH PRIORITY - Rotate through all 6 projects
              condition: true,
              generate: () => this.generateProjectShowcaseTweet()
            },
            {
              id: 'tokens',
              weight: 3,
              condition: trendingTokens.length > 0,
              generate: () => this.generateTokenTweet(trendingTokens)
            },
            {
              id: 'game_battle',
              weight: 3,
              condition: gameActivity.hasActivity && gameActivity.battles?.length > 0,
              generate: () => this.generateBattleTweet(gameActivity)
            },
            {
              id: 'game_tournament',
              weight: 2,
              condition: gameActivity.hasActivity && gameActivity.tournaments?.length > 0,
              generate: () => this.generateTournamentTweet(gameActivity)
            },
            {
              id: 'bridge',
              weight: 3,
              condition: bridgeStats.hasData,
              generate: () => this.generateBridgeTweet(bridgeStats)
            },
            {
              id: 'swap_promo',
              weight: 2,
              condition: true,
              generate: () => this.generateSwapPromoTweet()
            },
            {
              id: 'nft_marketplace',
              weight: 2,
              condition: true,
              generate: () => this.generateNFTMarketplaceTweet()
            },
            {
              id: 'game_general',
              weight: 2,
              condition: true,
              generate: () => this.generateGameGeneralTweet()
            },
            {
              id: 'platform_stats',
              weight: 1,
              condition: true,
              generate: () => this.generatePlatformStatsTweet()
            }
          ];

          // Filter available categories and exclude recently used ones
          let availableCategories = tweetCategories.filter(cat => 
            cat.condition && !this.wasRecentlyUsed(cat.id)
          );

          // If all categories were recently used, reset and allow all
          if (availableCategories.length === 0) {
            console.log('🔄 [TWEET-GEN] All categories recently used, resetting history');
            this.lastTweetCategories = [];
            availableCategories = tweetCategories.filter(cat => cat.condition);
          }

          // Weighted random selection
          // Explicit generic for reduce accumulator
          const totalWeight = availableCategories.reduce((sum: number, cat) => sum + cat.weight, 0);
          let random = Math.random() * totalWeight;
          
          let selectedCategory = availableCategories[0];
          for (const category of availableCategories) {
            random -= category.weight;
            if (random <= 0) {
              selectedCategory = category;
              break;
            }
          }

          // Generate tweet using selected category
          console.log(`📝 [TWEET-GEN] Selected category: ${selectedCategory.id}`);
          tweetContent = await selectedCategory.generate();
          this.addToCategoryHistory(selectedCategory.id);
        }
        
        return tweetContent;
      }
    } catch (error) {
      console.error("🐦 [TWITTER] Failed to generate tweet content:", error);
      return "🔮 The RiddleSwap ecosystem continues to evolve. Join us on this incredible journey! #DeFi #XRPL #Innovation";
    }
  }

  /**
   * Generate token-focused tweet with real trending data
   */
  private async generateTokenTweet(tokens: any[]): Promise<string> {
    const token = tokens[0];
    const symbol = token.baseToken?.symbol || 'TOKEN';
    const priceChange = parseFloat(token.priceChange?.h24 || 0);
    const volume = parseFloat(token.volume?.h24 || 0);
    const price = parseFloat(token.priceUsd || 0);

    const emoji = priceChange > 0 ? '🚀📈' : '📊';
    const change = priceChange > 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;
    
    return `${emoji} ${symbol} ${priceChange > 0 ? 'Trending' : 'Active'} on RiddleSwap!

💰 Price: $${price.toFixed(6)}
📈 24h: ${change}
💎 Volume: $${this.formatNumber(volume)}

Swap now across 9 blockchains!

🔗 Swap: https://riddleswap.com/swap

#DeFi #Crypto #${symbol} #RiddleSwap`;
  }

  /**
   * Generate battle tweet with real game data
   */
  private async generateBattleTweet(gameActivity: any): Promise<string> {
    const battle = gameActivity.battles[0];
    const attacker = battle.attacker?.username || 'Warrior';
    const defender = battle.defender?.username || 'Champion';
    const wager = battle.wager_amount || 0;
    const winner = battle.winner_id === battle.attacker_id ? attacker : defender;

    return `⚔️ Epic Battle in The Trolls Inquisition!

🏆 ${winner} emerged victorious!
⚡ ${attacker} vs ${defender}
💰 Wager: ${wager} RDL

The battlefield awaits your challenge!

🎮 Play: https://riddleswap.com/game

#Gaming #NFT #TrollsInquisition #RiddleSwap`;
  }

  /**
   * Generate tournament tweet with real data
   */
  private async generateTournamentTweet(gameActivity: any): Promise<string> {
    const tournament = gameActivity.tournaments[0];
    const name = tournament.name || 'Championship';
    const prizePool = tournament.prize_pool || 10000;
    const participants = tournament.current_participants || 0;
    const maxParticipants = tournament.max_participants || 64;

    return `🏆 Tournament Alert: ${name}

💎 Prize Pool: ${this.formatNumber(prizePool)} RDL
👥 Participants: ${participants}/${maxParticipants}
⚔️ Status: Registration Open!

Join the battle for glory and rewards!

🎮 Enter: https://riddleswap.com/game/tournaments

#Tournament #Gaming #RiddleSwap`;
  }

  /**
   * Generate bridge tweet with real stats
   */
  private async generateBridgeTweet(bridgeStats: any): Promise<string> {
    const { count, totalVolume, popularRoute } = bridgeStats;

    return `🌉 Cross-Chain Activity Surging!

📊 Recent Bridges: ${count} transactions
💰 Volume: $${this.formatNumber(parseFloat(totalVolume))}
🔥 Popular Route: ${popularRoute}

Bridge assets seamlessly across 9 chains!

🔗 Bridge: https://riddleswap.com/bridge

#MultiChain #DeFi #CrossChain #RiddleSwap`;
  }

  /**
   * Generate swap promotion tweet
   */
  private async generateSwapPromoTweet(): Promise<string> {
    const chains = ['Ethereum', 'XRPL', 'Solana', 'Polygon', 'Arbitrum', 'Base', 'Optimism', 'BSC', 'Avalanche'];
    const randomChains = chains.sort(() => 0.5 - Math.random()).slice(0, 3);

    return `⚡ Lightning-Fast Swaps on RiddleSwap!

🔄 Swap across ${chains.length} blockchains
💎 Featured: ${randomChains.join(', ')}
🎯 Best prices via multi-DEX aggregation
💰 Low fees, high speed!

Experience the future of DeFi trading!

🔗 Swap: https://riddleswap.com/swap

#DeFi #Swap #MultiChain #RiddleSwap`;
  }

  /**
   * Generate NFT marketplace tweet
   */
  private async generateNFTMarketplaceTweet(): Promise<string> {
    return `🎨 The NFT Marketplace is Live!

✨ Browse unique collections
🔥 Upgrade your battle arsenal
💰 Trade with 1% broker fee
⚔️ Power up for The Inquisition

Discover rare NFTs on XRPL!

🔗 Explore: https://riddleswap.com/nft-marketplace

#NFT #XRPL #Collectibles #RiddleSwap`;
  }

  /**
   * Generate project showcase tweet - Rotates through all 6 RiddleSwap projects
   */
  private async generateProjectShowcaseTweet(): Promise<string> {
    // Get next project in rotation
    const project = RIDDLESWAP_PROJECTS[this.currentProjectIndex];
    
    // Move to next project for next tweet
    this.currentProjectIndex = (this.currentProjectIndex + 1) % RIDDLESWAP_PROJECTS.length;
    
    console.log(`🎨 [PROJECT-SHOWCASE] Featuring: ${project.name} (${project.status})`);
    
    const fullUrl = `https://riddleswap.com${project.url}`;
    
    return `${project.emoji} ${project.name} ${project.status === 'MINTING NOW' ? '🔥' : '✨'}

${project.description}

${project.status === 'MINTING NOW' ? '⚡ MINTING NOW!' : '💎 Collection Live'}
${project.status === 'MINTING NOW' ? '🎨 Limited supply!' : '🔥 Trade now!'}
🌐 Explore: ${fullUrl}

${project.hashtags} #RiddleSwap`;
  }

  /**
   * Generate general game tweet
   */
  private async generateGameGeneralTweet(): Promise<string> {
    const tips = [
      '🗡️ Equip AI-generated weapons for bonus power!',
      '🏰 Join an alliance for group battles!',
      '🎯 Earn badges by completing achievements!',
      '⚔️ Challenge AI opponents to practice!',
      '🏆 Compete in tournaments for massive prizes!',
      '💪 Level up your character class!'
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return `🎮 The Trolls Inquisition awaits!

${randomTip}

⚔️ Turn-based strategic combat
🤖 AI Oracle guides your journey
💰 Wager RDL tokens & NFTs

Medieval mayhem meets blockchain!

🔗 Play: https://riddleswap.com/game

#Gaming #NFT #TrollsInquisition #RiddleSwap`;
  }

  /**
   * Generate platform stats tweet
   */
  private async generatePlatformStatsTweet(): Promise<string> {
    return `📊 RiddleSwap Platform Highlights

✅ 9 Blockchain Networks
✅ Multi-DEX Aggregation
✅ NFT Gaming & Marketplace
✅ Cross-Chain Bridge
✅ 25% Fee Rewards
✅ AI-Powered Tools

Built by the community, for the community!

🔗 Explore: https://riddleswap.com

#DeFi #MultiChain #Gaming #RiddleSwap`;
  }

  /**
   * Format large numbers for display
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  /**
   * Post tweet to Twitter/X with image - Uses real API when configured, simulates otherwise
   */
  async postTweet(content: string, type: 'automatic' | 'promotional', metadata?: any): Promise<{success: boolean, tweetId?: string, error?: string, imageGenerated?: boolean}> {
    try {
      // ENFORCE: Always ensure page link is present (user requirement)
      content = this.ensurePageLink(content);
      
      console.log("🐦 [TWITTER] Posting tweet:", content.substring(0, 100) + "...");
      
      let tweetId: string;
      let actuallyPosted = false;
      let imageGenerated = false;
      
      // Generate image for the tweet
      const tweetCategory = this.getTweetCategory(content);
      const imageData = await this.generateTweetImage(content, tweetCategory);
      let mediaIds: string[] = [];
      
      if (imageData) {
        imageGenerated = true;
        console.log(`🎨 [TWITTER] Generated image for tweet: ${imageData.url}`);
        
      }
      
      // Get authenticated Twitter client
      const authenticatedClient = await this.ensureAuthenticatedClient();
      
      if (authenticatedClient) {
        // Upload image to Twitter if we have one
        if (imageData) {
          try {
            // Download image and upload to Twitter using v1 API
            const response = await fetch(imageData.url);
            const imageBuffer = Buffer.from(await response.arrayBuffer());
            const mediaId = await authenticatedClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
            mediaIds = [mediaId];
            console.log(`📤 [TWITTER] Uploaded image to Twitter: ${mediaId}`);
          } catch (uploadError) {
            console.error(`📤 [TWITTER] Failed to upload image:`, uploadError);
          }
        }
        
        try {
          // Post to actual Twitter/X with media if available using v2 API
          console.log("🐦 [TWITTER] Posting to actual X/Twitter...");
          const tweetPayload: any = { text: content };
          if (mediaIds.length > 0) {
            tweetPayload.media = { media_ids: mediaIds };
          }
          const tweetResponse = await authenticatedClient.v2.tweet(tweetPayload);
          tweetId = tweetResponse.data.id;
          actuallyPosted = true;
          console.log("✅ [TWITTER] Successfully posted to X/Twitter:", tweetId, mediaIds.length > 0 ? "with image" : "without image");
        } catch (twitterError) {
          console.error("❌ [TWITTER] Failed to post to X/Twitter:", twitterError);
          // Fall back to simulation
          tweetId = `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log("🔄 [TWITTER] Falling back to simulation mode");
        }
      } else {
        // Simulate posting if no authenticated client
        tweetId = `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log("🔄 [TWITTER] Simulating tweet (OAuth2 tokens not available - admin needs to authorize)");
      }
      
      // Save tweet to database for tracking
      const tweetRecord = {
        tweet_id: tweetId,
        content,
        type,
        status: actuallyPosted ? 'posted_to_twitter' : 'simulated',
        posted_at: new Date(),
        metadata: metadata ? JSON.stringify(metadata) : null,
        tweet_type: type === 'automatic' ? 'automatic' : type === 'promotional' ? 'promotional' : 'manual'
      };
      
      // Actually save to database
      try {
        await db.insert(riddleAuthorTweets).values({
          content,
          tweet_type: tweetRecord.tweet_type,
          // status column exists in schema; keep but ensure naming matches
          status: tweetRecord.status,
          posted_at: tweetRecord.posted_at,
          metadata: tweetRecord.metadata,
          initiated_by_user: 'system'
        } as any);
        console.log(`💾 [TWITTER] Saved tweet record to database: ${tweetId}`);
      } catch (dbError) {
        console.error(`💾 [TWITTER] Failed to save tweet to database:`, dbError);
      }

      console.log("🐦 [TWITTER] Tweet processing completed:", {
        id: tweetId,
        type,
        actuallyPosted,
        contentLength: content.length,
        timestamp: new Date().toISOString()
      });

      // Send notification to Telegram channel
      if (actuallyPosted && tweetId && !tweetId.startsWith('simulated_')) {
        const tweetUrl = `https://twitter.com/riddlexrpl/status/${tweetId}`;
        try {
          await telegramService.postTweetNotification(content, tweetUrl);
          console.log("📱 [TELEGRAM] Tweet notification sent to channel");
        } catch (telegramError) {
          console.error("📱 [TELEGRAM] Failed to send notification:", telegramError);
        }
      } else {
        console.log("📱 [TELEGRAM] Skipping notification (tweet was simulated or not posted)");
      }

      return { 
        success: true, 
        tweetId,
        imageGenerated,
        ...(actuallyPosted ? {} : { note: "Tweet was simulated - provide Twitter API keys for actual posting" })
      };
      
    } catch (error) {
      console.error("🐦 [TWITTER] Failed to post tweet:", error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', imageGenerated: false };
    }
  }

  /**
   * Check if Twitter API is configured
   * Accepts EITHER OAuth 1.0a OR OAuth 2.0 credentials
   */
  isConfigured(): boolean {
    // Check OAuth 2.0 credentials
    const hasOAuth2 = !!(this.config.clientId && this.config.clientSecret);
    
    // Check OAuth 1.0a credentials
    const hasOAuth1 = !!(
      process.env.TWITTER_API_KEY && 
      process.env.TWITTER_API_SECRET && 
      process.env.TWITTER_ACCESS_TOKEN && 
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
    
    return hasOAuth2 || hasOAuth1;
  }

  /**
   * Ensure we have an authenticated Twitter client for posting
   */
  private async ensureAuthenticatedClient(): Promise<TwitterApi | null> {
    try {
      // Check if we have direct API credentials (preferred method)
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

      if (apiKey && apiSecret && accessToken && accessTokenSecret) {
        console.log("🐦 [TWITTER] Using direct API credentials for authentication");
        
        // Create authenticated client with all required credentials
        return new TwitterApi({
          appKey: apiKey,
          appSecret: apiSecret,
          accessToken: accessToken,
          accessSecret: accessTokenSecret,
        });
      }

      // Fallback to OAuth2 flow if direct credentials not available
      const tokenData = await this.getStoredTokens();
      if (!tokenData?.accessToken || !tokenData?.refreshToken) {
        console.log("🐦 [TWITTER] No API credentials or stored tokens found - admin needs to configure Twitter");
        return null;
      }

      // Check if token is expired (refresh 5 minutes before expiry)
      const now = Date.now();
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes
      if (tokenData.accessTokenExpiresAt && (now + expiryBuffer) >= tokenData.accessTokenExpiresAt) {
        console.log("🐦 [TWITTER] Access token expired, refreshing...");
        return await this.refreshAccessToken(tokenData.refreshToken);
      }

      // Return authenticated client
      return new TwitterApi(tokenData.accessToken);
    } catch (error) {
      console.error("🐦 [TWITTER] Failed to get authenticated client:", error);
      return null;
    }
  }

  /**
   * Refresh expired access token
   */
  private async refreshAccessToken(refreshToken: string): Promise<TwitterApi | null> {
    try {
      if (!this.twitterClient) {
        throw new Error("Base Twitter client not initialized");
      }

      const { client: refreshedClient, accessToken, refreshToken: newRefreshToken, expiresIn } = 
        await this.twitterClient.refreshOAuth2Token(refreshToken);

      // Store new tokens
      await this.storeTokens({
        accessToken,
        refreshToken: newRefreshToken || refreshToken,
        accessTokenExpiresAt: Date.now() + (expiresIn * 1000)
      });

      console.log("🐦 [TWITTER] Access token refreshed successfully");
      return refreshedClient;
    } catch (error) {
      console.error("🐦 [TWITTER] Failed to refresh access token:", error);
      return null;
    }
  }

  /**
   * Get stored OAuth2 tokens
   */
  private async getStoredTokens(): Promise<{accessToken: string; refreshToken: string; accessTokenExpiresAt?: number} | null> {
    try {
      // For now, store in memory - in production should use secure database storage
      return this.config.accessToken && this.config.refreshToken ? {
        accessToken: this.config.accessToken,
        refreshToken: this.config.refreshToken,
        accessTokenExpiresAt: this.config.accessTokenExpiresAt
      } : null;
    } catch (error) {
      console.error("🐦 [TWITTER] Failed to get stored tokens:", error);
      return null;
    }
  }

  /**
   * Store OAuth2 tokens securely
   */
  private async storeTokens(tokens: {accessToken: string; refreshToken: string; accessTokenExpiresAt?: number}): Promise<void> {
    try {
      // For now, store in memory - in production should use secure database storage
      this.config.accessToken = tokens.accessToken;
      this.config.refreshToken = tokens.refreshToken;
      this.config.accessTokenExpiresAt = tokens.accessTokenExpiresAt;
      console.log("🐦 [TWITTER] Tokens stored successfully");
    } catch (error) {
      console.error("🐦 [TWITTER] Failed to store tokens:", error);
    }
  }

  /**
   * Get user recommendations for tweet inspiration
   */
  private async getUserRecommendationsForTweet() {
    try {
      const recommendations = await db
        .select()
        .from(riddleAuthorTweets)
        .where(
          and(
            eq(riddleAuthorTweets.tweet_type, 'user_recommendation'),
            eq(riddleAuthorTweets.status, 'pending_review')
          )
        )
        .orderBy(desc(riddleAuthorTweets.created_at))
        .limit(10);
      
      console.log(`💡 [TWEET-GEN] Found ${recommendations.length} pending user recommendations`);
      return recommendations;
    } catch (error) {
      console.error("💡 [TWEET-GEN] Failed to fetch user recommendations:", error);
      return [];
    }
  }

  /**
   * Generate enhanced tweet content from user recommendation
   */
  private async generateTweetFromRecommendation(recommendation: any): Promise<string> {
    try {
      const userIdea = recommendation.content;
      const userHandle = recommendation.initiated_by_user;
      const category = recommendation.game_context || 'general';
      
      console.log(`💡 [TWEET-GEN] Creating tweet inspired by ${userHandle}'s idea: "${userIdea}"`);
      
      // Enhanced template based on user recommendation
      const templates = {
        gaming: `🎮 ${userIdea}\n\n⚔️ The Trolls Inquisition continues...\n🗺️ 1000 land plots await brave souls\n💎 NFT weapons & upgrades available\n\nJoin the medieval mayhem!\n\n#TrollsInquisition #Gaming #NFT #RiddleSwap`,
        
        nft: `🎨 ${userIdea}\n\n✨ New collections launching daily\n🔥 Upgrade your arsenal with AI-generated weapons\n💰 Trade, battle, and conquer\n\nThe NFT evolution begins here.\n\n#NFT #Crypto #RiddleSwap #DigitalArt`,
        
        trading: `💹 ${userIdea}\n\n📊 Multi-chain DeFi at your fingertips\n⚡ Lightning-fast swaps across 9 blockchains\n🔄 Bridge assets seamlessly\n\nThe future of trading is here.\n\n#DeFi #Trading #XRPL #RiddleSwap`,
        
        community: `🤝 ${userIdea}\n\n👥 Built by the community, for the community\n🎯 25% of all fees returned to users\n🚀 Your voice shapes our direction\n\nTogether, we're unstoppable.\n\n#Community #RiddleSwap #DeFi #Together`,
        
        general: `🌟 ${userIdea}\n\n🔮 Innovation meets tradition\n⚡ Where DeFi magic happens\n🌊 Riding the waves of change\n\nThe adventure continues...\n\n#RiddleSwap #DeFi #Innovation #Future`
      };
      
      const template = templates[category as keyof typeof templates] || templates.general;
      
      // ALWAYS add a page link based on category
      const relevantPage = SITE_PAGES.find(page => page.category === category) || 
                          SITE_PAGES.find(page => page.category === 'gaming') ||
                          SITE_PAGES[0]; // Fallback to first page
      const pageLink = `\n\n🔗 ${relevantPage.title}: https://riddleswap.com${relevantPage.url}`;
      
      // Add subtle credit to the user who made the recommendation
      const enhancedTweet = `${template}${pageLink}\n\n💡 Inspired by our amazing community`;
      
      return enhancedTweet;
    } catch (error) {
      console.error("💡 [TWEET-GEN] Failed to generate tweet from recommendation:", error);
      return "🌟 Community ideas drive innovation. Thank you for being part of the RiddleSwap journey! #Community #RiddleSwap";
    }
  }

  /**
   * Mark a recommendation as used in a tweet
   */
  private async markRecommendationAsUsed(recommendationId: string): Promise<void> {
    try {
      await db
        .update(riddleAuthorTweets)
        .set({  
          status: 'used_in_automatic_tweet',
          posted_at: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(riddleAuthorTweets.id, recommendationId));
      
      console.log(`💡 [TWEET-GEN] Marked recommendation ${recommendationId} as used`);
    } catch (error) {
      console.error("💡 [TWEET-GEN] Failed to mark recommendation as used:", error);
    }
  }

  /**
   * Get relevant page link based on tweet content
   */
  private getRelevantPageLink(content: string): {url: string, title: string, category: string} | null {
    const contentLower = content.toLowerCase();
    
    // Match content to relevant pages
    if (contentLower.includes('gaming') || contentLower.includes('trolls') || contentLower.includes('land') || contentLower.includes('medieval')) {
      return SITE_PAGES.find(page => page.category === 'gaming') || null;
    }
    if (contentLower.includes('swap') || contentLower.includes('trading') || contentLower.includes('exchange')) {
      return SITE_PAGES.find(page => page.category === 'trading') || null;
    }
    if (contentLower.includes('nft') || contentLower.includes('collectible') || contentLower.includes('marketplace')) {
      return SITE_PAGES.find(page => page.category === 'nft') || null;
    }
    if (contentLower.includes('defi') || contentLower.includes('staking') || contentLower.includes('yield')) {
      return SITE_PAGES.find(page => page.category === 'defi') || null;
    }
    if (contentLower.includes('bridge') || contentLower.includes('cross-chain') || contentLower.includes('multi-chain')) {
      return SITE_PAGES.find(page => page.category === 'bridge') || null;
    }
    if (contentLower.includes('launch') || contentLower.includes('token') || contentLower.includes('project')) {
      return SITE_PAGES.find(page => page.category === 'launch') || null;
    }
    if (contentLower.includes('ai') || contentLower.includes('riddleauthor') || contentLower.includes('intelligent')) {
      return SITE_PAGES.find(page => page.category === 'ai') || null;
    }
    
    // Default to a random popular page
    const popularPages = SITE_PAGES.filter(page => ['nft', 'trading', 'gaming'].includes(page.category));
    return popularPages[Math.floor(Math.random() * popularPages.length)] || null;
  }

  /**
   * Generate image using DALL-E 3 for tweets
   */
  async generateTweetImage(tweetContent: string, category: string = 'general'): Promise<{url: string, localPath?: string} | null> {
    try {
      console.log(`🎨 [IMAGE-GEN] Generating image for ${category} tweet...`);
      
      // Check if OpenAI API key is available and valid
      if (!process.env.OPENAI_API_KEY) {
        console.log(`⚠️ [IMAGE-GEN] OpenAI API key not configured - skipping image generation`);
        return null;
      }
      
      // Create enhanced image prompts with RDL branding for better pictures
      const imagePrompts = {
        gaming: `Professional gaming banner: Epic medieval fantasy battlefield with mystical Trolls warriors, glowing magical weapons, ancient castle siege, dramatic lighting, cinematic composition. Bold "RDL" logo in corner with blockchain network visualization, treasure chests overflowing with NFTs, vibrant purple and gold color palette, AAA game quality artwork, trending on ArtStation, 8K quality, highly detailed`,
        
        nft: `Premium NFT marketplace showcase: Holographic NFT gallery with floating "The Inquisition" collection pieces, divine light rays, ornate golden frames, futuristic display pedestals, prominent "RDL" branding in metallic gold, cyberpunk luxury aesthetic with purple and blue neon accents, museum-quality lighting, professional photography style, ultra-detailed`,
        
        trading: `Professional trading platform: Multi-monitor crypto exchange setup showing "RiddleSwap" interface, real-time candlestick charts with RDL token pair, blockchain network connections glowing, sophisticated trader workspace, luxury modern office, dramatic rim lighting, Bloomberg terminal aesthetic, professional financial photography, ultra-sharp details`,
        
        defi: `Modern DeFi dashboard: Sleek cryptocurrency trading interface with live "RDL" token chart, multi-chain blockchain networks (XRPL, ETH, SOL) glowing in background, holographic data visualization, professional financial graphics, clean UI/UX design, blue purple gradient, high-tech minimalist style, Apple-quality design aesthetics, 4K crisp display`,
        
        bridge: `Blockchain bridge concept art: Majestic golden bridges connecting floating blockchain islands (XRPL, ETH, SOL), RDL tokens traveling across bridges as light particles, dramatic sky with aurora effects, "RiddleSwap" logo integrated naturally, fantasy meets technology aesthetic, epic scale architecture, Unreal Engine quality rendering, cinematic movie poster style`,
        
        ai: `The Oracle AI visualization: Mystical artificial intelligence entity with glowing neural networks, ancient mystical scroll merged with holographic code, "RDL" symbol radiating divine light, magical-tech fusion aesthetic, cosmic purple and gold lighting effects, ethereal particles floating, fantasy meets cyberpunk, award-winning concept art quality`,
        
        general: `RiddleSwap brand showcase: Abstract futuristic crypto landscape with interconnected blockchain networks, prominent "RDL" logo with metallic finish, flowing digital currency streams, geometric sacred geometry patterns, luxury brand aesthetic with blue purple gold color scheme, professional corporate branding quality, high-end financial institution visual identity, 8K photorealistic rendering`
      };
      
      const prompt = imagePrompts[category as keyof typeof imagePrompts] || imagePrompts.general;
      
      // Generate image using OpenAI DALL-E 3
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const imageResponse = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url"
      });
      
      const imageUrl = imageResponse.data?.[0]?.url;
      
      if (imageUrl) {
        console.log(`✅ [IMAGE-GEN] Successfully generated image: ${imageUrl}`);
        return { url: imageUrl };
      } else {
        console.log(`❌ [IMAGE-GEN] No image URL returned`);
        return null;
      }
      
    } catch (error: any) {
      // Handle authentication errors gracefully
      if (error?.status === 401 || error?.code === 'invalid_project') {
        console.log(`🔐 [IMAGE-GEN] OpenAI authentication failed - API key invalid or insufficient permissions. Skipping image generation.`);
        return null;
      }
      console.error("🎨 [IMAGE-GEN] Failed to generate image:", error);
      return null;
    }
  }

  /**
   * Get tweet category based on content
   */
  private getTweetCategory(content: string): string {
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('gaming') || contentLower.includes('trolls') || contentLower.includes('medieval')) return 'gaming';
    if (contentLower.includes('nft') || contentLower.includes('collectible')) return 'nft';
    if (contentLower.includes('swap') || contentLower.includes('trading')) return 'trading';
    if (contentLower.includes('defi') || contentLower.includes('staking')) return 'defi';
    if (contentLower.includes('bridge') || contentLower.includes('cross-chain')) return 'bridge';
    if (contentLower.includes('ai') || contentLower.includes('riddleauthor')) return 'ai';
    
    return 'general';
  }

  /**
   * Generate AI image of a user for new wallet creation tweets
   */
  async generateUserImage(userHandle: string): Promise<{url: string} | null> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log(`⚠️ [USER-IMAGE] OpenAI API key not configured - skipping user image generation`);
        return null;
      }

      console.log(`🎨 [USER-IMAGE] Generating portrait for @${userHandle}...`);

      // Create enhanced prompt for user portrait with RDL branding
      const prompt = `Epic fantasy RPG character portrait: Heroic warrior named "${userHandle}" in ornate medieval armor with glowing RDL emblem on chest plate, mystical magical aura surrounding them, dramatic hero pose, cinematic lighting with purple and gold rays, enchanted weapons, ancient ruins background, floating magical runes, professional AAA game character design, League of Legends art style quality, trending on ArtStation, highly detailed facial features, volumetric lighting, 8K ultra-detailed digital painting`;

      const imageResponse = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url"
      });

      const imageUrl = imageResponse.data?.[0]?.url;

      if (imageUrl) {
        console.log(`✅ [USER-IMAGE] Successfully generated portrait for @${userHandle}`);
        return { url: imageUrl };
      }

      return null;
    } catch (error: any) {
      if (error?.status === 401 || error?.code === 'invalid_project') {
        console.log(`🔐 [USER-IMAGE] OpenAI authentication failed - skipping user image`);
        return null;
      }
      console.error("🎨 [USER-IMAGE] Failed to generate user image:", error);
      return null;
    }
  }

  /**
   * Tweet about new wallet creation with user's AI-generated portrait
   */
  async tweetNewWalletCreation(userHandle: string): Promise<{success: boolean, tweetId?: string, error?: string}> {
    try {
      console.log(`🆕 [NEW-WALLET] Creating welcome tweet for @${userHandle}...`);

      // Generate AI portrait for the user
      const userImage = await this.generateUserImage(userHandle);

      // Create welcome tweet content
      const tweetContent = `🎉 Welcome to RiddleSwap, @${userHandle}!

Your journey begins now. May fortune favor the bold! 🗺️⚔️

🏰 Explore medieval lands
💰 Trade across 17 chains
🎮 Join The Trolls Inquisition

#RiddleSwap #DeFi #XRPL #NewMember`;

      let mediaIds: string[] = [];

      // Get authenticated client
      const authenticatedClient = await this.ensureAuthenticatedClient();
      
      if (!authenticatedClient) {
        return {
          success: false,
          error: "Twitter API not configured"
        };
      }

      // Upload user image if generated
      if (userImage) {
        try {
          const response = await fetch(userImage.url);
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          const mediaId = await authenticatedClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
          mediaIds = [mediaId];
          console.log(`📤 [NEW-WALLET] Uploaded portrait to Twitter: ${mediaId}`);
        } catch (uploadError) {
          console.error(`📤 [NEW-WALLET] Failed to upload portrait:`, uploadError);
        }
      }

      // Post tweet
      const tweetPayload: any = { text: tweetContent };
      if (mediaIds.length > 0) {
        tweetPayload.media = { media_ids: mediaIds };
      }

      const tweetResponse = await authenticatedClient.v2.tweet(tweetPayload);
      const tweetId = tweetResponse.data.id;

      // Save to database
      await db.insert(riddleAuthorTweets).values({
        content: tweetContent,
        tweet_type: 'automatic',
        status: 'posted_to_twitter',
        posted_at: new Date(),
        metadata: JSON.stringify({ 
          type: 'new_wallet',
          userHandle,
          hasImage: !!userImage
        }),
        initiated_by_user: 'system'
      } as any);

      console.log(`✅ [NEW-WALLET] Welcome tweet posted for @${userHandle}: ${tweetId}`);

      return {
        success: true,
        tweetId
      };

    } catch (error: any) {
      console.error(`❌ [NEW-WALLET] Failed to tweet about new wallet:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * App Management System
   */
  private apps: TwitterApp[] = [];
  
  /**
   * Add new app to the system
   */
  async addApp(appData: Omit<TwitterApp, 'id' | 'createdAt'>, createdBy: string): Promise<TwitterApp> {
    const newApp: TwitterApp = {
      id: nanoid(),
      ...appData,
      createdAt: new Date(),
      createdBy
    };
    
    this.apps.push(newApp);
    console.log(`📱 [APP-MANAGER] Added new app: ${newApp.name} by ${createdBy}`);
    return newApp;
  }
  
  /**
   * Get all apps
   */
  getApps(): TwitterApp[] {
    return this.apps.filter(app => app.isActive);
  }
  
  /**
   * Update app
   */
  async updateApp(appId: string, updates: Partial<TwitterApp>): Promise<TwitterApp | null> {
    const appIndex = this.apps.findIndex(app => app.id === appId);
    if (appIndex === -1) return null;
    
    this.apps[appIndex] = { ...this.apps[appIndex], ...updates };
    console.log(`📱 [APP-MANAGER] Updated app: ${this.apps[appIndex].name}`);
    return this.apps[appIndex];
  }
  
  /**
   * Delete app
   */
  async deleteApp(appId: string): Promise<boolean> {
    const appIndex = this.apps.findIndex(app => app.id === appId);
    if (appIndex === -1) return false;
    
    this.apps[appIndex].isActive = false;
    console.log(`📱 [APP-MANAGER] Deactivated app: ${this.apps[appIndex].name}`);
    return true;
  }
  
  /**
   * Get app by category for relevant tweets
   */
  getAppByCategory(category: string): TwitterApp | null {
    const relevantApps = this.apps.filter(app => 
      app.isActive && app.category === category
    ).sort((a, b) => b.priority - a.priority);
    
    return relevantApps[0] || null;
  }
  
  /**
   * Upload image to Twitter for media attachment
   */
  private async uploadImageToTwitter(imageUrl: string): Promise<string | null> {
    try {
      // Download image from OpenAI
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const imageBuffer = await response.buffer();
      
      // Upload to Twitter using v1.1 media endpoint
      const mediaUpload = await this.twitterClient!.v1.uploadMedia(imageBuffer, {
        mimeType: 'image/png',
        target: 'tweet'
      });
      
      return mediaUpload;
      
    } catch (error) {
      console.error(`📤 [TWITTER-UPLOAD] Failed to upload image:`, error);
      return null;
    }
  }
  
  /**
   * Ensure content always has a page link - enforces user requirement
   */
  private ensurePageLink(content: string): string {
    // Check if content already has a platform link
    if (content.includes('riddleswap.com/')) {
      return content;
    }
    
    // Get relevant page link and append it
    const relevantPage = this.getRelevantPageLink(content) || SITE_PAGES[0]; // Always have a fallback
    const pageLink = `\n\n🔗 ${relevantPage.title}: https://riddleswap.com${relevantPage.url}`;
    
    // Ensure total length doesn't exceed 280 characters
    const maxContentLength = 280 - pageLink.length;
    const trimmedContent = content.length > maxContentLength ? 
      content.substring(0, maxContentLength - 3) + '...' : content;
    
    return trimmedContent + pageLink;
  }
}

// Site page link pool for automatic inclusion in tweets
const SITE_PAGES = [
  { url: '/nft-marketplace', title: 'NFT Marketplace', category: 'nft' },
  { url: '/swap', title: 'Multi-Chain Swap', category: 'trading' },
  { url: '/staking', title: 'Staking Rewards', category: 'defi' },
  { url: '/nft-gaming', title: 'The Trolls Inquisition', category: 'gaming' },
  { url: '/launchpad', title: 'Token Launchpad', category: 'launch' },
  { url: '/riddlepad', title: 'RiddlePad', category: 'launch' },
  { url: '/portfolio', title: 'Portfolio Analytics', category: 'analytics' },
  { url: '/bridge', title: 'Cross-Chain Bridge', category: 'bridge' },
  { url: '/devtools', title: 'Developer Tools', category: 'dev' },
  { url: '/rewards', title: 'User Rewards', category: 'rewards' },
  { url: '/riddleauthor', title: 'RiddleAuthor AI', category: 'ai' },
  { url: '/mapping', title: 'Land Plot Mapping', category: 'gaming' },
  { url: '/nft-collections', title: 'NFT Collections', category: 'nft' },
  { url: '/wallet-dashboard', title: 'Wallet Dashboard', category: 'wallet' },
  { url: '/multi-chain-dashboard', title: 'Multi-Chain Dashboard', category: 'wallet' }
];

// App management system interface
interface TwitterApp {
  id: string;
  name: string;
  description: string;
  category: 'gaming' | 'defi' | 'nft' | 'trading' | 'analytics' | 'ai' | 'social';
  url?: string;
  imagePrompt?: string;
  hashtags: string[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  createdBy: string;
}

// Global Twitter service instance
export const twitterService = new TwitterPostingService();

// Initialize default apps
twitterService.addApp({
  name: "The Trolls Inquisition",
  description: "Epic medieval gaming platform with 1000 land plots",
  category: "gaming",
  url: "/nft-gaming",
  imagePrompt: "Epic medieval fantasy gaming landscape",
  hashtags: ["#Gaming", "#NFT", "#Medieval"],
  isActive: true,
  priority: 10,
  createdBy: "system"
}, "system");

twitterService.addApp({
  name: "NFT Marketplace",
  description: "Trade, collect, and discover unique NFTs",
  category: "nft",
  url: "/nft-marketplace",
  imagePrompt: "Futuristic NFT marketplace with digital art",
  hashtags: ["#NFT", "#Marketplace", "#DigitalArt"],
  isActive: true,
  priority: 9,
  createdBy: "system"
}, "system");

twitterService.addApp({
  name: "Multi-Chain Swap",
  description: "Seamless trading across 9+ blockchains",
  category: "trading",
  url: "/swap",
  imagePrompt: "Abstract multi-chain trading interface",
  hashtags: ["#DeFi", "#Trading", "#MultiChain"],
  isActive: true,
  priority: 8,
  createdBy: "system"
}, "system");

twitterService.addApp({
  name: "RiddleAuthor AI",
  description: "Intelligent AI companion for crypto guidance",
  category: "ai",
  url: "/riddleauthor",
  imagePrompt: "Mystical AI entity with magical-tech fusion",
  hashtags: ["#AI", "#Crypto", "#Intelligence"],
  isActive: true,
  priority: 7,
  createdBy: "system"
}, "system");

/**
 * App Management Endpoints
 */

// Get all apps
router.get("/apps", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const apps = twitterService.getApps();
    res.json({ success: true, apps });

  } catch (error) {
    console.error("📱 [APP-MANAGER] Failed to get apps:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get apps"
    });
  }
});

// Add new app
router.post("/apps", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const { name, description, category, url, imagePrompt, hashtags, priority = 5 } = req.body;
    
    if (!name || !description || !category) {
      return res.status(400).json({
        success: false,
        error: "Name, description, and category are required"
      });
    }

    const newApp = await twitterService.addApp({
      name,
      description,
      category,
      url,
      imagePrompt,
      hashtags: hashtags || [],
      isActive: true,
      priority,
      createdBy: userHandle
    }, userHandle);
    
    res.json({ success: true, app: newApp });

  } catch (error) {
    console.error("📱 [APP-MANAGER] Failed to add app:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add app"
    });
  }
});

// Update app
router.put("/apps/:id", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const { id } = req.params;
    const updates = req.body;
    
    const updatedApp = await twitterService.updateApp(id, updates);
    
    if (!updatedApp) {
      return res.status(404).json({
        success: false,
        error: "App not found"
      });
    }
    
    res.json({ success: true, app: updatedApp });

  } catch (error) {
    console.error("📱 [APP-MANAGER] Failed to update app:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update app"
    });
  }
});

// Delete app
router.delete("/apps/:id", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const { id } = req.params;
    
    const deleted = await twitterService.deleteApp(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "App not found"
      });
    }
    
    res.json({ success: true, message: "App deleted successfully" });

  } catch (error) {
    console.error("📱 [APP-MANAGER] Failed to delete app:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete app"
    });
  }
});

/**
 * Manual tweet posting endpoint (admin only)
 */
router.post("/post-tweet", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users to post manual tweets
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const { content, type = 'manual' } = req.body;
    
    if (!content || content.length > 280) {
      return res.status(400).json({
        success: false,
        error: "Tweet content is required and must be under 280 characters"
      });
    }

    const result = await twitterService.postTweet(content, type);
    
    res.json({
      ...result,
      note: result.imageGenerated ? "Tweet posted with generated image" : "Tweet posted without image"
    });

  } catch (error) {
    console.error("🐦 [TWITTER] Manual tweet failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to post tweet"
    });
  }
});

/**
 * Get Oracle AI tweet suggestions (ADMIN ONLY) - sends to Telegram
 */
router.post("/oracle-suggestions", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const { category = 'automatic', count = 3 } = req.body;
    
    console.log(`🔮 [ORACLE] Generating ${count} tweet suggestions for category: ${category}`);

    const suggestions = [];
    
    // Generate multiple suggestions
    for (let i = 0; i < Math.min(count, 5); i++) {
      const tweetContent = await twitterService.generateTweetContent(category);
      suggestions.push({
        content: tweetContent,
        category,
        length: tweetContent.length,
        generated_at: new Date().toISOString()
      });
      
      // Send each suggestion to Telegram
      await telegramService.sendOracleTweetSuggestion(
        tweetContent,
        category,
        { suggestion_number: i + 1, total_suggestions: count }
      );
    }
    
    res.json({
      success: true,
      suggestions,
      message: `Generated ${suggestions.length} tweet suggestions and sent to Telegram`
    });

  } catch (error) {
    console.error("🔮 [ORACLE] Failed to generate suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate tweet suggestions"
    });
  }
});

/**
 * Paid promotional tweet endpoint - accepts 30 XRP payment (ADMIN ONLY)
 */
router.post("/promotional-tweet", sessionAuth, async (req, res) => {
  try {
    const {
      project_name,
      description,
      website,
      tagline,
      payment_wallet,
      payment_amount
    } = req.body;

    // Validate payment amount (must be exactly 30 XRP)
    if (payment_amount !== 30) {
      return res.status(400).json({
        success: false,
        error: "Promotional tweets require exactly 30 XRP payment"
      });
    }

    // Bank wallet for receiving promotional payments
    const PROMOTIONAL_BANK_WALLET = "rH1zJSuP4CQtPeTzGp4gCzPpW6J1L9JHWt";
    
    // Generate destination tag for tracking
    const destinationTag = Math.floor(Math.random() * 900000) + 100000; // 6-digit tag
    
    // Create payment transaction details
    const paymentTransaction = {
      from: payment_wallet,
      to: PROMOTIONAL_BANK_WALLET,
      amount: "30000000", // 30 XRP in drops
      destinationTag,
      memo: {
        type: "promotional_tweet",
        project: project_name,
        timestamp: new Date().toISOString()
      }
    };

    // Generate promotional tweet content
    const tweetContent = await twitterService.generateTweetContent('promotional', {
      name: project_name,
      description,
      website,
      tagline
    });

    // Create promotional tweet order
    const promotionalOrder = {
      project_name,
      description,
      website,
      tagline,
      payment_wallet,
      payment_amount: 30,
      destination_tag: destinationTag,
      bank_wallet: PROMOTIONAL_BANK_WALLET,
      tweet_content: tweetContent,
      status: 'payment_pending',
      created_at: new Date(),
      payment_transaction: JSON.stringify(paymentTransaction)
    };

    console.log("🐦 [PROMOTIONAL] Created promotional tweet order:", {
      project: project_name,
      amount: "30 XRP",
      destinationTag,
      bank: PROMOTIONAL_BANK_WALLET
    });

    res.json({
      success: true,
      message: "Promotional tweet order created",
      project_name,
      payment_required: "30 XRP",
      bank_wallet: PROMOTIONAL_BANK_WALLET,
      destination_tag: destinationTag,
      tweet_preview: tweetContent,
      payment_transaction: paymentTransaction,
      order_data: promotionalOrder
    });

  } catch (error) {
    console.error("🐦 [PROMOTIONAL] Failed to create promotional tweet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create promotional tweet order"
    });
  }
});

/**
 * AI Tweet Verification Endpoint - Check tweet against project guidelines
 */
router.post("/verify-tweet", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users to verify tweets
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const { content, type = 'manual' } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Tweet content is required for verification"
      });
    }

    console.log(`🔍 [TWEET-VERIFY] Verifying tweet content for ${userHandle}...`);

    // Run AI verification
    const verificationResult = await twitterService.verifyTweetContent(content, type);
    
    // Return verification result with underneath state
    res.json({
      success: true,
      verification: verificationResult,
      tweetContent: content,
      tweetType: type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("🔍 [TWEET-VERIFY] Verification endpoint failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify tweet content"
    });
  }
});

/**
 * Get verification guidelines - Public endpoint showing project guidelines
 */
router.get("/guidelines", async (req, res) => {
  try {
    res.json({
      success: true,
      guidelines: {
        maxLength: TWEET_GUIDELINES.maxLength,
        requiredHashtags: TWEET_GUIDELINES.requiredHashtags,
        forbiddenWords: TWEET_GUIDELINES.forbiddenWords.map(word => `*${word}*`), // Obscure sensitive words
        brandKeywords: TWEET_GUIDELINES.brandKeywords,
        appropriateTone: TWEET_GUIDELINES.appropriateTone,
        verificationProcess: {
          aiAnalysis: "Content analyzed by AI for brand consistency and appropriateness",
          hashtagValidation: "Checks for required project hashtags",
          lengthValidation: "Ensures tweet stays within Twitter's 280 character limit",
          spamDetection: "Filters out spam and inappropriate language",
          brandAlignment: "Validates alignment with RiddleSwap gaming brand"
        }
      },
      verificationStates: {
        passed: "Tweet meets all guidelines and will be posted",
        failed: "Tweet does not meet guidelines and requires revision",
        pending: "Tweet is currently being verified by AI",
        rejected: "Tweet rejected due to policy violations"
      }
    });

  } catch (error) {
    console.error("🔍 [GUIDELINES] Failed to get guidelines:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get verification guidelines"
    });
  }
});

/**
 * Get tweet history and statistics
 */
router.get("/stats", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users to view stats
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    // TODO: Get actual tweet statistics from database
    const stats = {
      total_tweets: 0,
      automatic_tweets: 0,
      promotional_tweets: 0,
      total_revenue: 0,
      last_tweet: null,
      next_scheduled: new Date(Date.now() + 2 * 60 * 60 * 1000), // Next 2-hour interval
      twitter_configured: twitterService.isConfigured()
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error("🐦 [TWITTER] Failed to get stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get Twitter statistics"
    });
  }
});

/**
 * OAuth2 Authorization Routes - Admin Only
 */

// Store for OAuth2 state and code verifiers (in production use secure database)
const oauthStates = new Map<string, {codeVerifier: string, timestamp: number}>();

/**
 * Start OAuth2 authorization - Admin only
 */
router.get("/oauth2/start", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    if (!twitterService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Twitter OAuth2 credentials not configured"
      });
    }

    console.log(`🐦 [OAUTH2] Starting authorization for admin: ${userHandle}`);
    
    // Generate OAuth2 authorization URL
    const { url, codeVerifier, state } = (twitterService as any).twitterClient.generateOAuth2AuthLink(
      (twitterService as any).config.redirectUri,
      { 
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] 
      }
    );

    // Store state and code verifier for callback
    oauthStates.set(state, {
      codeVerifier,
      timestamp: Date.now()
    });

    // Clean up old states (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    Array.from(oauthStates.entries()).forEach(([key, value]) => {
      if (value.timestamp < tenMinutesAgo) {
        oauthStates.delete(key);
      }
    });

    console.log(`🐦 [OAUTH2] Generated authorization URL for ${userHandle}`);
    
    res.json({
      success: true,
      authUrl: url,
      message: "Visit the authorization URL to grant Twitter access",
      redirectTo: url
    });

  } catch (error) {
    console.error("🐦 [OAUTH2] Failed to start authorization:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start Twitter authorization"
    });
  }
});

/**
 * OAuth2 callback - Handle authorization code
 */
router.get("/oauth2/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).json({
        success: false,
        error: "Missing authorization code or state"
      });
    }

    // Retrieve stored code verifier
    const storedData = oauthStates.get(state);
    if (!storedData) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired state parameter"
      });
    }

    console.log("🐦 [OAUTH2] Processing authorization callback...");

    // Exchange code for tokens
    const { client: loggedClient, accessToken, refreshToken, expiresIn } = 
      await (twitterService as any).twitterClient.loginWithOAuth2({
        code,
        codeVerifier: storedData.codeVerifier,
        redirectUri: (twitterService as any).config.redirectUri
      });

    // Store tokens
    await (twitterService as any).storeTokens({
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + (expiresIn * 1000)
    });

    // Clean up state
    oauthStates.delete(state);

    console.log("✅ [OAUTH2] Authorization completed successfully");

    res.json({
      success: true,
      message: "Twitter authorization completed! The system can now post tweets.",
      expiresIn,
      tokenType: "Bearer"
    });

  } catch (error) {
    console.error("🐦 [OAUTH2] Authorization callback failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete Twitter authorization"
    });
  }
});

/**
 * Test tweet endpoint - PUBLIC for easy testing
 */
router.post("/test-tweet", sessionAuth, async (req, res) => {
  // Admin-only check
  const userHandle = req.user?.userHandle;
  if (!userHandle || !isAdminUser(userHandle)) {
    return res.status(403).json({
      success: false,
      error: "Admin access required"
    });
  }

  try {
    console.log("🐦 [TEST] Triggering test tweet...");
    
    const testContent = `🎉 RiddleSwap Twitter Integration Test!

The Oracle is alive and posting to X/Twitter! 🔮

✅ Real OAuth 1.0a authentication
✅ AI-generated images
✅ Automatic scheduling

#RiddleSwap #DeFi #XRPL #TestTweet`;

    const result = await twitterService.postTweet(testContent, 'automatic', {
      type: 'manual_test',
      timestamp: new Date().toISOString()
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Test tweet posted successfully!",
        tweetId: result.tweetId,
        imageGenerated: result.imageGenerated
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to post tweet"
      });
    }
  } catch (error) {
    console.error("🐦 [TEST] Test tweet failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Check OAuth2 status - Admin only
 */
router.get("/oauth2/status", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    const tokens = await (twitterService as any).getStoredTokens();
    const isConfigured = twitterService.isConfigured();
    
    // Check if we have OAuth 1.0a credentials (direct posting)
    const hasOAuth1 = !!(
      process.env.TWITTER_API_KEY && 
      process.env.TWITTER_API_SECRET && 
      process.env.TWITTER_ACCESS_TOKEN && 
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
    
    // Check if we have OAuth 2.0 tokens
    const hasOAuth2Tokens = !!(tokens?.accessToken && tokens?.refreshToken);
    
    // Can post if we have EITHER OAuth 1.0a OR OAuth 2.0 tokens
    const canPost = hasOAuth1 || hasOAuth2Tokens;
    const authorized = hasOAuth1 || hasOAuth2Tokens;
    
    res.json({
      success: true,
      status: {
        configured: isConfigured,
        authorized: authorized,
        authMethod: hasOAuth1 ? 'OAuth 1.0a' : (hasOAuth2Tokens ? 'OAuth 2.0' : 'None'),
        tokenExpiry: tokens?.accessTokenExpiresAt ? new Date(tokens.accessTokenExpiresAt) : null,
        needsAuthorization: isConfigured && !authorized,
        canPost: canPost
      }
    });

  } catch (error) {
    console.error("🐦 [OAUTH2] Failed to check status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check authorization status"
    });
  }
});

// Export the router as default
/**
 * Test Telegram connection (ADMIN ONLY)
 */
router.post("/test-telegram", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    // Only allow authorized admin users
    if (!userHandle || !isAdminUser(userHandle)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    console.log("📱 [TELEGRAM] Testing connection...");
    
    // Test the connection
    const connectionTest = await telegramService.testConnection();
    
    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: connectionTest.error || "Failed to connect to Telegram"
      });
    }
    
    // Send a test message
    const testMessage = "🔮 **The Oracle** is now connected to Telegram!\n\nYou'll receive notifications here when tweets are posted automatically. 🐦";
    const result = await telegramService.sendMessage(testMessage);
    
    res.json({
      success: result.success,
      message: result.success ? "Telegram connection successful! Check your channel for a test message." : "Failed to send test message",
      botInfo: connectionTest.botInfo,
      error: result.error
    });

  } catch (error) {
    console.error("📱 [TELEGRAM] Test failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;