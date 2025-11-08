// XRPL Bridge - Riddle Wallet + Xaman integration
import { Client, Wallet, Payment, TrustSet } from 'xrpl';
import { db } from "../db";
import { bridge_payloads, riddleWallets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from 'crypto';
// Remove unused import since decryption is handled elsewhere
import { ExchangeRateService } from './exchange-rates';

const XRPL_CONFIG = {
  nodes: [
    'wss://xrplcluster.com',
    'wss://s1.ripple.com',
    'wss://s2.ripple.com'
  ],
  bankAddress: 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3',
  rdlIssuer: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'
};

export class XRPLBridgeHandler {
  
  /**
   * Connect to XRPL with node fallback
   */
  static async connectToXRPL(): Promise<Client> {
    console.log('🔧 XRPL_CONFIG.nodes:', XRPL_CONFIG.nodes);
    for (let i = 0; i < XRPL_CONFIG.nodes.length; i++) {
      const node = XRPL_CONFIG.nodes[i];
      try {
        console.log(`🔗 Attempting XRPL connection [${i}] to: "${node}" (type: ${typeof node})`);
        if (!node || typeof node !== 'string') {
          throw new Error(`Invalid node configuration: ${node}`);
        }
        const client = new Client(node);
        await client.connect();
        console.log(`✅ Connected to XRPL node: ${node}`);
        return client;
      } catch (error) {
        console.log(`❌ Failed to connect to ${node}:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }
    throw new Error('Failed to connect to any XRPL node');
  }
  
  /**
   * Create XRPL bridge payload for Riddle Wallet or Xaman
   */
  static async createXRPLBridge(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    destinationAddress: string;
    walletType: 'riddle' | 'xaman';
    riddleWalletId?: string;
    walletHandle?: string;
    password?: string;
    cachedKeys?: any; // Cached keys from session
  }) {
    try {
      
      const { fromToken, toToken, amount, destinationAddress, walletType, riddleWalletId, walletHandle, password, cachedKeys } = params;
      
      const transactionId = crypto.randomUUID();
      const numAmount = parseFloat(amount);
      
      // Simple fee calculation: add 1% to payment amount (XRP-specific)
      const exchangeRate = await ExchangeRateService.getExchangeRate(fromToken, toToken, numAmount);
      const outputAmount = exchangeRate.rate * numAmount; // Full output amount (no fee deduction from output)
      const feeAmountInXRP = numAmount * 0.01; // 1% fee in XRP
      const totalAmountToPay = numAmount + feeAmountInXRP; // Add fee to payment
      
      
      // For Riddle wallet, we need to get the actual wallet address first
      let walletAddress = '';
      if (walletType === 'riddle' && cachedKeys?.xrpAddress) {
        walletAddress = cachedKeys.xrpAddress;
      }

      // Create XRPL payment payload for transaction execution
      const xrplPayload = {
        TransactionType: 'Payment',
        Account: walletAddress || 'pending', // Use actual address or mark as pending
        Destination: XRPL_CONFIG.bankAddress,
        Amount: Math.round(totalAmountToPay * 1000000).toString(), // Convert to drops
        Memos: [{
          Memo: {
            MemoType: Buffer.from('BridgeTransaction', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };

      // Store bridge payload using Drizzle ORM with the actual XRPL payload
      await db.insert(bridge_payloads).values({
        transaction_id: transactionId,
        uuid: crypto.randomUUID(),
        step: 1,
        status: 'pending',
        userWalletAddress: walletAddress || destinationAddress,
        destinationAddress: destinationAddress,
        fromCurrency: fromToken.toUpperCase(),
        toCurrency: toToken.toUpperCase(),
        amount: totalAmountToPay.toString(),
        outputAmount: outputAmount.toString(),
        platform_fee: '0.01',
        fee_amount: feeAmountInXRP.toString(),
        payload: JSON.stringify(xrplPayload), // Store the actual XRPL transaction payload
        walletType: walletType,
        riddleWalletId: walletHandle || riddleWalletId || null
      });
      
      console.log(`   - Base Amount: ${amount} ${fromToken}`);
      console.log(`   - Platform Fee (1%): ${feeAmountInXRP} ${fromToken}`);
      console.log(`   - Total Payment: ${totalAmountToPay} ${fromToken}`);
      console.log(`   - Output: ${outputAmount} ${toToken}`);
      
      // Prepare wallet-specific payload
      if (walletType === 'riddle' && (riddleWalletId || walletHandle) && password) {
        // Get Riddle wallet using ORM (like in routes.ts)
        const [walletData] = await db
          .select()
          .from(riddleWallets)
          .where(eq(riddleWallets.handle, walletHandle || riddleWalletId || ''))
          .limit(1);
        
        if (!walletData) {
          throw new Error('Riddle wallet not found');
        }
        
        let xrpPrivateKey: string;
        
        // ALWAYS use cached keys when available (session is authenticated)
        if (cachedKeys?.xrpPrivateKey) {
          console.log('🔑 Using session-cached private keys (no decryption needed)');
          console.log('✅ Session-cached keys ready for bridge transaction');
          
          // Use cached keys directly from session
          xrpPrivateKey = cachedKeys.xrpPrivateKey;
          console.log('🔐 Using cached XRP private key for bridge transaction');
          
        } else {
          console.error('❌ No cached XRP private key found - session should have cached keys');
          throw new Error('Authentication required - no cached keys available');
        }
        
        // Create XRPL payment transaction
        const wallet = Wallet.fromSecret(xrpPrivateKey);
        
        const payment: Payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: XRPL_CONFIG.bankAddress,
          Amount: Math.round(totalAmountToPay * 1000000).toString(), // Convert to drops as integer
          Memos: [{
            Memo: {
              MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };
        
        // Update the stored payload with the actual wallet address
        await db.update(bridge_payloads)
          .set({  
            payload: JSON.stringify(payment),
            userWalletAddress: wallet.address 
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        return {
          success: true,
          transactionId,
          walletType: 'riddle',
          payload: payment,
          walletAddress: wallet.address,
          amount: totalAmountToPay.toFixed(6),
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: feeAmountInXRP.toFixed(6),
          bankWalletAddress: XRPL_CONFIG.bankAddress,
          exchangeRateInfo: {
            rate: `1 XRP = ${(outputAmount / numAmount).toFixed(6)} ${toToken.toUpperCase()}`,
            inputAmount: `${amount} XRP`,
            outputAmount: `${outputAmount.toFixed(6)} ${toToken.toUpperCase()}`,
            fee: `${feeAmountInXRP.toFixed(6)} XRP (1%)`
          },
          instructions: `Send ${totalAmountToPay.toFixed(6)} XRP (${amount} + ${feeAmountInXRP.toFixed(6)} fee) to bank with memo ${transactionId}`
        };
        
      } else if (walletType === 'xaman') {
        // Create Xaman payload
        const xamanPayload = {
          TransactionType: 'Payment',
          Destination: XRPL_CONFIG.bankAddress,
          Amount: Math.round(totalAmountToPay * 1000000).toString(), // Convert to drops as integer
          Memos: [{
            Memo: {
              MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };
        
        return {
          success: true,
          transactionId,
          walletType: 'xaman',
          payload: xamanPayload,
          amount: totalAmountToPay.toFixed(6),
          estimatedOutput: outputAmount.toFixed(6),
          bridgeFee: feeAmountInXRP.toFixed(6),
          bankWalletAddress: XRPL_CONFIG.bankAddress,
          instructions: `Send ${totalAmountToPay.toFixed(6)} XRP (${amount} + ${feeAmountInXRP.toFixed(6)} fee) to bank with memo ${transactionId}`
        };
      }
      
      console.log('❌ Unhandled wallet type or missing required parameters');
      console.log('📋 Available params:', { 
        walletType, 
        riddleWalletId, 
        walletHandle, 
        password: password ? 'provided' : 'missing',
        hasWalletId: !!(riddleWalletId || walletHandle)
      });
      throw new Error(`Invalid wallet type: ${walletType} or missing parameters`);
      
    } catch (error) {
      console.error('❌ XRPL bridge creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create XRPL bridge'
      };
    }
  }
  
  /**
   * Execute XRPL transaction with Riddle Wallet - NO PASSWORD NEEDED
   */
  static async executeXRPLWithCachedKeys(
    transactionId: string,
    sessionToken: string
  ) {
    try {
      console.log('🔗 Executing XRPL bridge transaction with cached keys (NO PASSWORD)');
      
      // Get session with cached private keys
      const authModule = await import('../riddle-wallet-auth');
      const session = authModule.getActiveSession(sessionToken);
      
      if (!session || !session.cachedKeys) {
        throw new Error('Invalid session or no cached keys available');
      }

      if (Date.now() > session.expiresAt) {
        throw new Error('Session expired');
      }

      const { handle, cachedKeys } = session;
      console.log('✅ XRPL Bridge using cached keys for handle:', handle);
      
      // Get bridge payload
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload) {
        throw new Error('Bridge transaction not found');
      }
      
      // Use cached XRP private key - NO DECRYPTION NEEDED
      const xrpPrivateKey = cachedKeys.xrpPrivateKey;
      
      if (!xrpPrivateKey) {
        throw new Error('XRP private key not found');
      }
      
      // Execute XRPL transaction
      const client = await XRPLBridgeHandler.connectToXRPL();
      
      const wallet = Wallet.fromSecret(xrpPrivateKey);
      const numAmount = parseFloat(bridgePayload.amount?.toString() || '0');
      
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: XRPL_CONFIG.bankAddress,
        Amount: (numAmount * 1000000).toString(),
        Memos: [{
          Memo: {
            MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };
      
      console.log('📤 Submitting XRPL transaction to mainnet...');
      const response = await client.submitAndWait(payment, { wallet });
      await client.disconnect();
      
      const meta = response.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        // Update bridge payload
        await db.update(bridge_payloads)
          .set({ 
            step: 2,
            status: 'verified',
            txHash: response.result.hash,
            userWalletAddress: wallet.address,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`✅ XRPL transaction successful: ${response.result.hash}`);
        return {
          success: true,
          txHash: response.result.hash,
          amount: bridgePayload.amount,
          fromAddress: wallet.address
        };
      } else {
        throw new Error(`XRPL transaction failed: ${meta?.TransactionResult}`);
      }
      
    } catch (error) {
      console.error('❌ XRPL Riddle wallet execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'XRPL transaction failed'
      };
    }
  }
  
  /**
   * Complete XRPL bridge with RDL distribution
   */
  static async completeXRPLBridge(transactionId: string, destinationAddress: string) {
    try {
      console.log('🚀 Completing XRPL bridge with RDL distribution');
      
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload || bridgePayload.status !== 'verified') {
        throw new Error('Bridge transaction not verified');
      }
      
      // Execute RDL distribution using bank wallet
      const bankPrivateKey = process.env.BANK_XRP_PRIVATE_KEY;
      if (!bankPrivateKey) {
        throw new Error('Bank XRP private key not configured');
      }
      
      const client = await XRPLBridgeHandler.connectToXRPL();
      
      const bankWallet = Wallet.fromSecret(bankPrivateKey);
      const rdlAmount = parseFloat(bridgePayload.outputAmount?.toString() || '0');
      
      const rdlPayment: Payment = {
        TransactionType: 'Payment',
        Account: bankWallet.address,
        Destination: destinationAddress,
        Amount: {
          currency: 'RDL',
          value: rdlAmount.toString(),
          issuer: XRPL_CONFIG.rdlIssuer
        },
        Memos: [{
          Memo: {
            MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };
      
      console.log('📤 Distributing RDL tokens...');
      const response = await client.submitAndWait(rdlPayment, { wallet: bankWallet });
      await client.disconnect();
      
      const meta = response.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        // Update as completed
        await db.update(bridge_payloads)
          .set({ 
            step: 3,
            status: 'completed',
            step3TxHash: response.result.hash,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`✅ RDL distribution successful: ${response.result.hash}`);
        return {
          success: true,
          txHash: response.result.hash,
          amount: rdlAmount.toString(),
          explorerUrl: `https://livenet.xrpl.org/transactions/${response.result.hash}`
        };
      } else {
        throw new Error(`RDL distribution failed: ${meta?.TransactionResult}`);
      }
      
    } catch (error) {
      console.error('❌ XRPL bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RDL distribution failed'
      };
    }
  }
}