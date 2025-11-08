import { sql } from 'drizzle-orm';
import { db } from './db';

export interface PostWithMetrics {
  id: number;
  content: string;
  authorHandle: string;
  authorDisplayName: string;
  authorProfileImage: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  isRetweet?: boolean;
  originalAuthor?: string;
  algorithmScore: number;
}

export interface AlgorithmConfig {
  // Priority account settings
  priorityAccounts: string[];
  priorityBoostMultiplier: number;
  
  // Engagement scoring weights
  likeWeight: number;
  shareWeight: number;
  commentWeight: number;
  
  // Time decay settings
  timeDecayFactor: number;
  maxAgeHours: number;
  
  // Content diversity
  maxPostsPerUser: number;
  diversityEnabled: boolean;
}

export class NewsfeedAlgorithm {
  private config: AlgorithmConfig;

  constructor(config?: Partial<AlgorithmConfig>) {
    // Default Twitter-like algorithm configuration
    this.config = {
      priorityAccounts: ['riddlebank', 'dippydoge'], // Priority verified accounts
      priorityBoostMultiplier: 5.0,
      
      likeWeight: 1.0,
      shareWeight: 3.0,  // Shares are more valuable than likes
      commentWeight: 5.0, // Comments show highest engagement
      
      timeDecayFactor: 0.1, // How fast posts lose relevance
      maxAgeHours: 8640, // Don't show posts older than 360 days (1 year)
      
      maxPostsPerUser: 3, // Max posts per user in feed
      diversityEnabled: true,
      
      ...config
    };
  }

  /**
   * Update algorithm configuration
   */
  updateConfig(newConfig: Partial<AlgorithmConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 [ALGORITHM] Configuration updated:', this.config);
  }

  /**
   * Get current algorithm configuration
   */
  getConfig(): AlgorithmConfig {
    return { ...this.config };
  }

  /**
   * Calculate algorithm score for a post (simplified for current schema)
   */
  private calculateScore(post: any): number {
    const ageInHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    
    // Skip posts older than max age
    if (ageInHours > this.config.maxAgeHours) {
      return 0;
    }

    // Base engagement score (simplified since no engagement data available yet)
    const engagementScore = 
      (post.likes_count || 0) * this.config.likeWeight +
      (post.shares_count || 0) * this.config.shareWeight +
      (post.comments_count || 0) * this.config.commentWeight;

    // Time decay (newer posts get higher scores)
    const timeDecay = Math.exp(-this.config.timeDecayFactor * ageInHours);

    // Priority account boost
    const isPriorityAccount = this.config.priorityAccounts.includes(post.author_handle);
    const priorityBoost = isPriorityAccount ? this.config.priorityBoostMultiplier : 1.0;

    // Content quality indicators (can be expanded)
    const contentScore = this.calculateContentScore(post.content);

    // Base score for all posts to ensure they show up
    const baseScore = 5.0;

    // Final algorithm score
    const finalScore = (baseScore + engagementScore + contentScore) * timeDecay * priorityBoost;

    console.log(`📊 [ALGORITHM] Post ${post.id} by @${post.author_handle}: ` +
      `base=${baseScore}, content=${contentScore.toFixed(2)}, time=${timeDecay.toFixed(2)}, ` +
      `priority=${priorityBoost}x, final=${finalScore.toFixed(2)}`);

    return finalScore;
  }

  /**
   * Calculate content quality score
   */
  private calculateContentScore(content: string): number {
    let score = 1.0; // Base score

    // Longer posts get slight boost (but not too long)
    const length = content.length;
    if (length > 50 && length < 200) {
      score += 0.5;
    }

    // Posts with questions get engagement boost
    if (content.includes('?')) {
      score += 0.3;
    }

    // Posts with mentions get social boost
    if (content.includes('@')) {
      score += 0.2;
    }

    // Posts with hashtags get discovery boost
    if (content.includes('#')) {
      score += 0.2;
    }

    return score;
  }

  /**
   * Apply diversity filtering to prevent feed dominance
   */
  private applyDiversityFilter(posts: PostWithMetrics[]): PostWithMetrics[] {
    if (!this.config.diversityEnabled) {
      return posts;
    }

    const userPostCounts = new Map<string, number>();
    const diversifiedPosts: PostWithMetrics[] = [];

    for (const post of posts) {
      const userCount = userPostCounts.get(post.authorHandle) || 0;
      
      if (userCount < this.config.maxPostsPerUser) {
        diversifiedPosts.push(post);
        userPostCounts.set(post.authorHandle, userCount + 1);
      }
    }

    console.log(`🎯 [ALGORITHM] Diversity filter: ${posts.length} -> ${diversifiedPosts.length} posts`);
    return diversifiedPosts;
  }

