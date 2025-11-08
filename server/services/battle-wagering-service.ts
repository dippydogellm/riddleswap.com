/**
 * Battle Wagering Service
 * Handles automated XRPL transactions for tournament prizes, entry fees, and winner payouts
 * Uses encrypted broker wallet (cached.xrp) for all transactions
 */

import { Client, Wallet, xrpToDrops, dropsToXrp, Payment } from 'xrpl';
import { db } from '../db';
import { battles, tournamentParticipants, tournaments, battleWagers } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { decryptWalletData } from '../wallet-encryption';

// SECURITY: Broker wallet configuration from environment
const BROKER_CONFIG = {
  address: process.env.RIDDLE_BROKER_ADDRESS || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X', // Broker wallet with private keys
  secret: process.env.RIDDLE_BROKER_SECRET || '', // Encrypted broker wallet seed
  password: process.env.BROKER_WALLET_PASSWORD || '', // Password to decrypt broker seed
  bankAddress: 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Bank wallet (receives deposits)
};

// RDL Token Configuration
const RDL_TOKEN = {
  currency: 'RDL',
  issuer: 'rGmTGT88Gxr4Z4Hv5c1CQkDpY4KFxhVXB3' // Update with actual RDL issuer
};

// XRPL Client (mainnet)
let xrplClient: Client | null = null;

/**
 * Initialize XRPL client
 */
async function getXRPLClient(): Promise<Client> {
  if (!xrplClient || !xrplClient.isConnected()) {
    xrplClient = new Client('wss://xrplcluster.com'); // Mainnet
    await xrplClient.connect();
    console.log('🔗 [Wagering] Connected to XRPL mainnet');
  }
  return xrplClient;
}

/**
 * Get broker wallet instance
 * Handles both encrypted (AES-256-GCM) and plain XRPL seeds
 */
function getBrokerWallet(): Wallet {
  if (!BROKER_CONFIG.secret) {
    throw new Error('RIDDLE_BROKER_SECRET not configured');
  }

  let walletSeed = BROKER_CONFIG.secret;

  // Check if secret is encrypted (JSON format with encryption metadata)
  try {
    const parsedSecret = JSON.parse(BROKER_CONFIG.secret);
    
    // If it has encryption metadata (salt, iv, encrypted), decrypt it
    if (parsedSecret.salt && parsedSecret.iv && (parsedSecret.encrypted || parsedSecret.encryptedData)) {
      if (!BROKER_CONFIG.password) {
        throw new Error('BROKER_WALLET_PASSWORD required for encrypted broker wallet');
      }
      
      console.log('🔓 [Wagering] Decrypting broker wallet seed...');
      walletSeed = decryptWalletData(parsedSecret, BROKER_CONFIG.password);
      console.log('✅ [Wagering] Broker wallet seed decrypted successfully');
    }
  } catch (parseError) {
    // Not JSON - assume it's a plain XRPL seed (starts with 's')
    if (!BROKER_CONFIG.secret.startsWith('s')) {
      console.warn('⚠️ [Wagering] RIDDLE_BROKER_SECRET format unclear - expecting XRPL seed starting with "s"');
    }
  }

  return Wallet.fromSeed(walletSeed);
}

/**
 * Send XRP payment
 */
