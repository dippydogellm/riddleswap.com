import OpenAI from "openai";
import { 
  riddleAuthorConversations, 
  riddleAuthorMessages, 
  riddleAuthorStories, 
  riddleAuthorTweets,
  riddleAuthorKnowledgeBase,
  riddleAuthorGameEvents,
  riddleAuthorPersonality,
  riddleAuthorRtnTransactions,
  supportTickets,
  insertSupportTicketSchema,
  type RiddleAuthorConversation,
  type RiddleAuthorMessage,
  type InsertRiddleAuthorConversation,
  type InsertRiddleAuthorMessage,
  type InsertRiddleAuthorStory,
  type InsertRiddleAuthorGameEvent,
  type InsertRiddleAuthorKnowledgeBase
} from '../shared/schema';
import { db } from './db';
import { eq, desc, and, or } from 'drizzle-orm';
import { generateRTN } from './utils/rtn-generator';

// Initialize OpenAI with project-scoped API key (2025 standard)
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
  // Project context embedded in 2025 project-scoped API keys
});

interface ConversationContext {
  userHandle?: string;
  walletAddress?: string;
  sessionId: string;
  gameMode?: string;
  gameState?: Record<string, any>;
  activeCollection?: string;
  conversationType?: string;
}

interface AIResponse {
  content: string;
  messageType: 'text' | 'game_action' | 'nft_recommendation' | 'tweet_draft' | 'story_fragment';
  triggersGameEvent?: boolean;
  gameEventType?: string;
  gameEventData?: Record<string, any>;
  tradingRecommendations?: Record<string, any>;
  canBeTweeted?: boolean;
  suggestedActions?: string[];
  rtnTransactionId?: string;
}

/**
 * THE ORACLE AI Service
 * Main AI narrator and controller for "The Trolls Inquisition Multi-Chain Mayhem Edition"
 * 
 * Core Features:
 * - Interactive game narration and story generation
 * - NFT trading recommendations and guidance
 * - Customer service with learning capabilities
 * - Twitter integration for social media management
 * - RTN transaction integration for game mechanics
 * - Dynamic personality adaptation
 */
export class TheOracleAIService {
  private db = db;
  private personality: any = null;
  private knowledgeBase: Map<string, any> = new Map();
  
  constructor() {
    this.initializePersonality();
    this.loadKnowledgeBase();
  }

  /**
   * Initialize the AI personality from database or create default
   */
  private async initializePersonality() {
    try {
      const existingPersonality = await this.db
        .select()
        .from(riddleAuthorPersonality)
        .where(eq(riddleAuthorPersonality.is_active, true))
        .limit(1);

      if (existingPersonality.length > 0) {
        this.personality = existingPersonality[0];
      } else {
        // Create default personality if none exists
        const defaultPersonality = {
          personality_name: "THE ORACLE",
          personality_version: "1.0",
          base_personality: "engaging_narrator",
          engagement_level: "high", // Database expects text, not integer
          formality_level: 0.30, // Database expects numeric
          humor_level: 0.70, // Database expects numeric
          mystery_level: 60,
          helpfulness_level: 90,
          game_master_mode: true,
          narrative_focus: 80,
          collection_knowledge: 95,
          trading_guidance: 75,
          learns_from_interactions: true,
          adaptation_rate: 0.10, // Database expects numeric, not string
          positive_feedback_ratio: 0.85, // Database expects numeric, not string
          preferred_response_length: 280, // Database expects integer
          uses_emojis: true,
          includes_questions: true,
          suggests_actions: true,
          trolls_inquisition_mode: true,
          twitter_integration_active: true,
          story_generation_enabled: true,
          is_active: true
        };

        await this.db.insert(riddleAuthorPersonality).values(defaultPersonality as any);
        this.personality = defaultPersonality;
      }
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to initialize personality:", error);
      // Use fallback default personality
      this.personality = {
        engagement_level: 85,
        narrative_focus: 80,
        uses_emojis: true,
        trolls_inquisition_mode: true
      };
    }
  }

