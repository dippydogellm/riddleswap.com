/**
 * Game AI Assistant API Routes
 * Endpoints for talking AI in the game with chat history saving
 */

import { Router, Request, Response } from "express";
import {
  generateGameAIResponse,
  generateVoiceNarration,
  getGameTip,
  generateBattleNarration
} from "./game-ai-assistant";
import { db } from "./db";
import { riddleAuthorConversations, riddleAuthorMessages } from "../shared/schema";
import { nanoid } from "nanoid";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

/**
 * POST /api/game-ai/chat
 * Chat with The Oracle - saves conversation history
 */
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, context, conversationId, sessionId } = req.body;
    const userHandle = req.user?.userHandle || 'anonymous';
    const walletAddress = req.user?.walletAddress || null;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      const existing = await db.query.riddleAuthorConversations.findFirst({
        where: eq(riddleAuthorConversations.id, conversationId)
      });
      
      // SECURITY: Verify user owns this conversation
      if (existing && existing.user_handle !== userHandle) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized access to conversation"
        });
      }
      
      conversation = existing;
    }

    if (!conversation) {
      // Create new conversation
      const [newConv] = await db.insert(riddleAuthorConversations).values({
        id: nanoid(),
        user_handle: userHandle,
        wallet_address: walletAddress,
        session_id: sessionId || nanoid(),
        conversation_type: 'trolls_inquisition',
        conversation_title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        game_mode: true,
        enable_learning: true,
        status: 'active'
      }).returning();
      conversation = newConv;
    }

    // Save user message
    await db.insert(riddleAuthorMessages).values({
      id: nanoid(),
      conversation_id: conversation.id,
      message_role: 'user',
      content: message,
      token_count: Math.ceil(message.length / 4)
    });

    // Generate AI response
    const response = await generateGameAIResponse(message, context);

    // Save AI response
    await db.insert(riddleAuthorMessages).values({
      id: nanoid(),
      conversation_id: conversation.id,
      message_role: 'assistant',
      content: response.text,
      token_count: Math.ceil(response.text.length / 4),
      metadata: { emotion: response.emotion }
    });

    console.log(`💬 [ORACLE] Chat saved to conversation ${conversation.id}`);

    res.json({
      success: true,
      response,
      conversationId: conversation.id,
      messagesSaved: true
    });
  } catch (error: any) {
    console.error("Error in game AI chat:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/game-ai/narrate
 * Generate voice narration
 */
router.post("/narrate", async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text is required"
      });
    }

    const audioUrl = await generateVoiceNarration(text, voice);

    res.json({
      success: true,
      audio_url: audioUrl,
      text
    });
  } catch (error: any) {
    console.error("Error generating narration:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game-ai/tip/:category
 * Get a game tip
 */
router.get("/tip/:category", async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    
    const validCategories = ['combat', 'collection', 'trading', 'power', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    const tip = await getGameTip(category as any);

    res.json({
      success: true,
      category,
      tip
    });
  } catch (error: any) {
    console.error("Error getting game tip:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/game-ai/battle-narration
 * Generate battle narration
 */
router.post("/battle-narration", async (req: Request, res: Response) => {
  try {
    const { attacker, defender, outcome } = req.body;

    if (!attacker || !defender || !outcome) {
      return res.status(400).json({
        success: false,
        error: "Attacker, defender, and outcome are required"
      });
    }

    if (!['victory', 'defeat', 'draw'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: "Outcome must be: victory, defeat, or draw"
      });
    }

    const narration = await generateBattleNarration(attacker, defender, outcome);

    res.json({
      success: true,
      narration
    });
  } catch (error: any) {
    console.error("Error generating battle narration:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/game-ai/welcome
 * Generate welcome message for new player
 */
router.post("/welcome", async (req: Request, res: Response) => {
  try {
    const { playerName } = req.body;

    const welcomeMessage = `Welcome ${playerName || 'brave adventurer'}! Your quest begins in the realm of The Trolls Inquisition. Will you seek the divine power of The Inquiry gods, the military might of The Lost Emporium, the sacred relics of Dantes Aurum, or the economic dominance of Under the Bridge? Your destiny awaits!`;

    const response = await generateGameAIResponse(
      "What should I do first?",
      { playerName, currentPower: 0, ownedCollections: [] }
    );

    res.json({
      success: true,
      welcome_message: welcomeMessage,
      oracle_response: response
    });
  } catch (error: any) {
    console.error("Error generating welcome message:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game-ai/conversations/:userHandle
 * Get all conversations for a user
 */
router.get("/conversations/:userHandle", async (req: Request, res: Response) => {
  try {
    const { userHandle } = req.params;
    const { limit = 20 } = req.query;
    const authenticatedUser = req.user?.userHandle || 'anonymous';

    // SECURITY: Users can only access their own conversations
    if (userHandle !== authenticatedUser) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access to conversations"
      });
    }

    const conversations = await db.query.riddleAuthorConversations.findMany({
      where: eq(riddleAuthorConversations.user_handle, userHandle),
      orderBy: desc(riddleAuthorConversations.created_at),
      limit: Number(limit),
      with: {
        messages: {
          orderBy: desc(riddleAuthorMessages.created_at),
          limit: 1 // Get last message for preview
        }
      }
    });

    res.json({
      success: true,
      conversations,
      total: conversations.length
    });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game-ai/conversation/:conversationId
 * Get full conversation with all messages
 */
router.get("/conversation/:conversationId", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const authenticatedUser = req.user?.userHandle || 'anonymous';

    const conversation = await db.query.riddleAuthorConversations.findFirst({
      where: eq(riddleAuthorConversations.id, conversationId),
      with: {
        messages: {
          orderBy: riddleAuthorMessages.created_at
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    // SECURITY: Verify user owns this conversation
    if (conversation.user_handle !== authenticatedUser) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access to conversation"
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error: any) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game-ai/stories/:userHandle
 * Get saved stories (conversations marked as stories)
 */
router.get("/stories/:userHandle", async (req: Request, res: Response) => {
  try {
    const { userHandle } = req.params;
    const authenticatedUser = req.user?.userHandle || 'anonymous';

    // SECURITY: Users can only access their own stories
    if (userHandle !== authenticatedUser) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access to stories"
      });
    }

    const stories = await db.query.riddleAuthorConversations.findMany({
      where: and(
        eq(riddleAuthorConversations.user_handle, userHandle),
        eq(riddleAuthorConversations.conversation_type, 'game_narrative')
      ),
      orderBy: desc(riddleAuthorConversations.created_at),
      with: {
        messages: true
      }
    });

    res.json({
      success: true,
      stories,
      total: stories.length
    });
  } catch (error: any) {
    console.error("Error fetching stories:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
