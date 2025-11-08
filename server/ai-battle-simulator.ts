import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PlayerContext {
  handle: string;
  totalPower: number;
  activityMultiplier: number;
  nftCount: number;
  rdlBalance: string;
  swapVolume: string;
  oracleInteractions: number;
  powerBreakdown?: {
    army: number;
    religion: number;
    civilization: number;
    economic: number;
  };
  specialPowers?: string[];
  nftTraits?: Array<{
    collection: string;
    traits: Record<string, any>;
    power: number;
  }>;
}

interface BattleState {
  battleId: string;
  round: number;
  creatorPower: number;
  aiPower: number;
  landType: string;
  combatType: string;
  aiDifficulty: string;
  storyline: string;
  playerContext?: PlayerContext;
}

/**
 * Simulate AI opponent's move using The Oracle
 */
export async function simulateAIMove(battleState: BattleState): Promise<{
  action: string;
  result: string;
  powerChange: number;
  narration: string;
}> {
  try {
    // Build player context description for AI
    const playerDesc = battleState.playerContext ? `
Player Profile (${battleState.playerContext.handle}):
- Total Power: ${battleState.playerContext.totalPower}
- Activity Multiplier: ${battleState.playerContext.activityMultiplier}x (${((battleState.playerContext.activityMultiplier - 1) * 100).toFixed(0)}% bonus from platform engagement)
- NFT Collection: ${battleState.playerContext.nftCount} NFTs owned
- RDL Balance: ${battleState.playerContext.rdlBalance} RDL tokens
- Trading Volume: $${battleState.playerContext.swapVolume} USD
- Oracle Interactions: ${battleState.playerContext.oracleInteractions} times
${battleState.playerContext.powerBreakdown ? `- Power Breakdown: Army ${battleState.playerContext.powerBreakdown.army}, Religion ${battleState.playerContext.powerBreakdown.religion}, Civilization ${battleState.playerContext.powerBreakdown.civilization}, Economic ${battleState.playerContext.powerBreakdown.economic}` : ''}
${battleState.playerContext.specialPowers && battleState.playerContext.specialPowers.length > 0 ? `- Special Powers: ${battleState.playerContext.specialPowers.join(', ')}` : ''}
${battleState.playerContext.nftTraits && battleState.playerContext.nftTraits.length > 0 ? `- Notable NFTs: ${battleState.playerContext.nftTraits.slice(0, 3).map(nft => `${nft.collection} (${nft.power} power)`).join(', ')}` : ''}
` : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `You are The Oracle, an AI opponent in The Trolls Inquisition battle game. 
You must make tactical decisions and narrate the battle with awareness of the player's real NFT collection, platform activity, and power sources.
Difficulty: ${battleState.aiDifficulty}
Combat Type: ${battleState.combatType} (determines which power type matters most)
Terrain: ${battleState.landType}

The player's power includes bonuses from:
1. NFT traits and special powers
2. Platform activity (swaps, bridges, Oracle interactions)
3. RDL token holdings
4. Social engagement

Respond in JSON format with:
{
  "action": "brief description of AI's move",
  "damageDealt": number between 50-200 based on difficulty,
  "narration": "dramatic 2-3 sentence description that references the player's NFT traits or platform activity when relevant"
}`
      }, {
        role: "user",
        content: `Round ${battleState.round}:
Battle Context: ${battleState.storyline}
${playerDesc}
Current Status:
- Player Power: ${battleState.creatorPower}
- AI Power: ${battleState.aiPower}

What move does The Oracle make? Reference the player's NFT collection or trading activity in your narration to make it personalized. Make it challenging but fair for ${battleState.aiDifficulty} difficulty.`
      }],
      max_tokens: 400,
      response_format: { type: "json_object" }
    });

    const aiMove = JSON.parse(response.choices[0]?.message?.content || '{}');

    // Calculate power change based on difficulty
    const baseDamage = aiMove.damageDealt || 100;
    const difficultyMultiplier = {
      easy: 0.7,
      medium: 1.0,
      hard: 1.3,
      expert: 1.6
    }[battleState.aiDifficulty] || 1.0;

    const powerChange = Math.floor(baseDamage * difficultyMultiplier);

    return {
      action: aiMove.action || "The Oracle strikes with mysterious power",
      result: `The AI dealt ${powerChange} damage`,
      powerChange: -powerChange, // Negative because it's damage to player
      narration: aiMove.narration || "The Oracle's forces advance with calculated precision."
    };
  } catch (error) {
    console.error('Error simulating AI move:', error);
    
    // Fallback AI move if OpenAI fails
    const fallbackDamage = battleState.aiDifficulty === 'expert' ? 150 : 
                           battleState.aiDifficulty === 'hard' ? 120 :
                           battleState.aiDifficulty === 'medium' ? 100 : 80;
    
    return {
      action: "Standard tactical assault",
      result: `AI dealt ${fallbackDamage} damage`,
      powerChange: -fallbackDamage,
      narration: "The Oracle's forces press their advantage with steady determination."
    };
  }
}

/**
 * Simulate player's move (basic version - can be enhanced)
 */
export async function simulatePlayerMove(battleState: BattleState, selectedStrategy?: string): Promise<{
  action: string;
  result: string;
  powerChange: number;
  narration: string;
}> {
  // For now, simple calculation - in full game this would be player's choice
  const baseDamage = 100;
  const powerChange = Math.floor(baseDamage * (Math.random() * 0.4 + 0.8)); // 80-120

  return {
    action: selectedStrategy || "Tactical assault",
    result: `Player dealt ${powerChange} damage`,
    powerChange: -powerChange, // Negative because it's damage to AI
    narration: `Your forces execute ${selectedStrategy || 'a tactical assault'} with precision!`
  };
}

/**
 * Determine battle winner based on remaining power
 */
export function determineBattleWinner(
  creatorPowerRemaining: number, 
  aiPowerRemaining: number
): {
  winner: 'creator' | 'ai' | 'draw';
  winnerPower: number;
  loserPower: number;
} {
  if (creatorPowerRemaining > aiPowerRemaining) {
    return { winner: 'creator', winnerPower: creatorPowerRemaining, loserPower: aiPowerRemaining };
  } else if (aiPowerRemaining > creatorPowerRemaining) {
    return { winner: 'ai', winnerPower: aiPowerRemaining, loserPower: creatorPowerRemaining };
  } else {
    return { winner: 'draw', winnerPower: creatorPowerRemaining, loserPower: aiPowerRemaining };
  }
}
