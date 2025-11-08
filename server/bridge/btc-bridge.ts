// Bitcoin Bridge Handler - REAL TRANSACTIONS ONLY
import { db } from '../db';
import { bridge_payloads, riddleWallets } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { BridgeExchangeRates } from './exchange-rates';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import fetch from 'node-fetch';

const ECPair = ECPairFactory(ecc);

const BTC_CONFIG = {
  network: bitcoin.networks.bitcoin,
  bankAddress: '1PprcSuMKYC7vE8sirp93p1CgQPrmp4qeL', // Updated bank address
  rpcUrl: 'https://blockchain.info/api' // Using blockchain.info API
};

export class BTCBridgeHandler {
  
  /**
   * Estimate dynamic Bitcoin network fees based on current mempool conditions
   */
  static async estimateDynamicFee(utxoCount: number = 2): Promise<number> {
    try {
      console.log('⚡ Estimating dynamic Bitcoin fees...');
      
      // Try to get fee estimates from mempool.space
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://mempool.space/api/v1/fees/recommended', {
        headers: { 'User-Agent': 'Bitcoin-Bridge/1.0' },
        signal: controller.signal
      }).catch(() => {
        clearTimeout(timeoutId);
        return null;
      });
      
      if (response) clearTimeout(timeoutId);
      
      let feeRate = 20; // Default fallback: 20 sats/vByte
      
      if (response && response.ok) {
        const feeData = await response.json() as any;
        // Use "economy" rate for cost efficiency, with minimum of 10 sat/vB
        feeRate = Math.max(10, feeData.economyFee || 15);
        console.log(`💰 Dynamic fee rate: ${feeRate} sats/vByte (economy)`);
      } else {
        console.log('⚠️ Fee API failed, using fallback: 20 sats/vByte');
      }
      
      // Estimate transaction size in virtual bytes
      // P2WPKH: ~140 vBytes per input + ~34 vBytes per output + ~10 vBytes base
      const inputSize = utxoCount * 68; // ~68 vBytes per P2WPKH input
      const outputSize = 2 * 31; // 2 outputs (destination + change) * ~31 vBytes each  
      const baseSize = 10; // Base transaction overhead
      const estimatedVBytes = inputSize + outputSize + baseSize;
      
      const dynamicFee = Math.ceil(estimatedVBytes * feeRate);
      
      // Apply reasonable bounds: minimum 5000 sats, maximum 50000 sats
      const boundedFee = Math.min(Math.max(dynamicFee, 5000), 50000);
      
      console.log(`⚡ Fee calculation: ${utxoCount} inputs × 68vB + 2 outputs × 31vB + 10vB base = ${estimatedVBytes}vB`);
      console.log(`⚡ Dynamic fee: ${estimatedVBytes}vB × ${feeRate} sats/vB = ${dynamicFee} sats (bounded: ${boundedFee} sats)`);
      