  /**
   * Get newsfeed posts using algorithm
   */
  async generateNewsfeed(userHandle: string, limit: number = 20, offset: number = 0): Promise<PostWithMetrics[]> {
    try {
      console.log(`🔮 [ALGORITHM] Generating newsfeed for @${userHandle} with limit ${limit}`);
      
      // Fetch raw posts using properly parameterized SQL queries to prevent SQL injection
      const queryLimit = limit * 3;
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.content,
          p.author_handle,
          p.image_urls,
          COALESCE(p.shares_count, 0)::int as shares_count,
          p.created_at,
          p.updated_at,
          sp.display_name,
          sp.profile_picture_url,
          COALESCE(like_counts.likes_count, 0)::int as likes_count,
          COALESCE(comment_counts.comments_count, 0)::int as comments_count
        FROM posts p
        LEFT JOIN social_profiles sp ON p.author_handle = sp.handle
        LEFT JOIN (
          SELECT post_id, COUNT(*)::int as likes_count
          FROM post_likes
          GROUP BY post_id
        ) like_counts ON p.id = like_counts.post_id
        LEFT JOIN (
          SELECT post_id, COUNT(*)::int as comments_count
          FROM post_comments
          WHERE is_deleted = false
          GROUP BY post_id
        ) comment_counts ON p.id = comment_counts.post_id
        ORDER BY p.created_at DESC
        LIMIT ${queryLimit} OFFSET ${offset}
      `);

      // Transform and score posts
      const postsWithScores: PostWithMetrics[] = result.rows.map((row: any) => {
        const algorithmScore = this.calculateScore(row);
        
        return {
          id: row.id,
          content: row.content,
          authorHandle: row.author_handle,
          authorDisplayName: row.display_name || row.author_handle,
          authorProfileImage: row.profile_picture_url || '',
          imageUrls: row.image_urls || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          likesCount: Number(row.likes_count) ?? 0,
          sharesCount: Number(row.shares_count) ?? 0,
          commentsCount: Number(row.comments_count) ?? 0,
          algorithmScore
        };
      });

      // Sort by algorithm score (highest first)
      const sortedPosts = postsWithScores
        .filter(post => post.algorithmScore > 0)
        .sort((a, b) => b.algorithmScore - a.algorithmScore);

      // Apply diversity filtering
      const diversifiedPosts = this.applyDiversityFilter(sortedPosts);

      // Limit to requested number
      const finalPosts = diversifiedPosts.slice(0, limit);

      console.log(`✅ [ALGORITHM] Generated newsfeed: ${finalPosts.length} posts selected`);
      console.log(`🎯 [ALGORITHM] Top posts:`, 
        finalPosts.slice(0, 3).map(p => `@${p.authorHandle}: ${p.algorithmScore.toFixed(2)}`));

      return finalPosts;

    } catch (error) {
      console.error('❌ [ALGORITHM] Failed to generate newsfeed:', error);
      throw error;
    }
  }

  /**
   * Get algorithm statistics for debugging
   */
  async getAlgorithmStats(): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_posts,
          COUNT(DISTINCT author_handle) as unique_authors,
          AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
        FROM posts
      `);

      const priorityPostsResult = await db.execute(sql`
        SELECT COUNT(*) as priority_posts
        FROM posts p
        WHERE p.author_handle IN ('riddlebank', 'dippydoge')
      `);

      return {
        totalPosts: result.rows[0]?.total_posts || 0,
        uniqueAuthors: result.rows[0]?.unique_authors || 0,
        averageAgeHours: parseFloat(String(result.rows[0]?.avg_age_hours || '0')),
        priorityPosts: priorityPostsResult.rows[0]?.priority_posts || 0,
        priorityAccounts: this.config.priorityAccounts,
        config: this.config
      };
    } catch (error) {
      console.error('❌ [ALGORITHM] Failed to get stats:', error);
      return null;
    }
  }
}

// Global algorithm instance
export const newsfeedAlgorithm = new NewsfeedAlgorithm();

// Algorithm configuration presets
export const ALGORITHM_PRESETS = {
  DEFAULT: {
    priorityAccounts: ['riddlebank', 'dippydoge'],
    priorityBoostMultiplier: 5.0,
    likeWeight: 1.0,
    shareWeight: 3.0,
    commentWeight: 5.0,
    timeDecayFactor: 0.1,
    maxAgeHours: 48,
    maxPostsPerUser: 3,
    diversityEnabled: true
  },
  
  CHRONOLOGICAL: {
    priorityAccounts: [],
    priorityBoostMultiplier: 1.0,
    likeWeight: 0.1,
    shareWeight: 0.1,
    commentWeight: 0.1,
    timeDecayFactor: 0.01,
    maxAgeHours: 24,
    maxPostsPerUser: 10,
    diversityEnabled: false
  },
  
  ENGAGEMENT_HEAVY: {
    priorityAccounts: ['riddlebank', 'dippydoge'],
    priorityBoostMultiplier: 10.0,
    likeWeight: 2.0,
    shareWeight: 5.0,
    commentWeight: 10.0,
    timeDecayFactor: 0.05,
    maxAgeHours: 72,
    maxPostsPerUser: 2,
    diversityEnabled: true
  }
};