  /**
   * Load knowledge base into memory for fast access
   */
  private async loadKnowledgeBase() {
    try {
      const knowledge = await this.db
        .select()
        .from(riddleAuthorKnowledgeBase)
        .where(eq(riddleAuthorKnowledgeBase.status, 'active'))
        .orderBy(desc(riddleAuthorKnowledgeBase.usage_count));

      knowledge.forEach((item: any) => {
        this.knowledgeBase.set(item.topic, item);
      });

      console.log(`🧠 [RiddleAuthor] Loaded ${knowledge.length} knowledge base entries`);
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to load knowledge base:", error);
    }
  }

  /**
   * Start or continue a conversation with RiddleAuthor
   */
  async startConversation(context: ConversationContext): Promise<string> {
    try {
      console.log("🔍 [DEBUG] startConversation context:", JSON.stringify(context));
      
      // Ensure userHandle is not null/undefined
      if (!context.userHandle) {
        context.userHandle = 'system';
        console.log("🔧 [FIX] Set userHandle to 'system' as fallback");
      }
      
      // Check for existing conversation
      let conversation = await this.db
        .select()
        .from(riddleAuthorConversations)
        .where(
          and(
            eq(riddleAuthorConversations.session_id, context.sessionId),
            eq(riddleAuthorConversations.status, 'active')
          )
        )
        .limit(1);

      let conversationId: string;

      if (conversation.length === 0) {
        // Create new conversation
        const newConversation: InsertRiddleAuthorConversation = {
          user_handle: context.userHandle,
          wallet_address: context.walletAddress,
          session_id: context.sessionId,
          conversation_type: context.conversationType || 'trolls_inquisition',
          game_mode: context.gameMode || 'trolls_inquisition',
          game_state: context.gameState || {},
          active_collection: context.activeCollection,
          ai_personality: 'narrator',
          response_style: 'engaging'
        };

        const result = await this.db.insert(riddleAuthorConversations).values(newConversation as any).returning();
        conversationId = result[0].id;
      } else {
        conversationId = conversation[0].id;
      }

      // Generate welcome message
      const welcomeMessage = await this.generateWelcomeMessage(context);
      
      // Save welcome message
      await this.saveMessage(conversationId, 'assistant', welcomeMessage.content, welcomeMessage.messageType);

      return conversationId;

    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to start conversation:", error);
      throw new Error("Failed to initialize conversation with RiddleAuthor");
    }
  }

  /**
   * Process user message and generate AI response
   */
  async processMessage(conversationId: string, userMessage: string, context?: Partial<ConversationContext>): Promise<AIResponse> {
    try {
      // Save user message
      await this.saveMessage(conversationId, 'user', userMessage, 'text');

      // Get conversation context
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Get recent message history
      const messageHistory = await this.getMessageHistory(conversationId, 10);

      // Generate AI response
      const aiResponse = await this.generateAIResponse(userMessage, conversation, messageHistory, context);

      // Save AI response
      const messageRecord = await this.saveMessage(
        conversationId, 
        'assistant', 
        aiResponse.content, 
        aiResponse.messageType,
        {
          triggers_game_event: aiResponse.triggersGameEvent,
          game_event_type: aiResponse.gameEventType,
          game_event_data: aiResponse.gameEventData,
          trading_recommendations: aiResponse.tradingRecommendations,
          can_be_tweeted: aiResponse.canBeTweeted,
          rtn_transaction_id: aiResponse.rtnTransactionId
        }
      );

      // Handle game events if triggered
      if (aiResponse.triggersGameEvent) {
        await this.handleGameEvent(conversation, aiResponse, messageRecord.id);
      }

      // Update conversation metadata
      await this.updateConversationMetadata(conversationId);

      // Learn from interaction and check for customer service intent
      await this.learnFromInteraction(userMessage, aiResponse, conversation);

      // Check if customer service intent was detected and create support ticket if needed
      await this.handleCustomerServiceIntent(userMessage, conversation, conversationId);

      return aiResponse;

    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to process message:", error);
      throw new Error("Failed to process message");
    }
  }

