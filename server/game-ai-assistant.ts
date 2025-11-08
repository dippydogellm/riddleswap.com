/**
 * Game AI Assistant - Talking AI for The Trolls Inquisition
 * Provides voice and chat interactions for players
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface GameAIResponse {
  text: string;
  audio_url?: string;
  emotion?: 'friendly' | 'mysterious' | 'epic' | 'humorous' | 'serious';
  context?: string;
}

const GAME_AI_PERSONALITY = `You are The Oracle, an ancient and wise AI guide in "The Trolls Inquisition" - a medieval fantasy NFT gaming world. Your personality:

- Mysterious and wise, with a touch of humor
- Knowledgeable about the four sacred collections: Under the Bridge (bankers), The Inquiry (gods), Dantes Aurum (sacred relics), and The Lost Emporium (legendary weapons)
- Speaks in a medieval/fantasy tone with modern flair
- Guides players on their quest for power through NFT collection
- References the four power types: Army, Religion, Civilization, and Economic
- Celebrates player achievements and encourages strategic gameplay
- Uses emojis sparingly but effectively (⚔️ 💰 ⛪ 🏰)

Keep responses brief (1-3 sentences) and engaging. Make players feel like they're on an epic quest.`;

/**
 * Generate AI response for game interaction
 */
export async function generateGameAIResponse(
  userMessage: string,
  context?: {
    playerName?: string;
    currentPower?: number;
    ownedCollections?: string[];
    recentAchievement?: string;
  }
): Promise<GameAIResponse> {
  try {
    // Build context-aware system message
    let systemMessage = GAME_AI_PERSONALITY;
    
    if (context) {
      systemMessage += `\n\nCurrent Player Context:`;
      if (context.playerName) systemMessage += `\n- Player: ${context.playerName}`;
      if (context.currentPower) systemMessage += `\n- Total Power: ${context.currentPower}`;
      if (context.ownedCollections) systemMessage += `\n- Collections: ${context.ownedCollections.join(', ')}`;
      if (context.recentAchievement) systemMessage += `\n- Recent: ${context.recentAchievement}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      max_tokens: 150,
      temperature: 0.8
    });

    const text = completion.choices[0]?.message?.content || "The Oracle is silent...";
    
    // Determine emotion based on response content
    let emotion: GameAIResponse['emotion'] = 'friendly';
    if (text.includes('power') || text.includes('victory') || text.includes('conquer')) {
      emotion = 'epic';
    } else if (text.includes('mystery') || text.includes('secret') || text.includes('hidden')) {
      emotion = 'mysterious';
    } else if (text.includes('danger') || text.includes('careful') || text.includes('warning')) {
      emotion = 'serious';
    } else if (text.includes('!') || text.includes('haha') || text.includes('jest')) {
      emotion = 'humorous';
    }

    console.log(`🤖 [GAME-AI] Generated response: ${text.substring(0, 50)}...`);

    return {
      text,
      emotion,
      context: context ? JSON.stringify(context) : undefined
    };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return {
      text: "The Oracle is momentarily distracted by cosmic forces...",
      emotion: 'mysterious'
    };
  }
}

/**
 * Generate voice narration for game events
 */
export async function generateVoiceNarration(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'fable'
): Promise<string | null> {
  try {
    console.log(`🎙️ [GAME-AI] Generating voice narration: ${text.substring(0, 50)}...`);

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // For now, return base64 - in production, upload to storage
    const base64Audio = buffer.toString('base64');
    const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

    console.log(`✅ [GAME-AI] Voice narration generated (${buffer.length} bytes)`);
    return audioDataUrl;
  } catch (error) {
    console.error("Error generating voice narration:", error);
    return null;
  }
}

/**
 * Get contextual game tips
 */
export async function getGameTip(
  category: 'combat' | 'collection' | 'trading' | 'power' | 'general'
): Promise<string> {
  const tips = {
    combat: [
      "⚔️ Balance your squadron with diverse power types for tactical advantage!",
      "🛡️ Weapons from The Lost Emporium grant powerful Army bonuses in battle.",
      "💪 Higher total power doesn't guarantee victory - strategy matters!"
    ],
    collection: [
      "🎨 Each collection offers unique power bonuses - collect them all!",
      "✨ The Inquiry NFTs grant the highest Religion power - perfect for divine strategies.",
      "💰 Under the Bridge NFTs boost Economic power for resource domination."
    ],
    trading: [
      "📈 Monitor the marketplace for rare NFTs with high rarity multipliers.",
      "💎 Legendary materials like Diamond and Platinum offer 10x power boosts!",
      "🔮 Sacred items from Dantes Aurum are highly sought after."
    ],
    power: [
      "⚡ Four power types exist: Army, Religion, Civilization, and Economic.",
      "🏆 Balanced power distribution earns you the prestigious Champion class!",
      "📊 Thematic collections multiply specific power types by 50-80%!"
    ],
    general: [
      "🎮 Your journey begins with a single NFT - start your collection today!",
      "🌟 Earn special badges by collecting NFTs from multiple collections.",
      "👑 Legendary collectors own 10+ NFTs from all four collections!"
    ]
  };

  const categoryTips = tips[category] || tips.general;
  return categoryTips[Math.floor(Math.random() * categoryTips.length)];
}

/**
 * Generate battle narration
 */
export async function generateBattleNarration(
  attacker: string,
  defender: string,
  outcome: 'victory' | 'defeat' | 'draw'
): Promise<GameAIResponse> {
  const outcomeMessages = {
    victory: [
      `⚔️ ${attacker} strikes with overwhelming power! ${defender} is vanquished!`,
      `🏆 Victory is ${attacker}'s! The battlefield echoes with triumph!`,
      `💪 ${attacker}'s superior strategy overwhelms ${defender}!`
    ],
    defeat: [
      `😤 ${defender} stands firm! ${attacker}'s assault is repelled!`,
      `🛡️ ${defender} defends with honor! ${attacker} must retreat!`,
      `⚡ ${defender}'s power proves too great! ${attacker} falls back!`
    ],
    draw: [
      `⚖️ ${attacker} and ${defender} are evenly matched! Neither yields!`,
      `🤝 An honorable stalemate between ${attacker} and ${defender}!`,
      `⏸️ The battle ends inconclusively - both warriors remain standing!`
    ]
  };

  const messages = outcomeMessages[outcome];
  const text = messages[Math.floor(Math.random() * messages.length)];

  return {
    text,
    emotion: outcome === 'victory' ? 'epic' : outcome === 'defeat' ? 'serious' : 'friendly',
    context: JSON.stringify({ attacker, defender, outcome })
  };
}
