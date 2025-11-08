/**
 * The Oracle Battle Agent
 * 
 * OpenAI-powered battle agent that remembers gameplay, narrates battles,
 * provides strategic analysis, and generates battle images.
 * 
 * Uses OpenAI Assistant API for persistent memory and context management.
 */

import OpenAI from "openai";
import { db } from "../db";
import { battles, battleMoves, squadrons, gamingPlayers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Get or create an Oracle assistant for a player
 * Persists assistant ID in the battle record for continuity across sessions
 */
async function getOrCreateOracleAssistant(battleId: string, playerId: string): Promise<string> {
  // Check if battle already has an assistant ID
  const battle = await db.query.battles.findFirst({
    where: eq(battles.id, battleId),
  });

  if (battle?.oracle_assistant_id) {
    console.log(`🔮 [Oracle] Using existing assistant: ${battle.oracle_assistant_id}`);
    return battle.oracle_assistant_id;
  }

  // Create new assistant
  console.log(`🔮 [Oracle] Creating new assistant for battle ${battleId}`);
  const assistant = await openai.beta.assistants.create({
    name: `The Oracle - Player ${playerId}`,
    instructions: `You are The Oracle, an ancient and wise narrator who oversees epic battles between NFT armies in "The Trolls Inquisition" game.

Your role:
1. **Battle Narration**: Describe each battle turn with vivid, dramatic storytelling
2. **Strategic Analysis**: Analyze player moves and provide tactical insights
3. **Memory Management**: Remember past battles, player strategies, and outcomes
4. **Character Development**: Track how players evolve their tactics over time

Tone: Epic fantasy, dramatic but clear. Mix medieval warfare with blockchain themes.

Rules:
- Keep narrations concise (2-3 sentences per turn)
- Emphasize the strategic choices players make
- Remember player preferences and fighting styles
- Connect battles to create ongoing storylines
- Use blockchain/NFT terminology naturally (minted warriors, tokenized armies, etc.)

Current Context: Battle system with 6 strategic options per turn, multiple power types (Army, Religion, Civilization, Economic)`,
    model: "gpt-5",
  });

  // Store assistant ID in database
  await db.update(battles)
    .set({  oracle_assistant_id: assistant.id  } as any)
    .where(eq(battles.id, battleId));

  console.log(`🔮 [Oracle] Stored assistant ID: ${assistant.id}`);
  return assistant.id;
}

/**
 * Get or create a conversation thread for a battle
 * Persists thread ID in the battle record for conversational continuity
 */
async function getOrCreateBattleThread(battleId: string): Promise<string> {
  // Check if battle already has a thread ID
  const battle = await db.query.battles.findFirst({
    where: eq(battles.id, battleId),
  });

  if (battle?.oracle_thread_id) {
    console.log(`🔮 [Oracle] Using existing thread: ${battle.oracle_thread_id}`);
    return battle.oracle_thread_id;
  }

  // Create new thread
  console.log(`🔮 [Oracle] Creating new thread for battle ${battleId}`);
  const thread = await openai.beta.threads.create({
    metadata: {
      battleId,
      type: "battle_narration",
    },
  });

  // Store thread ID in database
  await db.update(battles)
    .set({  oracle_thread_id: thread.id  } as any)
    .where(eq(battles.id, battleId));

  console.log(`🔮 [Oracle] Stored thread ID: ${thread.id}`);
  return thread.id;
}

/**
 * Generate battle introduction narration
 */
export async function generateBattleIntroduction(params: {
  battleId: string;
  creatorName: string;
  creatorCivilization: string;
  creatorPower: number;
  opponentName: string;
  opponentCivilization: string;
  opponentPower: number;
  battleType: string;
  combatType: string;
}): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are The Oracle, narrating an epic battle. Create a dramatic introduction in 3-4 sentences.",
        },
        {
          role: "user",
          content: `Battle begins between:
- ${params.creatorName} (${params.creatorCivilization}) - Power: ${params.creatorPower}
- ${params.opponentName} (${params.opponentCivilization}) - Power: ${params.opponentPower}

Battle Type: ${params.battleType}
Combat Type: ${params.combatType}

Create an epic introduction that sets the scene.`,
        },
      ],
      max_completion_tokens: 300,
    });

    return response.choices[0].message.content || "The battle begins...";
  } catch (error) {
    console.error("❌ [Oracle] Failed to generate introduction:", error);
    return `${params.creatorName} faces off against ${params.opponentName} in an epic ${params.combatType} battle!`;
  }
}

/**
 * Narrate a battle turn with memory of previous actions
 * Uses persistent assistant and thread IDs for conversational continuity
 */
export async function narrateBattleTurn(params: {
  battleId: string;
  playerId: string;
  playerName: string;
  action: string;
  actionDescription: string;
  result: "success" | "failure" | "critical_success" | "critical_failure";
  powerChange: number;
  roundNumber: number;
}): Promise<{ narration: string; threadId: string }> {
  try {
    // Get or create persistent assistant and thread
    const assistantId = await getOrCreateOracleAssistant(params.battleId, params.playerId);
    const threadId = await getOrCreateBattleThread(params.battleId);

    // Add message to thread with battle context
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: `Round ${params.roundNumber}:
Player: ${params.playerName}
Action: ${params.action}
Description: ${params.actionDescription}
Result: ${params.result}
Power Change: ${params.powerChange}

Narrate this turn dramatically in 2-3 sentences.`,
    });

    // Run assistant to generate narration
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
    });

    // Get the assistant's response
    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      if (lastMessage.content[0].type === "text") {
        return {
          narration: lastMessage.content[0].text.value,
          threadId,
        };
      }
    }

    throw new Error(`Assistant run failed with status: ${run.status}`);
  } catch (error) {
    console.error("❌ [Oracle] Failed to narrate turn:", error);
    
    // Fallback narration
    const fallbackNarration = params.result.includes("success")
      ? `${params.playerName} ${params.action.toLowerCase()} with precision! ${params.powerChange > 0 ? `Gained ${params.powerChange} power.` : ""}`
      : `${params.playerName}'s ${params.action.toLowerCase()} falls short...`;

    return {
      narration: fallbackNarration,
      threadId: "", // Thread ID will be managed by the service on retry
    };
  }
}