      return boundedFee;
      
    } catch (error) {
      console.warn('⚠️ Dynamic fee estimation failed, using conservative fallback:', error);
      // Conservative fallback - higher than old static fee for safety
      return 20000; // 20,000 sats ≈ $20 at current prices
    }
  }
  
  /**
   * Perform UTXO preflight check to validate wallet balance before transaction
   */
  static async performUTXOPreflightCheck(params: {
    btcAddress: string;
    amount: number;
    transactionId: string;
  }) {
    try {
      console.log('🔍 Performing UTXO preflight check for:', params.btcAddress);
      
      const { btcAddress, amount, transactionId } = params;
      
      // Get UTXOs for the address
      const utxos = await this.getUTXOs(btcAddress);
      
      // Calculate required amounts
      const satoshiAmount = Math.round(amount * 100000000);
      const estimatedFee = await this.estimateDynamicFee(utxos.length); // Dynamic fee estimation
      const totalRequired = satoshiAmount + estimatedFee;
      
      // Calculate total available balance
      const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      
      console.log(`₿ UTXO Analysis for ${btcAddress}:`);
      console.log(`   - UTXOs found: ${utxos.length}`);
      console.log(`   - Total balance: ${totalBalance} sats (${(totalBalance / 100000000).toFixed(8)} BTC)`);
      console.log(`   - Amount needed: ${satoshiAmount} sats (${amount} BTC)`);
      console.log(`   - Estimated fee: ${estimatedFee} sats`);
      console.log(`   - Total required: ${totalRequired} sats`);
      console.log(`   - Sufficient funds: ${totalBalance >= totalRequired}`);
      
      const result = {
        success: totalBalance >= totalRequired,
        utxoCount: utxos.length,
        totalBalance,
        balanceBTC: totalBalance / 100000000,
        requiredAmount: satoshiAmount,
        estimatedFee,
        totalRequired,
        shortfallSats: Math.max(0, totalRequired - totalBalance),
        shortfallBTC: Math.max(0, (totalRequired - totalBalance) / 100000000),
        utxos
      };
      
      if (result.success) {
        console.log('✅ UTXO preflight check PASSED - sufficient funds available');
        // Update status to 'ready' - funds are available for transaction
        await db.update(bridge_payloads)
          .set({ 
            status: 'ready',
            step: 2,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
      } else {
        console.log('⚠️ UTXO preflight check FAILED - insufficient funds');
        const fundingInstructions = this.generateFundingInstructions(result, btcAddress);
        
        // Update status to 'awaiting_funding' with instructions
        await db.update(bridge_payloads)
          .set({ 
            status: 'awaiting_funding',
            step: 1,
            errorMessage: fundingInstructions,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ UTXO preflight check failed:', error);
      
      // Update status to failed with error details
      await db.update(bridge_payloads)
        .set({
          status: 'failed',
          errorMessage: `UTXO check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          updatedAt: new Date()
        })
        .where(eq(bridge_payloads.transaction_id, params.transactionId))
        .catch(dbError => console.error('Failed to update bridge status:', dbError));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'UTXO preflight check failed',
        utxoCount: 0,
        totalBalance: 0,
        balanceBTC: 0
      };
    }
  }
  
  /**
   * Generate clear funding instructions for insufficient balance
   */
  static generateFundingInstructions(utxoResult: any, btcAddress: string): string {
    const { shortfallBTC, totalRequired, estimatedFee } = utxoResult;
    
    return `Insufficient Bitcoin balance. Please send ${shortfallBTC.toFixed(8)} BTC to address ${btcAddress} to complete this transaction. ` +
           `Required: ${(totalRequired / 100000000).toFixed(8)} BTC (including ${(estimatedFee / 100000000).toFixed(8)} BTC network fee). ` +
           `Current balance: ${utxoResult.balanceBTC.toFixed(8)} BTC.`;
  }
  
  /**
   * Check if bridge transaction is ready to execute (has sufficient UTXOs)
   */
  static async checkTransactionReadiness(transactionId: string, btcAddress: string, amount: number) {
    try {
      console.log('🔍 Checking transaction readiness for:', transactionId);
      
      // Get current bridge status
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgeData) {
        throw new Error('Bridge transaction not found');
      }
      
      console.log(`₿ Current bridge status: ${bridgeData.status}`);
      
      // If already completed or failed, return current status
      if (['completed', 'failed', 'verified'].includes(bridgeData.status as string)) {
        return {
          ready: bridgeData.status === 'verified' || bridgeData.status === 'completed',
          status: bridgeData.status,
          message: `Transaction already ${bridgeData.status}`
        };
      }
      
      // Perform fresh UTXO check
      const utxoCheck = await this.performUTXOPreflightCheck({
        btcAddress,
        amount,
        transactionId
      });
      
      return {
        ready: utxoCheck.success,
        status: utxoCheck.success ? 'ready' : 'awaiting_funding',
        utxoCheck,
        message: utxoCheck.success 
          ? 'Transaction ready to execute'
          : 'Waiting for sufficient funding'
      };
      
    } catch (error) {
      console.error('❌ Readiness check failed:', error);
      return {
        ready: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Readiness check failed'
      };
    }
  }
  
  /**
   * Create Bitcoin bridge payload for Riddle Wallet
   */
  static async createBTCBridge(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    destinationAddress: string;
    walletType: 'riddle' | 'walletconnect';
    riddleWalletId?: string;
    walletHandle?: string;
    sessionToken?: string;
    cachedKeys?: any;
  }) {
    try {
      console.log('₿ Creating Bitcoin bridge payload:', params);
      
      const { fromToken, toToken, amount, destinationAddress, walletType, riddleWalletId, walletHandle, sessionToken, cachedKeys } = params;
      
      const transactionId = crypto.randomUUID();
      const numAmount = parseFloat(amount);
      
      // Get real-time exchange rate with 1% fee included
      const exchangeRate = await BridgeExchangeRates.getExchangeRate(fromToken, toToken, numAmount);
      const outputAmount = exchangeRate.rate * numAmount;
      const bridgeFee = exchangeRate.totalFee;
      
      console.log(`💱 Bitcoin Exchange rate: 1 ${fromToken} = ${exchangeRate.rate} ${toToken} (after 1% fee)`);
      console.log(`💰 Output: ${numAmount} ${fromToken} = ${outputAmount} ${toToken}`);
      
      // Store bridge payload WITH FEE - using SQL for compatibility
      await db.execute(sql`
        INSERT INTO bridge_payloads (
          transaction_id, uuid, step, status, userwalletaddress, 
          destinationaddress, fromcurrency, tocurrency, amount, outputamount,
          platform_fee, fee_amount, wallet_type, riddle_wallet_id
        ) VALUES (
          ${transactionId}, ${crypto.randomUUID()}, 1, 'pending', 
          ${destinationAddress}, ${destinationAddress}, ${fromToken.toUpperCase()}, 
          ${toToken.toUpperCase()}, ${amount}, ${outputAmount.toString()},
          ${exchangeRate.platformFee}, ${bridgeFee}, ${walletType}, ${riddleWalletId || null}
        )
      `);
      
      console.log(`💰 Bitcoin Bridge Payload Created with Fee:`);
      console.log(`   - Input: ${amount} ${fromToken}`);
      console.log(`   - Platform Fee (1%): ${bridgeFee} ${toToken}`);
      console.log(`   - Output After Fee: ${outputAmount} ${toToken}`);
      
      if (walletType === 'riddle' && cachedKeys?.btcAddress) {
        // Use session-cached BTC private key only - no decryption fallback  
        const btcPrivateKey = cachedKeys.btcPrivateKey;
        
        if (!btcPrivateKey) {
          throw new Error('BTC private key not available in session cache');
        }
        
        // Use static bank address for Bitcoin bridge
        const bankAddress = BTC_CONFIG.bankAddress;
        
        const payload = {
          fromAddress: cachedKeys.btcAddress,
          toAddress: bankAddress,
          amount: numAmount,
          transactionId,
          network: 'bitcoin',
          instructions: `Send ${amount} BTC to ${bankAddress} with transaction ID: ${transactionId}`
        };
        
        // Perform UTXO preflight check immediately
        console.log('🔍 Performing initial UTXO preflight check...');
        const utxoCheck = await this.performUTXOPreflightCheck({
          btcAddress: cachedKeys.btcAddress,
          amount: numAmount,
          transactionId
        });
        
        return {
          success: true,
          transactionId,
          payload,
          bankAddress,
          amount,
          outputAmount,
          bridgeFee,
          fromToken,
          toToken,
          instructions: payload.instructions,
          utxoCheck,
          readyToExecute: utxoCheck.success,
          fundingRequired: !utxoCheck.success,
          fundingInstructions: utxoCheck.success ? null : this.generateFundingInstructions(
            utxoCheck,
            cachedKeys.btcAddress
          )
        };
      }
      
      return {
        success: true,
        transactionId,
        amount,
        outputAmount,
        bridgeFee,
        fromToken,
        toToken,
        message: 'Bitcoin bridge created - requires wallet connection'
      };
      
    } catch (error) {
      console.error('❌ Bitcoin bridge creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bitcoin bridge creation failed'
      };
    }
  }
  
  /**
   * Execute Bitcoin transaction using session-cached keys only - with UTXO preflight
   */
  static async executeBTCTransactionWithCachedKeys(transactionId: string, sessionToken?: string, forceExecute: boolean = false) {
    try {
      console.log('₿ Executing Bitcoin transaction with cached keys:', { transactionId, hasSession: !!sessionToken, forceExecute });
      
      // Get bridge payload from database
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgeData) {
        throw new Error('Bridge payload not found');
      }
      
      if (['completed', 'verified'].includes(bridgeData.status as string)) {
        console.log('₿ Bitcoin Bridge already completed, returning existing hash');
        return {
          success: true,
          transactionHash: bridgeData.tx_hash || bridgeData.txHash,
          status: bridgeData.status,
          message: 'Transaction already completed'
        };
      }
      
      if (!sessionToken) {
        throw new Error('Session token required for Bitcoin bridge execution');
      }
      
      const authModule = await import('../riddle-wallet-auth');
      const session = authModule.getActiveSession(sessionToken);
      
      if (!session || !session.cachedKeys) {
        throw new Error('Invalid session or no cached keys available');
      }
      
      if (Date.now() > session.expiresAt) {
        throw new Error('Session expired');
      }
      
      const { handle, cachedKeys } = session;
      console.log('₿ Retrieved session for:', handle);
      
      const btcPrivateKey = cachedKeys.btcPrivateKey;
      const btcAddress = cachedKeys.btcAddress;
      
      if (!btcPrivateKey || !btcAddress) {
        throw new Error('BTC private key or address not found in session cache');
      }
      
      // Check transaction readiness unless force execute
      if (!forceExecute) {
        console.log('🔍 Checking transaction readiness before execution...');
        const readinessCheck = await this.checkTransactionReadiness(
          transactionId,
          btcAddress,
          parseFloat(bridgeData.amount as string)
        );
        
        if (!readinessCheck.ready) {
          console.log('⚠️ Transaction not ready for execution:', readinessCheck.status);
          return {
            success: false,
            status: readinessCheck.status,
            error: readinessCheck.message || 'Transaction not ready for execution',
            needsFunding: readinessCheck.status === 'awaiting_funding',
            utxoCheck: readinessCheck.utxoCheck
          };
        }
        
        console.log('✅ Transaction ready for execution');
      }
      
      // Use static bank address for Bitcoin bridge
      const bankAddress = BTC_CONFIG.bankAddress;
      
      // Parse user's private key
      let userKeyPair: any;
      try {
        // Handle different private key formats
        if (btcPrivateKey.includes(',')) {
          // Comma-separated bytes format
          const keyBytes = btcPrivateKey.split(',').map((b: string) => parseInt(b.trim()));
          userKeyPair = ECPair.fromPrivateKey(Buffer.from(keyBytes), { network: BTC_CONFIG.network });
        } else if (btcPrivateKey.startsWith('0x')) {
          // Hex format with 0x prefix (from session cache)
          const hexKey = btcPrivateKey.slice(2); // Remove 0x prefix
          userKeyPair = ECPair.fromPrivateKey(Buffer.from(hexKey, 'hex'), { network: BTC_CONFIG.network });
        } else if (btcPrivateKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(btcPrivateKey)) {
          // Plain hex format (64 chars)
          userKeyPair = ECPair.fromPrivateKey(Buffer.from(btcPrivateKey, 'hex'), { network: BTC_CONFIG.network });
        } else {
          // WIF format
          userKeyPair = ECPair.fromWIF(btcPrivateKey, BTC_CONFIG.network);
        }
      } catch (e) {
        throw new Error(`Invalid BTC private key format: ${e}`);
      }
      
      // Use P2PKH (legacy) address format to match stored address (1...)
      const { address: userAddress } = bitcoin.payments.p2pkh({ 
        pubkey: Buffer.from(userKeyPair.publicKey), 
        network: BTC_CONFIG.network 
      });
      
      console.log(`₿ Bitcoin transaction details:`);
      console.log(`   - From: ${userAddress}`);
      console.log(`   - To: ${bankAddress}`);
      console.log(`   - Amount: ${bridgeData.amount} BTC`);
      console.log(`   - Transaction ID: ${transactionId}`);
      
      // Create and broadcast REAL Bitcoin transaction
      try {
        const txHash = await this.createAndBroadcastBTCTransaction(
          userKeyPair,
          bankAddress,
          parseFloat(bridgeData.amount as string),
          transactionId
        );
        
        // Update bridge payload with real transaction hash
        await db.update(bridge_payloads)
          .set({ 
            step: 3,
            status: 'broadcasted',
            txHash: txHash,
            userWalletAddress: userAddress,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        // Start real-time confirmation monitoring (replace setTimeout)
        this.startTransactionConfirmationMonitoring(transactionId, txHash);
        
        console.log(`✅ Real Bitcoin transaction sent: ${txHash}`);
        return {
          success: true,
          txHash: txHash,
          status: 'broadcasted',
          amount: bridgeData.amount,
          fromAddress: userAddress,
          toAddress: bankAddress,
          message: 'Transaction broadcast successfully'
        };
        
      } catch (txError) {
        console.error(`❌ Bitcoin transaction failed:`, txError);
        return {
          success: false,
          error: txError instanceof Error ? txError.message : 'Bitcoin transaction failed'
        };
      }
      
    } catch (error) {
      console.error('❌ Bitcoin execution failed:', error);
      
      // Update status to failed
      await db.update(bridge_payloads)
        .set({ 
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Bitcoin execution failed',
          updatedAt: new Date()
         } as any)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .catch(dbError => console.error('Failed to update bridge status:', dbError));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bitcoin execution failed'
      };
    }
  }

  /**
   * Create and broadcast real Bitcoin transaction
   */
  static async createAndBroadcastBTCTransaction(
    userKeyPair: any,
    toAddress: string,
    amount: number,
    memo: string
  ): Promise<string> {
    console.log('₿ Creating REAL Bitcoin transaction...');
    
    // Use P2PKH (legacy) address format to match stored address (1...)
    const userAddress = bitcoin.payments.p2pkh({ 
      pubkey: Buffer.from(userKeyPair.publicKey), 
      network: BTC_CONFIG.network 
    }).address!;
    
    // Get UTXOs for the user address
    const utxos = await this.getUTXOs(userAddress);
    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs found for address');
    }
    
    // Calculate amount in satoshis
    const satoshiAmount = Math.round(amount * 100000000);
    
    // CRITICAL: Bitcoin dust limit for P2PKH is 546 satoshis
    // Any output below this will be rejected by the network
    const DUST_LIMIT = 546;
    if (satoshiAmount < DUST_LIMIT) {
      throw new Error(`Amount too small: ${satoshiAmount} sats. Minimum is ${DUST_LIMIT} sats (0.00000546 BTC) due to Bitcoin dust limit.`);
    }
    
    const feeAmount = 10000; // 10000 sats = ~$10 fee
    
    // Select UTXOs with enough balance
    let totalInput = 0;
    const selectedUtxos = [];
    for (const utxo of utxos) {
      selectedUtxos.push(utxo);
      totalInput += utxo.value;
      if (totalInput >= satoshiAmount + feeAmount) {
        break;
      }
    }
    
    if (totalInput < satoshiAmount + feeAmount) {
      throw new Error(`Insufficient balance: ${totalInput} sats available, ${satoshiAmount + feeAmount} sats needed`);
    }
    
    // Create transaction
    const psbt = new bitcoin.Psbt({ network: BTC_CONFIG.network });
    
    // Add inputs - P2PKH (legacy) format requires nonWitnessUtxo
    for (const utxo of selectedUtxos) {
      // For P2PKH, we need the full previous transaction hex
      const rawTxHex = await this.getRawTransaction(utxo.txid);
      
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(rawTxHex, 'hex')
      });
    }
    
    // Add output to bank address
    psbt.addOutput({
      address: toAddress,
      value: satoshiAmount
    });
    
    // Add change output if needed
    const changeAmount = totalInput - satoshiAmount - feeAmount;
    if (changeAmount > 546) { // Dust limit
      psbt.addOutput({
        address: userAddress,
        value: changeAmount
      });
    }
    
    // Sign all inputs - convert Uint8Array signature to Buffer
    for (let i = 0; i < selectedUtxos.length; i++) {
      const signer = {
        publicKey: Buffer.from(userKeyPair.publicKey),
        sign: (hash: Buffer) => {
          const sig = userKeyPair.sign(hash);
          // Convert Uint8Array to Buffer if needed
          return Buffer.from(sig);
        }
      };
      psbt.signInput(i, signer);
    }
    
    // Finalize and extract transaction
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txHash = tx.getId();
    
    // Broadcast transaction
    await this.broadcastTransaction(txHex);
    
    console.log(`✅ Real Bitcoin transaction created and broadcast: ${txHash}`);
    return txHash;
  }

  /**
   * Get raw transaction hex for a given txid
   */
  static async getRawTransaction(txid: string): Promise<string> {
    const apis = [
      `https://blockstream.info/api/tx/${txid}/hex`,
      `https://mempool.space/api/tx/${txid}/hex`
    ];
    
    for (const apiUrl of apis) {
      try {
        const response = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Bitcoin-Bridge/1.0' }
        });
        
        if (response.ok) {
          const hex = await response.text();
          return hex;
        }
      } catch (error) {
        console.log(`Failed to fetch raw tx from ${apiUrl}:`, error);
        continue;
      }
    }
    
    throw new Error(`Failed to fetch raw transaction for ${txid}`);
  }

  /**
   * Get UTXOs for an address with fallback APIs and timeout
   */
  static async getUTXOs(address: string): Promise<any[]> {
    const timeout = 10000; // 10 second timeout
    
    // Try multiple APIs for reliability
    const apis = [
      {
        name: 'Blockstream',
        url: `https://blockstream.info/api/address/${address}/utxo`,
        transform: (data: any) => data
      },
      {
        name: 'Mempool.space',
        url: `https://mempool.space/api/address/${address}/utxo`,
        transform: (data: any) => data
      }
    ];
    
    for (const api of apis) {
      try {
        console.log(`🔍 Fetching UTXOs from ${api.name}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(api.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Bitcoin-Bridge/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`${api.name} API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        const utxos = api.transform(data);
        
        console.log(`✅ Successfully fetched ${utxos.length} UTXOs from ${api.name}`);
        return utxos;
        
      } catch (error) {
        console.warn(`⚠️ ${api.name} UTXO fetch failed:`, error instanceof Error ? error.message : error);
        // Continue to next API
      }
    }
    
    // If all APIs failed, return empty array instead of throwing
    console.warn('⚠️ All UTXO APIs failed, returning empty array');
    return [];
  }

  /**
   * Monitor transaction confirmations on Bitcoin network
   */
  static async startTransactionConfirmationMonitoring(transactionId: string, txHash: string): Promise<void> {
    console.log(`🔍 Starting confirmation monitoring for tx: ${txHash}`);
    
    const checkConfirmations = async (attempt: number = 1): Promise<void> => {
      try {
        console.log(`⏱️ Checking confirmations for ${txHash} (attempt ${attempt})`);
        
        const confirmations = await this.getTransactionConfirmations(txHash);
        console.log(`📦 Transaction ${txHash} confirmations: ${confirmations}`);
        
        if (confirmations >= 1) {
          // Transaction confirmed! Update status to completed
          await db.update(bridge_payloads)
            .set({ 
              step: 4,
              status: 'completed',
              updatedAt: new Date()
             } as any)
            .where(eq(bridge_payloads.transaction_id, transactionId));
          
          console.log(`✅ Bitcoin transaction ${transactionId} confirmed and completed (${confirmations} confirmations)`);
          return;
        }
        
        // Not confirmed yet, schedule next check
        if (attempt < 24) { // Check for up to 4 hours (24 * 10 minutes)
          setTimeout(() => checkConfirmations(attempt + 1), 10 * 60 * 1000); // Check every 10 minutes
          console.log(`⏳ Transaction not confirmed yet, will check again in 10 minutes (attempt ${attempt + 1}/24)`);
        } else {
          // After 4 hours, mark as potentially failed but keep in broadcasted state
          console.log(`⚠️ Transaction ${txHash} not confirmed after 4 hours, keeping in 'broadcasted' state`);
          await db.update(bridge_payloads)
            .set({ 
              status: 'broadcasted_unconfirmed',
              errorMessage: 'Transaction broadcast but not confirmed after 4 hours. Please check blockchain explorer.',
              updatedAt: new Date()
             } as any)
            .where(eq(bridge_payloads.transaction_id, transactionId));
        }
        
      } catch (error) {
        console.warn(`⚠️ Confirmation check failed for ${txHash}, attempt ${attempt}:`, error);
        
        // Retry with exponential backoff, but don't fail permanently
        if (attempt < 24) {
          const delay = Math.min(10 * 60 * 1000, 2 * 60 * 1000 * attempt); // 2min * attempt, max 10min
          setTimeout(() => checkConfirmations(attempt + 1), delay);
        }
      }
    };
    
    // Start monitoring after a brief delay
    setTimeout(() => checkConfirmations(1), 2 * 60 * 1000); // Wait 2 minutes before first check
  }
  
  /**
   * Get transaction confirmation count from Bitcoin network
   */
  static async getTransactionConfirmations(txHash: string): Promise<number> {
    const apis = [
      {
        name: 'Blockstream',
        url: `https://blockstream.info/api/tx/${txHash}`,
        getConfirmations: (data: any) => {
          if (data.status?.confirmed) {
            // Calculate confirmations based on current block height
            return data.status.block_height ? 1 : 0; // Simplified: 1+ if in block, 0 if mempool
          }
          return 0;
        }
      },
      {
        name: 'Mempool.space',
        url: `https://mempool.space/api/tx/${txHash}`,
        getConfirmations: (data: any) => {
          if (data.status?.confirmed) {
            return data.status.block_height ? 1 : 0; // Simplified: 1+ if in block, 0 if mempool
          }
          return 0;
        }
      }
    ];
    
    for (const api of apis) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(api.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Bitcoin-Bridge/1.0' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`${api.name} API error: ${response.status}`);
        }
        
        const data = await response.json() as any;
        const confirmations = api.getConfirmations(data);
        
        console.log(`✅ Got confirmations from ${api.name}: ${confirmations}`);
        return confirmations;
        
      } catch (error) {
        console.warn(`⚠️ ${api.name} confirmation check failed:`, error instanceof Error ? error.message : error);
      }
    }
    
    // If all APIs failed, return 0 (unconfirmed)
    console.warn('⚠️ All confirmation APIs failed, assuming unconfirmed');
    return 0;
  }
  
  /**
   * Broadcast transaction to Bitcoin network
   */
  static async broadcastTransaction(txHex: string): Promise<void> {
    try {
      const response = await fetch('https://blockstream.info/api/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: txHex
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Broadcast failed: ${errorText}`);
      }
      
      console.log('✅ Transaction broadcast successful');
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw error;
    }
  }
}