async function sendXRPPayment(
  destinationAddress: string,
  amountXRP: string,
  memo?: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const client = await getXRPLClient();
    const brokerWallet = getBrokerWallet();

    console.log(`💸 [Wagering] Sending ${amountXRP} XRP to ${destinationAddress}`);

    const payment: Payment = {
      TransactionType: 'Payment',
      Account: brokerWallet.address,
      Destination: destinationAddress,
      Amount: xrpToDrops(amountXRP),
      Fee: '12' // Standard network fee
    };

    // Add memo if provided
    if (memo) {
      payment.Memos = [{
        Memo: {
          MemoData: Buffer.from(memo, 'utf-8').toString('hex')
        }
      }];
    }

    // Sign and submit
    const prepared = await client.autofill(payment);
    const signed = brokerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
      const txResult = result.result.meta.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [Wagering] Payment successful: ${result.result.hash}`);
        return { success: true, txHash: result.result.hash };
      }
    }

    throw new Error('Transaction failed');

  } catch (error: any) {
    console.error('❌ [Wagering] XRP payment failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send RDL token payment
 */
async function sendRDLPayment(
  destinationAddress: string,
  amountRDL: string,
  memo?: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const client = await getXRPLClient();
    const brokerWallet = getBrokerWallet();

    console.log(`💸 [Wagering] Sending ${amountRDL} RDL to ${destinationAddress}`);

    const payment: Payment = {
      TransactionType: 'Payment',
      Account: brokerWallet.address,
      Destination: destinationAddress,
      Amount: {
        currency: RDL_TOKEN.currency,
        value: amountRDL,
        issuer: RDL_TOKEN.issuer
      },
      Fee: '12'
    };

    if (memo) {
      payment.Memos = [{
        Memo: {
          MemoData: Buffer.from(memo, 'utf-8').toString('hex')
        }
      }];
    }

    const prepared = await client.autofill(payment);
    const signed = brokerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
      const txResult = result.result.meta.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [Wagering] RDL payment successful: ${result.result.hash}`);
        return { success: true, txHash: result.result.hash };
      }
    }

    throw new Error('Transaction failed');

  } catch (error: any) {
    console.error('❌ [Wagering] RDL payment failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tournament creator deposits prize pool
 */
export async function depositTournamentPrize(
  tournamentId: string,
  creatorAddress: string,
  prizeAmount: string,
  currency: 'XRP' | 'RDL'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log(`🏆 [Wagering] Processing tournament prize deposit for ${tournamentId}`);

    // Verify tournament exists
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // For now, assume creator sends directly to bank wallet
    // In production, this would verify an incoming transaction
    console.log(`💰 [Wagering] Tournament ${tournamentId} prize pool: ${prizeAmount} ${currency}`);
    console.log(`📍 [Wagering] Funds held in bank wallet: ${BROKER_CONFIG.bankAddress}`);

    // Update tournament to mark prize as funded
    await db.update(tournaments)
      .set({  
        total_prize_pool: prizeAmount,
        // Add funded status if needed
       } as any)
      .where(eq(tournaments.id, tournamentId));

    return { 
      success: true,
      txHash: 'DEPOSIT_CONFIRMED' // Replace with actual TX hash when verifying incoming payment
    };

  } catch (error: any) {
    console.error('❌ [Wagering] Prize deposit failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Collect entry fee from battle participant
 */
export async function collectEntryFee(
  battleId: string,
  participantAddress: string,
  entryFee: string,
  currency: 'XRP' | 'RDL'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log(`💳 [Wagering] Collecting entry fee for battle ${battleId}`);

    // In production, this would verify incoming payment from participant
    // For now, log the expected payment
    console.log(`📍 [Wagering] Expected payment: ${entryFee} ${currency} from ${participantAddress}`);
    console.log(`📍 [Wagering] Destination: ${BROKER_CONFIG.bankAddress}`);

    // Record wager in database (align with schema fields)
    await db.insert(battleWagers).values({
      battle_id: battleId,
      player_id: 'UNKNOWN_PLAYER', // TODO: Pass actual player_id when available
      amount: entryFee,
      currency,
      status: 'pending',
      deposited_at: new Date()
    } as any);

    return { 
      success: true,
      txHash: 'ENTRY_FEE_COLLECTED'
    };

  } catch (error: any) {
    console.error('❌ [Wagering] Entry fee collection failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Automatic payout to battle winner
 */
export async function payoutBattleWinner(
  battleId: string,
  winnerAddress: string,
  payoutAmount: string,
  currency: 'XRP' | 'RDL'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log(`🏅 [Wagering] Processing payout for battle ${battleId}`);

    // Verify battle exists and is completed
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.status !== 'completed') {
      throw new Error('Battle not completed yet');
    }

    // Send payment from broker wallet
    let result;
    if (currency === 'XRP') {
      result = await sendXRPPayment(
        winnerAddress,
        payoutAmount,
        `Battle ${battleId} winner prize`
      );
    } else {
      result = await sendRDLPayment(
        winnerAddress,
        payoutAmount,
        `Battle ${battleId} winner prize`
      );
    }

    if (!result.success) {
      throw new Error(result.error || 'Payment failed');
    }

    // NOTE: Database update is handled by the calling function (battle-routes.ts)
    // This service only performs the XRPL transaction and returns the result
    console.log(`✅ [Wagering] XRPL payout successful: ${result.txHash}`);
    return result;

  } catch (error: any) {
    console.error('❌ [Wagering] Payout failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Distribute tournament prizes to winners
 */
export async function distributeTournamentPrizes(
  tournamentId: string
): Promise<{ success: boolean; transactions: any[]; error?: string }> {
  try {
    console.log(`🏆 [Wagering] Distributing tournament prizes for ${tournamentId}`);

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Get winners (top 3)
    const participants = await db.query.tournamentParticipants.findMany({
      where: eq(tournamentParticipants.tournament_id, tournamentId)
    });

    const winners = participants
      .filter(p => p.final_rank && p.final_rank <= 3)
      .sort((a, b) => (a.final_rank || 999) - (b.final_rank || 999));

    if (winners.length === 0) {
      throw new Error('No winners found');
    }

    const transactions = [];

    // Pay each winner
    for (const winner of winners) {
      const prize = winner.final_rank === 1 ? tournament.first_place_prize :
                    winner.final_rank === 2 ? tournament.second_place_prize :
                    tournament.third_place_prize;

      if (!prize || parseFloat(prize) === 0) {
        console.log(`⚠️ [Wagering] No prize for rank ${winner.final_rank}, skipping`);
        continue;
      }

      // IDEMPOTENCY CHECK: Skip if already paid
      if (winner.prize_won && parseFloat(winner.prize_won) > 0) {
        console.log(`✅ [Wagering] Rank ${winner.final_rank} already paid (${winner.prize_won} XRP), skipping`);
        transactions.push({
          rank: winner.final_rank,
          amount: prize,
          success: true,
          txHash: 'ALREADY_PAID'
        });
        continue;
      }

      // Get winner's player data for wallet address
      const { gamingPlayers } = await import('@shared/schema');
      const player = await db.query.gamingPlayers.findFirst({
        where: eq(gamingPlayers.id, winner.player_id)
      });

      if (!player || !player.wallet_address) {
        console.error(`❌ [Wagering] Winner wallet address not found for rank ${winner.final_rank}`);
        transactions.push({
          rank: winner.final_rank,
          amount: prize,
          success: false,
          txHash: undefined,
          error: 'Wallet address not found'
        });
        continue;
      }

      // STEP 1: ATTEMPT XRPL PAYMENT FIRST
      const result = await sendXRPPayment(
        player.wallet_address,
        prize,
        `Tournament ${tournamentId} - Rank ${winner.final_rank} prize`
      );

      if (result.success) {
        // STEP 2: ONLY NOW update database (XRPL succeeded)
        await db.update(tournamentParticipants)
          .set({  prize_won: prize  } as any)
          .where(eq(tournamentParticipants.id, winner.id));

        console.log(`✅ [Wagering] Rank ${winner.final_rank}: ${prize} XRP sent to ${player.wallet_address}`);
      } else {
        console.error(`❌ [Wagering] Rank ${winner.final_rank} payout failed: ${result.error}`);
      }

      transactions.push({
        rank: winner.final_rank,
        amount: prize,
        success: result.success,
        txHash: result.txHash,
        error: result.error
      });
    }

    console.log(`✅ [Wagering] Tournament prizes distributed: ${transactions.length} payments`);
    return { success: true, transactions };

  } catch (error: any) {
    console.error('❌ [Wagering] Tournament prize distribution failed:', error);
    return { success: false, transactions: [], error: error.message };
  }
}

/**
 * Get broker wallet balance
 */
export async function getBrokerBalance(): Promise<{
  xrp: string;
  rdl?: string;
  error?: string;
}> {
  try {
    const client = await getXRPLClient();
    const brokerWallet = getBrokerWallet();

    const balance = await client.request({
      command: 'account_info',
      account: brokerWallet.address,
      ledger_index: 'validated'
    });

    const xrpBalance = dropsToXrp(balance.result.account_data.Balance);
    const xrpBalanceStr: string = typeof xrpBalance === 'string' ? xrpBalance : String(xrpBalance);

    console.log(`💰 [Wagering] Broker balance: ${xrpBalanceStr} XRP`);

    return { xrp: xrpBalanceStr };

  } catch (error: any) {
    console.error('❌ [Wagering] Failed to get broker balance:', error);
    return { xrp: '0', error: error.message };
  }
}

/**
 * Close XRPL connection
 */
export async function closeConnection() {
  if (xrplClient && xrplClient.isConnected()) {
    await xrplClient.disconnect();
    console.log('🔌 [Wagering] Disconnected from XRPL');
  }
}