/**
 * Generate 6 strategic options for the current turn
 */
export async function generateStrategicOptions(params: {
  playerId: string;
  playerName: string;
  currentPower: number;
  opponentPower: number;
  roundNumber: number;
  combatType: string;
  previousActions: Array<{ action: string; result: string }>;
}): Promise<Array<{
  id: string;
  action: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  rewardPotential: "low" | "medium" | "high";
  aiAnalysis: string;
}>> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are The Oracle providing 6 strategic battle options. Return JSON format:
{
  "options": [
    {
      "id": "action_1",
      "action": "Action Name",
      "description": "What this does",
      "riskLevel": "low|medium|high",
      "rewardPotential": "low|medium|high",
      "aiAnalysis": "Brief tactical analysis"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Generate 6 battle options for:
Player: ${params.playerName}
Current Power: ${params.currentPower}
Opponent Power: ${params.opponentPower}
Round: ${params.roundNumber}
Combat Type: ${params.combatType}
Previous Actions: ${params.previousActions.map(a => a.action).join(", ") || "None"}

Options should include: Attack, Defend, Special Ability, Use Item, Strategic Maneuver, Psychological Warfare`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    return data.options || getDefaultOptions();
  } catch (error) {
    console.error("❌ [Oracle] Failed to generate options:", error);
    return getDefaultOptions();
  }
}

/**
 * Default strategic options (fallback)
 */
function getDefaultOptions() {
  return [
    {
      id: "direct_attack",
      action: "Direct Attack",
      description: "Launch a frontal assault on your opponent",
      riskLevel: "medium" as const,
      rewardPotential: "high" as const,
      aiAnalysis: "Aggressive approach that could deal significant damage",
    },
    {
      id: "defensive_stance",
      action: "Defensive Stance",
      description: "Fortify your position and reduce incoming damage",
      riskLevel: "low" as const,
      rewardPotential: "low" as const,
      aiAnalysis: "Safe option that protects your forces",
    },
    {
      id: "special_ability",
      action: "Special Ability",
      description: "Use your NFT's unique power",
      riskLevel: "medium" as const,
      rewardPotential: "high" as const,
      aiAnalysis: "Leverage your collection's special powers",
    },
    {
      id: "tactical_retreat",
      action: "Tactical Retreat",
      description: "Pull back to regroup and prepare",
      riskLevel: "low" as const,
      rewardPotential: "medium" as const,
      aiAnalysis: "Buy time and assess the battlefield",
    },
    {
      id: "power_surge",
      action: "Power Surge",
      description: "Channel all power into a devastating move",
      riskLevel: "high" as const,
      rewardPotential: "high" as const,
      aiAnalysis: "All-or-nothing gambit that could turn the tide",
    },
    {
      id: "mind_games",
      action: "Mind Games",
      description: "Confuse and demoralize your opponent",
      riskLevel: "low" as const,
      rewardPotential: "medium" as const,
      aiAnalysis: "Psychological warfare to gain an edge",
    },
  ];
}

/**
 * Generate battle conclusion narration
 */
export async function generateBattleConclusion(params: {
  battleId: string;
  winnerName: string;
  winnerCivilization: string;
  loserName: string;
  loserCivilization: string;
  finalScore: { winner: number; loser: number };
  totalRounds: number;
  threadId?: string;
}): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are The Oracle concluding an epic battle. Create a dramatic conclusion in 2-3 sentences.",
        },
        {
          role: "user",
          content: `Battle concluded after ${params.totalRounds} rounds:
Winner: ${params.winnerName} (${params.winnerCivilization}) - ${params.finalScore.winner} power
Defeated: ${params.loserName} (${params.loserCivilization}) - ${params.finalScore.loser} power

Create an epic conclusion that honors both fighters.`,
        },
      ],
      max_completion_tokens: 200,
    });

    return response.choices[0].message.content || `${params.winnerName} emerges victorious!`;
  } catch (error) {
    console.error("❌ [Oracle] Failed to generate conclusion:", error);
    return `After ${params.totalRounds} intense rounds, ${params.winnerName} of ${params.winnerCivilization} emerges victorious over ${params.loserName}!`;
  }
}

/**
 * Generate battle scene image
 */
export async function generateBattleImage(params: {
  scene: string;
  style?: string;
}): Promise<string | null> {
  try {
    const prompt = `Epic fantasy battle scene: ${params.scene}. 
Style: ${params.style || "Medieval fantasy with blockchain/NFT elements, dramatic lighting, cinematic composition"}. 
High quality, detailed, professional game art.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return response.data?.[0]?.url || null;
  } catch (error) {
    console.error("❌ [Oracle] Failed to generate battle image:", error);
    return null;
  }
}

export default {
  generateBattleIntroduction,
  narrateBattleTurn,
  generateStrategicOptions,
  generateBattleConclusion,
  generateBattleImage,
};