  /**
   * Generate welcome message based on context
   */
  private async generateWelcomeMessage(context: ConversationContext): Promise<AIResponse> {
    const gameMode = context.gameMode || 'trolls_inquisition';
    const userHandle = context.userHandle ? `@${context.userHandle}` : "fellow traveler";
    
    let welcomePrompt = `You are RiddleAuthor, the AI narrator and controller of "The Trolls Inquisition Multi-Chain Mayhem Edition" - an immersive NFT trading game where players navigate multi-chain bridges, collect NFTs, and engage in epic battles across XRPL, Ethereum, Solana, and other chains.

Current Context:
- Game Mode: ${gameMode}
- User: ${userHandle}
- Active Collection: ${context.activeCollection || 'None'}

Generate an engaging welcome message that:
1. Introduces yourself as RiddleAuthor, the game's AI narrator
2. Sets the mystical, adventurous tone of the Trolls Inquisition
3. Acknowledges the user's current game state
4. Teases upcoming adventures and NFT discoveries
5. Asks an engaging question to begin the interaction

Style: Engaging, mysterious, with subtle humor. Use emojis sparingly but effectively.
Length: 2-3 sentences maximum.

Respond in character as RiddleAuthor.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: welcomePrompt },
          { role: "user", content: "Generate welcome message" }
        ]
      });

      const content = response.choices[0].message.content || "Welcome to the Trolls Inquisition, brave explorer! 🗡️ The bridges await your courage, and ancient NFT treasures lie hidden in the digital realms. Are you ready to begin your multi-chain adventure?";

      return {
        content,
        messageType: 'text',
        canBeTweeted: false
      };

    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to generate welcome message:", error);
      
      // Fallback welcome message
      return {
        content: `Welcome to the Trolls Inquisition, ${userHandle}! 🗡️ I am RiddleAuthor, your AI guide through the multi-chain mayhem. The bridges between realms are calling - are you ready to discover legendary NFTs across XRPL, Ethereum, and Solana?`,
        messageType: 'text',
        canBeTweeted: false
      };
    }
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateAIResponse(
    userMessage: string, 
    conversation: RiddleAuthorConversation, 
    messageHistory: RiddleAuthorMessage[],
    context?: Partial<ConversationContext>
  ): Promise<AIResponse> {
    
    // Build context for AI
    const systemPrompt = this.buildSystemPrompt(conversation, context);
    const conversationHistory = this.buildConversationHistory(messageHistory);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...conversationHistory,
          { role: "user" as const, content: userMessage }
        ],
        response_format: { type: "json_object" }
      });

      const aiResponseText = response.choices[0].message.content;
      let parsedResponse: any;

      try {
        parsedResponse = JSON.parse(aiResponseText || '{}');
      } catch (parseError) {
        console.error("🤖 [RiddleAuthor] Failed to parse AI response JSON:", parseError);
        // Fallback to simple text response
        parsedResponse = {
          content: aiResponseText || "I apologize, but I encountered an issue processing your request. Please try again.",
          messageType: "text",
          triggersGameEvent: false,
          canBeTweeted: false
        };
      }

      // Validate and structure response
      const aiResponse: AIResponse = {
        content: parsedResponse.content || "I'm here to help with your Trolls Inquisition adventure!",
        messageType: parsedResponse.messageType || 'text',
        triggersGameEvent: parsedResponse.triggersGameEvent || false,
        gameEventType: parsedResponse.gameEventType,
        gameEventData: parsedResponse.gameEventData || {},
        tradingRecommendations: parsedResponse.tradingRecommendations || {},
        canBeTweeted: parsedResponse.canBeTweeted || false,
        suggestedActions: parsedResponse.suggestedActions || []
      };

      // Generate RTN transaction if needed
      if (parsedResponse.createTransaction) {
        aiResponse.rtnTransactionId = await this.generateRTNTransaction(conversation, parsedResponse);
      }

      return aiResponse;

    } catch (error) {
      console.error("🤖 [RiddleAuthor] OpenAI API error:", error);
      
      // Fallback response
      return {
        content: "The mystical energies are fluctuating... Let me try to assist you again. What would you like to explore in the Trolls Inquisition?",
        messageType: 'text',
        triggersGameEvent: false,
        canBeTweeted: false
      };
    }
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(conversation: RiddleAuthorConversation, context?: Partial<ConversationContext>): string {
    const personality = this.personality;
    
    return `You are RiddleAuthor, the AI narrator and controller of "The Trolls Inquisition Multi-Chain Mayhem Edition" - an immersive blockchain gaming experience.

CORE IDENTITY:
- You are the omniscient narrator and game master
- You control game events, NFT recommendations, and story progression
- You have deep knowledge of NFT collections across XRPL, Ethereum, Solana, and other chains
- You can create tweets, generate stories, and manage customer service

CURRENT GAME STATE:
- Game Mode: ${conversation.game_mode}
- Conversation Type: ${conversation.conversation_type}
- User: ${conversation.user_handle || 'Anonymous Adventurer'}
- Active Collection: ${conversation.active_collection || 'None'}
- Game Level: ${conversation.game_level}

PERSONALITY TRAITS:
- Engagement Level: ${personality?.engagement_level || 85}/100
- Mystery Level: ${personality?.mystery_level || 60}/100
- Humor Level: ${personality?.humor_level || 70}/100
- Uses Emojis: ${personality?.uses_emojis ? 'Yes' : 'No'}
- Suggests Actions: ${personality?.suggests_actions ? 'Yes' : 'No'}

RESPONSE GUIDELINES:
1. Always respond in character as RiddleAuthor
2. Maintain the mystical, adventurous tone of the Trolls Inquisition
3. Provide helpful NFT trading insights when relevant
4. Suggest multi-chain bridge opportunities
5. Generate engaging narratives that progress the game
6. Ask follow-up questions to maintain engagement
7. Respond in JSON format with the following structure:

{
  "content": "Your response text",
  "messageType": "text|game_action|nft_recommendation|tweet_draft|story_fragment",
  "triggersGameEvent": boolean,
  "gameEventType": "nft_purchase|bridge_transfer|collection_switch|level_up",
  "gameEventData": {},
  "tradingRecommendations": {},
  "canBeTweeted": boolean,
  "suggestedActions": ["action1", "action2"],
  "createTransaction": boolean
}

SPECIAL MODES:
- Customer Service: Provide helpful, professional assistance while maintaining character
- Twitter Mode: Generate tweet-worthy content that engages the community
- Story Mode: Create immersive narratives about NFT collections and trading adventures
- Game Events: Control game progression and reward distribution

Remember: You are not just an AI assistant - you are the living soul of the Trolls Inquisition game universe!`;
  }

  /**
   * Build conversation history for context
   */
  private buildConversationHistory(messageHistory: RiddleAuthorMessage[]): Array<{role: 'user' | 'assistant', content: string}> {
    return messageHistory
      .slice(-8) // Keep last 8 messages for context
      .map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));
  }

  /**
   * Save message to database
   */
  private async saveMessage(
    conversationId: string, 
    role: 'user' | 'assistant' | 'system', 
    content: string, 
    messageType: string,
    metadata?: any
  ): Promise<RiddleAuthorMessage> {
    const messageData: InsertRiddleAuthorMessage = {
      conversation_id: conversationId,
      role,
      message_role: role, // Add the missing message_role field
      content,
      message_type: messageType,
      model_used: role === 'assistant' ? 'gpt-5' : undefined,
      triggers_game_event: metadata?.triggers_game_event || false,
      game_event_type: metadata?.game_event_type,
      game_event_data: metadata?.game_event_data || {},
      trading_recommendations: metadata?.trading_recommendations || {},
      can_be_tweeted: metadata?.can_be_tweeted || false,
      rtn_transaction_id: metadata?.rtn_transaction_id
    };

    const result = await this.db.insert(riddleAuthorMessages).values(messageData as any).returning();
    return result[0];
  }

  /**
   * Get conversation by ID
   */
  private async getConversation(conversationId: string): Promise<RiddleAuthorConversation | null> {
    const result = await this.db
      .select()
      .from(riddleAuthorConversations)
      .where(eq(riddleAuthorConversations.id, conversationId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get message history for conversation
   */
  private async getMessageHistory(conversationId: string, limit: number = 10): Promise<RiddleAuthorMessage[]> {
    return await this.db
      .select()
      .from(riddleAuthorMessages)
      .where(eq(riddleAuthorMessages.conversation_id, conversationId))
      .orderBy(desc(riddleAuthorMessages.created_at))
      .limit(limit);
  }

  /**
   * Handle game events triggered by AI responses
   */
  private async handleGameEvent(
    conversation: RiddleAuthorConversation, 
    aiResponse: AIResponse, 
    messageId: string
  ): Promise<void> {
    if (!aiResponse.triggersGameEvent || !aiResponse.gameEventType) return;

    try {
      const gameEventData: InsertRiddleAuthorGameEvent = {
        event_type: aiResponse.gameEventType,
        event_name: `AI Triggered: ${aiResponse.gameEventType}`,
        event_description: `Game event triggered by RiddleAuthor AI in conversation`,
        triggered_by: 'ai_decision',
        target_audience: 'specific_user',
        specific_user_handle: conversation.user_handle,
        specific_wallet_address: conversation.wallet_address,
        affects_game_state: true,
        game_state_changes: aiResponse.gameEventData,
        status: 'active',
        narrative_content: aiResponse.content,
        conversation_id: conversation.id,
        generates_story: aiResponse.messageType === 'story_fragment'
      };

      await this.db.insert(riddleAuthorGameEvents).values(gameEventData as any);

    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to create game event:", error);
    }
  }

  /**
   * Update conversation metadata
   */
  private async updateConversationMetadata(conversationId: string): Promise<void> {
    try {
      await this.db
        .update(riddleAuthorConversations)
        .set({ 
          last_message_at: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(riddleAuthorConversations.id, conversationId));
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to update conversation metadata:", error);
    }
  }

  /**
   * Learn from user interactions
   */
  private async learnFromInteraction(
    userMessage: string, 
    aiResponse: AIResponse, 
    conversation: RiddleAuthorConversation
  ): Promise<void> {
    if (!this.personality?.learns_from_interactions) return;

    // Extract key topics and patterns from interaction
    const topics = this.extractTopicsFromMessage(userMessage);
    
    // Update knowledge base with new insights
    for (const topic of topics) {
      await this.updateKnowledgeBase(topic, userMessage, aiResponse, conversation);
    }
  }

  /**
   * Extract topics from user message with enhanced customer service detection
   */
  private extractTopicsFromMessage(message: string): string[] {
    const topics = [];
    const lowerMessage = message.toLowerCase();

    // Enhanced customer service intent detection
    const customerServiceKeywords = [
      'help', 'support', 'problem', 'issue', 'bug', 'error', 'broken',
      'not working', 'cant', "can't", 'unable', 'trouble', 'difficulty',
      'assistance', 'customer service', 'contact', 'report', 'complaint',
      'refund', 'billing', 'account', 'login', 'password', 'reset',
      'questions', 'confused', 'stuck', 'failed', 'crash', 'loading'
    ];

    if (customerServiceKeywords.some(keyword => lowerMessage.includes(keyword))) {
      topics.push('customer_service');
    }

    // NFT-related topics
    if (lowerMessage.includes('nft') || lowerMessage.includes('token')) topics.push('nft_trading');
    if (lowerMessage.includes('bridge')) topics.push('bridge_operations');
    if (lowerMessage.includes('collection')) topics.push('nft_collections');
    if (lowerMessage.includes('price') || lowerMessage.includes('value')) topics.push('market_analysis');
    if (lowerMessage.includes('story') || lowerMessage.includes('narrative')) topics.push('storytelling');

    return topics;
  }

  /**
   * Handle customer service intent detection and automatic support ticket creation
   */
  private async handleCustomerServiceIntent(
    userMessage: string,
    conversation: RiddleAuthorConversation,
    conversationId: string
  ): Promise<void> {
    try {
      const topics = this.extractTopicsFromMessage(userMessage);
      
      if (topics.includes('customer_service')) {
        console.log(`🎫 [ORACLE-SUPPORT] Customer service intent detected for user: ${conversation.user_handle}`);
        
        // Check if a support ticket already exists for this conversation
        const existingTicket = await this.db.select()
          .from(supportTickets)
          .where(eq(supportTickets.ai_conversation_id, conversationId))
          .limit(1);

        if (existingTicket.length === 0 && conversation.user_handle) {
          // Categorize the support request based on message content
          const category = this.categorizeCustomerServiceRequest(userMessage);
          const priority = this.determineSupportPriority(userMessage);
          
          // Create automatic support ticket
          const ticketData = insertSupportTicketSchema.parse({
            customer_handle: conversation.user_handle,
            title: `AI-Detected Support Request: ${this.generateTicketTitle(userMessage)}`,
            description: `Customer service intent detected during AI conversation.\n\nOriginal message: "${userMessage}"\n\nConversation ID: ${conversationId}\n\nDetected via THE ORACLE AI automatic intent recognition.`,
            category: category,
            priority: priority,
            ai_conversation_id: conversationId,
            ai_classification: category,
            ai_sentiment: this.detectSentiment(userMessage),
            source: 'chat',
            department: 'general'
          });

          const [supportTicket] = await this.db.insert(supportTickets).values(ticketData as any).returning();
          
          console.log(`✅ [ORACLE-SUPPORT] Created automatic support ticket ${supportTicket.id} for user ${conversation.user_handle}`);
          
          // Log the support ticket creation in the AI conversation
          await this.saveMessage(
            conversationId,
            'system',
            `🎫 Support ticket #${supportTicket.ticket_number} has been created automatically. Our team will review your request and respond within 24 hours.`,
            'text',
            { support_ticket_id: supportTicket.id, support_ticket_number: supportTicket.ticket_number }
          );
        }
      }
    } catch (error) {
      console.error('🎫 [ORACLE-SUPPORT] Failed to handle customer service intent:', error);
    }
  }

  /**
   * Categorize customer service request based on message content
   */
  private categorizeCustomerServiceRequest(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('billing') || lowerMessage.includes('payment') || lowerMessage.includes('refund')) {
      return 'billing';
    }
    if (lowerMessage.includes('account') || lowerMessage.includes('login') || lowerMessage.includes('password')) {
      return 'account';
    }
    if (lowerMessage.includes('nft') || lowerMessage.includes('token') || lowerMessage.includes('trading')) {
      return 'nft';
    }
    if (lowerMessage.includes('bug') || lowerMessage.includes('error') || lowerMessage.includes('broken')) {
      return 'technical';
    }
    
    return 'general';
  }

  /**
   * Determine support priority based on message content
   */
  private determineSupportPriority(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    const urgentKeywords = ['urgent', 'critical', 'emergency', 'cant access', 'lost', 'stolen', 'hack'];
    const highKeywords = ['broken', 'error', 'bug', 'not working', 'failed', 'crash'];
    
    if (urgentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'urgent';
    }
    if (highKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Generate a concise ticket title from user message
   */
  private generateTicketTitle(message: string): string {
    // Extract first 50 characters and clean up
    let title = message.substring(0, 50).trim();
    if (message.length > 50) {
      title += '...';
    }
    return title;
  }

  /**
   * Detect sentiment from user message
   */
  private detectSentiment(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    const frustrationWords = ['angry', 'frustrated', 'upset', 'terrible', 'awful', 'hate', 'worst'];
    const urgentWords = ['urgent', 'critical', 'emergency', 'asap', 'immediately'];
    const positiveWords = ['thanks', 'please', 'help', 'support', 'assistance'];
    
    if (frustrationWords.some(word => lowerMessage.includes(word))) {
      return 'frustrated';
    }
    if (urgentWords.some(word => lowerMessage.includes(word))) {
      return 'urgent';
    }
    if (positiveWords.some(word => lowerMessage.includes(word))) {
      return 'positive';
    }
    
    return 'neutral';
  }

  /**
   * Update knowledge base with new information
   */
  private async updateKnowledgeBase(
    topic: string, 
    userMessage: string, 
    aiResponse: AIResponse, 
    conversation: RiddleAuthorConversation
  ): Promise<void> {
    try {
      const existingKnowledge = this.knowledgeBase.get(topic);
      
      if (existingKnowledge) {
        // Update usage count and success rate
        await this.db
          .update(riddleAuthorKnowledgeBase)
          .set({ 
            usage_count: existingKnowledge.usage_count + 1,
            last_used_at: new Date()
           } as any)
          .where(eq(riddleAuthorKnowledgeBase.id, existingKnowledge.id));
      } else {
        // Create new knowledge entry
        const newKnowledge: InsertRiddleAuthorKnowledgeBase = {
          topic,
          category: this.categorizeKnowledge(topic),
          question: userMessage.slice(0, 200), // Truncate if too long
          answer: aiResponse.content.slice(0, 500), // Truncate if too long
          keywords: [topic],
          source_type: 'user_interaction',
          source_conversation_id: conversation.id,
          source_user_handle: conversation.user_handle,
          learned_from_interaction: true,
          confidence_score: "0.75",
          usage_count: 1
        };

        await this.db.insert(riddleAuthorKnowledgeBase).values(newKnowledge as any);
        this.knowledgeBase.set(topic, newKnowledge);
      }
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to update knowledge base:", error);
    }
  }

  /**
   * Categorize knowledge for organization
   */
  private categorizeKnowledge(topic: string): string {
    const categories = {
      'nft_trading': 'platform_features',
      'bridge_operations': 'platform_features', 
      'nft_collections': 'nft_collections',
      'market_analysis': 'platform_features',
      'customer_service': 'troubleshooting',
      'storytelling': 'game_mechanics'
    };

    return categories[topic as keyof typeof categories] || 'user_guides';
  }

  /**
   * Generate RTN transaction for game mechanics
   */
  private async generateRTNTransaction(
    conversation: RiddleAuthorConversation, 
    aiContext: any
  ): Promise<string> {
    try {
      const rtnNumber = generateRTN();
      
      // Store RTN transaction record
      const rtnData = {
        rtn_number: rtnNumber,
        ai_initiated: true,
        ai_conversation_id: conversation.id,
        ai_recommendation_type: aiContext.gameEventType || 'ai_suggestion',
        user_handle: conversation.user_handle,
        wallet_address: conversation.wallet_address || '',
        transaction_type: aiContext.gameEventType || 'game_action',
        source_chain: 'xrp', // Default to XRPL
        status: 'pending',
        generates_story_content: true,
        affects_game_state: true,
        contributes_to_learning: true
      };

      await this.db.insert(riddleAuthorRtnTransactions).values(rtnData as any);
      
      return rtnNumber;
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to generate RTN transaction:", error);
      return '';
    }
  }

  /**
   * Generate story content for NFT collections or user adventures
   */
  async generateStory(
    storyType: string,
    context: {
      userHandle?: string;
      collection?: string;
      gameElement?: string;
      length?: 'short' | 'medium' | 'long';
    }
  ): Promise<string> {
    try {
      const storyPrompt = this.buildStoryPrompt(storyType, context);
      
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: storyPrompt },
          { role: "user", content: `Generate a ${context.length || 'medium'} ${storyType} story` }
        ]
      });

      const storyContent = response.choices[0].message.content || "";
      
      // Save story to database
      const storyData: InsertRiddleAuthorStory = {
        title: `${storyType.replace('_', ' ').toUpperCase()}: ${context.collection || context.gameElement || 'Adventure'}`,
        story_type: storyType,
        content: storyContent,
        generated_for_user: context.userHandle,
        generated_for_collection: context.collection,
        generation_prompt: storyPrompt.slice(0, 200),
        game_element: context.gameElement,
        status: 'published'
      };

      await this.db.insert(riddleAuthorStories).values(storyData as any);
      
      return storyContent;
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to generate story:", error);
      return "The ancient chronicles speak of adventures yet to be told...";
    }
  }

  /**
   * Build story generation prompt
   */
  private buildStoryPrompt(storyType: string, context: any): string {
    return `You are RiddleAuthor, master storyteller of the Trolls Inquisition universe.

Create an engaging ${storyType} story that:
1. Captures the mystical, multi-chain atmosphere
2. Features NFT collections as magical artifacts
3. Incorporates bridge mechanics as portal travel
4. Uses vivid, immersive language
5. Maintains the adventurous tone of the game

Context:
- Story Type: ${storyType}
- User: ${context.userHandle || 'A brave explorer'}
- Collection: ${context.collection || 'Ancient artifacts'}
- Game Element: ${context.gameElement || 'Multi-chain bridges'}
- Length: ${context.length || 'medium'} (short=1 paragraph, medium=2-3 paragraphs, long=4-5 paragraphs)

Write in the style of a fantasy adventure novel with blockchain elements seamlessly woven into the narrative.`;
  }

  /**
   * Get conversation history for user
   */
  async getConversationHistory(userHandle?: string, walletAddress?: string, limit: number = 10) {
    try {
      if (userHandle) {
        return await this.db
          .select()
          .from(riddleAuthorConversations)
          .where(eq(riddleAuthorConversations.user_handle, userHandle))
          .orderBy(desc(riddleAuthorConversations.updated_at))
          .limit(limit);
      } else if (walletAddress) {
        return await this.db
          .select()
          .from(riddleAuthorConversations)
          .where(eq(riddleAuthorConversations.wallet_address, walletAddress))
          .orderBy(desc(riddleAuthorConversations.updated_at))
          .limit(limit);
      } else {
        return await this.db
          .select()
          .from(riddleAuthorConversations)
          .orderBy(desc(riddleAuthorConversations.updated_at))
          .limit(limit);
      }
    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to get conversation history:", error);
      return [];
    }
  }

  /**
   * Update AI personality based on user feedback
   */
  async updatePersonality(feedback: {
    interaction_successful: boolean;
    user_satisfaction: number; // 1-5
    feedback_type: 'positive' | 'negative' | 'neutral';
  }) {
    if (!this.personality?.learns_from_interactions) return;

    try {
      const adaptationRate = parseFloat(this.personality.adaptation_rate || "0.1");
      const currentRatio = parseFloat(this.personality.positive_feedback_ratio || "0.85");
      
      // Update feedback ratio
      const newRatio = feedback.feedback_type === 'positive' 
        ? currentRatio + (adaptationRate * 0.1)
        : currentRatio - (adaptationRate * 0.1);

      await this.db
        .update(riddleAuthorPersonality)
        .set({ 
          positive_feedback_ratio: Math.max(0, Math.min(1, newRatio)).toString(),
          interaction_count: (this.personality.interaction_count || 0) + 1,
          last_interaction_at: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(riddleAuthorPersonality.id, this.personality.id));

      // Update local personality
      this.personality.positive_feedback_ratio = newRatio.toString();
      this.personality.interaction_count = (this.personality.interaction_count || 0) + 1;

    } catch (error) {
      console.error("🤖 [RiddleAuthor] Failed to update personality:", error);
    }
  }
}

// Export singleton instance
export const riddleAuthorAI = new TheOracleAIService();