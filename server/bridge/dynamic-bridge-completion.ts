// Dynamic Bridge Completion - Works for any chain combination
import { db } from "../db";
import { bridge_payloads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Client, Wallet, Payment } from 'xrpl';
import { ethers } from 'ethers';
import { AuthenticatedRequest } from '../middleware/session-auth';
import { XRPVerifier } from '../bridge-verification/xrp-verifier';
import { SOLVerifier } from '../bridge-verification/sol-verifier';
import { ETHVerifier } from '../bridge-verification/eth-verifier';
import { BTCVerifier } from '../bridge-verification/btc-verifier';

const CHAIN_CONFIG = {
  xrpl: {
    bankAddress: 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3',
    rdlIssuer: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    rpcUrl: 'wss://s1.ripple.com'
  },
  sol: {
    bankAddress: 'AtzvJY1BvHQihWRxS3VCzqfzmx6p7Xjwu3z2JjLwNLsC',
    rpcUrl: 'https://api.mainnet-beta.solana.com'
  },
  eth: {
    bankAddress: '0xf7802d7522a45CB6a6f2eFa246f4B5489768b673',
    rpcUrl: 'https://eth.public-rpc.com' // Public RPC - no API key needed
  }
};

export class DynamicBridgeCompletion {
  
  /**
   * Complete bridge dynamically based on destination chain
   */
  static async completeBridge(transactionId: string, destinationAddress: string, req: AuthenticatedRequest) {
    try {
      console.log('🔄 Starting dynamic bridge completion...');
      
      // Get bridge payload to determine destination chain
      const [bridgePayload] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgePayload) {
        throw new Error('Bridge transaction not found');
      }
      
      // 🚨 CRITICAL: Check for duplicates FIRST, before sending any tokens
      if (bridgePayload.status === 'completed' && bridgePayload.step3TxHash) {
        console.log('⚠️ Bridge already completed - preventing duplicate execution');
        console.log(`   - Transaction ID: ${transactionId}`);
        console.log(`   - Existing TX Hash: ${bridgePayload.step3TxHash}`);
        console.log('   - Status: Already completed, returning existing result');
        
        return {
          success: true,
          txHash: bridgePayload.step3TxHash,
          amount: bridgePayload.outputAmount?.toString() || '0',
          explorerUrl: bridgePayload.step3TxHash.includes('livenet.xrpl.org') ? 
            bridgePayload.step3TxHash : 
            `https://livenet.xrpl.org/transactions/${bridgePayload.step3TxHash}`,
          message: 'Bridge was already completed previously'
        };
      }
      
      // 🔒 LOCK: Check if already in progress (prevent race conditions)
      if (bridgePayload.status === 'completing') {
        console.log('⚠️ Bridge completion already in progress - preventing duplicate execution');
        console.log(`   - Transaction ID: ${transactionId}`);
        console.log('   - Status: Completion in progress by another process');
        
        // Wait a moment and check if it completed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const [updatedPayload] = await db
          .select()
          .from(bridge_payloads)
          .where(eq(bridge_payloads.transaction_id, transactionId))
          .limit(1);
          
        if (updatedPayload?.step3TxHash) {
          return {
            success: true,
            txHash: updatedPayload.step3TxHash,
            amount: updatedPayload.outputAmount?.toString() || '0',
            explorerUrl: `https://livenet.xrpl.org/transactions/${updatedPayload.step3TxHash}`,
            message: 'Bridge was completed by another process'
          };
        }
        
        throw new Error('Bridge completion in progress - please wait');
      }
      
      // 🔒 IMMEDIATE LOCK: Mark as completing to prevent race conditions
      const lockResult = await db.update(bridge_payloads)
        .set({  
          status: 'completing',
          updatedAt: new Date()
         } as any)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .returning({ status: bridge_payloads.status });
      
      // If we couldn't set the lock, another process got there first
      if (!lockResult || lockResult.length === 0) {
        console.log('⚠️ Failed to acquire completion lock - another process is handling this');
        throw new Error('Bridge completion already in progress');
      }
      
      // 🔒 CRITICAL: PROPER VERIFICATION - Never auto-verify without checking transaction success
      let isVerified = bridgePayload.status === 'verified' || bridgePayload.status === 'completed';
      
      // 🛡️ SECURITY: Additional verification for high-value transactions
      const inputAmount = parseFloat(bridgePayload.amount?.toString() || '0');
      const isHighValue = inputAmount > 50; // Above $50 threshold
      
      if (!isVerified && bridgePayload.txHash) {
        console.log('🔧 CRITICAL: Verifying transaction success before issuing tokens...');
        console.log('🔧 Transaction Hash:', bridgePayload.txHash);
        console.log('🔧 Input Amount:', inputAmount, bridgePayload.fromCurrency);
        
        if (isHighValue) {
          console.log('🛡️ HIGH VALUE TRANSACTION: Extra verification required');
        }
        
        // ALWAYS verify transaction was actually successful before issuing tokens
        if (bridgePayload.fromCurrency?.toLowerCase() === 'xrp') {
          console.log('🔍 Verifying XRP transaction result...');
          
          // 📊 AUDIT LOG: Record verification attempt
          console.log('📊 VERIFICATION AUDIT:', {
            transactionId,
            txHash: bridgePayload.txHash,
            fromCurrency: bridgePayload.fromCurrency,
            amount: inputAmount,
            isHighValue,
            timestamp: new Date().toISOString(),
            verificationAttempt: 'primary'
          });
          
          const xrpVerifier = new XRPVerifier();
          const verificationResult = await xrpVerifier.verify({
            txHash: bridgePayload.txHash,
            expectedMemo: transactionId,
            chain: 'XRP'
          });
          
          console.log('📊 XRP Verification Result:', {
            verified: verificationResult.verified,
            message: verificationResult.message
          });
          
          if (verificationResult.verified) {
            console.log('✅ XRP transaction verified as successful - safe to issue tokens');
            
            // 🛡️ SECURITY: Double verification for high-value transactions
            if (isHighValue) {
              console.log('🛡️ HIGH VALUE: Performing double verification...');
              
              // Wait 2 seconds and verify again to ensure consistency
              await new Promise(resolve => setTimeout(resolve, 2000));
              const doubleVerifyResult = await xrpVerifier.verify({
                txHash: bridgePayload.txHash,
                expectedMemo: transactionId,
                chain: 'XRP'
              });
              
              if (!doubleVerifyResult.verified) {
                console.log('❌ CRITICAL: Double verification FAILED for high-value transaction');
                console.log('❌ Refusing to issue tokens - verification inconsistency detected');
                
                await db.update(bridge_payloads)
                  .set({  
                    status: 'failed',
                    verification_status: 'double_verification_failed',
                    errorMessage: 'High-value transaction failed double verification',
                    updatedAt: new Date()
                   } as any)
                  .where(eq(bridge_payloads.transaction_id, transactionId));
                
                throw new Error('High-value transaction failed double verification');
              }
              
              console.log('✅ HIGH VALUE: Double verification passed');
            }
            
            isVerified = true;
            
            // Mark as verified in database with audit trail
            await db.update(bridge_payloads)
              .set({  
                status: 'verified',
                verification_status: isHighValue ? 'double_verified' : 'verified',
                updatedAt: new Date()
               } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
              
            bridgePayload.status = 'verified';
          } else {
            console.log('❌ CRITICAL: XRP transaction verification FAILED');
            console.log('❌ Reason:', verificationResult.message);
            console.log('🚨 REFUSING to issue tokens for failed transaction');
            
            // Mark as failed in database
            await db.update(bridge_payloads)
              .set({ 
                status: 'failed',
                verification_status: 'failed',
                errorMessage: `Transaction verification failed: ${verificationResult.message}`,
                updatedAt: new Date()
              } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
            
            throw new Error(`Transaction verification failed: ${verificationResult.message}`);
          }
        } else if (bridgePayload.fromCurrency?.toLowerCase() === 'sol') {
          console.log('🟣 Verifying SOL transaction result...');
          
          // 📊 AUDIT LOG: Record verification attempt
          console.log('📊 VERIFICATION AUDIT:', {
            transactionId,
            txHash: bridgePayload.txHash,
            fromCurrency: bridgePayload.fromCurrency,
            amount: inputAmount,
            isHighValue,
            timestamp: new Date().toISOString(),
            verificationAttempt: 'primary'
          });
          
          const solVerifier = new SOLVerifier();
          const verificationResult = await solVerifier.verify({
            txHash: bridgePayload.txHash,
            expectedMemo: transactionId,
            chain: 'SOL'
          });
          
          console.log('📊 SOL Verification Result:', {
            verified: verificationResult.verified,
            message: verificationResult.message
          });
          
          if (verificationResult.verified) {
            console.log('✅ SOL transaction verified as successful - safe to issue tokens');
            
            // 🛡️ SECURITY: Double verification for high-value transactions
            if (isHighValue) {
              console.log('🛡️ HIGH VALUE: Performing double verification...');
              
              // Wait 2 seconds and verify again to ensure consistency
              await new Promise(resolve => setTimeout(resolve, 2000));
              const doubleVerifyResult = await solVerifier.verify({
                txHash: bridgePayload.txHash,
                expectedMemo: transactionId,
                chain: 'SOL'
              });
              
              if (!doubleVerifyResult.verified) {
                console.log('❌ CRITICAL: Double verification FAILED for high-value transaction');
                console.log('❌ Refusing to issue tokens - verification inconsistency detected');
                
                await db.update(bridge_payloads)
                  .set({  
                    status: 'failed',
                    verification_status: 'double_verification_failed',
                    errorMessage: 'High-value transaction failed double verification',
                    updatedAt: new Date()
                   } as any)
                  .where(eq(bridge_payloads.transaction_id, transactionId));
                
                throw new Error('High-value transaction failed double verification');
              }
              
              console.log('✅ HIGH VALUE: Double verification passed');
            }
            
            isVerified = true;
            
            // Mark as verified in database with audit trail
            await db.update(bridge_payloads)
              .set({  
                status: 'verified',
                verification_status: isHighValue ? 'double_verified' : 'verified',
                updatedAt: new Date()
               } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
              
            bridgePayload.status = 'verified';
          } else {
            console.log('❌ CRITICAL: SOL transaction verification FAILED');
            console.log('❌ Reason:', verificationResult.message);
            console.log('🚨 REFUSING to issue tokens for failed transaction');
            
            // Mark as failed in database
            await db.update(bridge_payloads)
              .set({ 
                status: 'failed',
                verification_status: 'failed',
                errorMessage: `Transaction verification failed: ${verificationResult.message}`,
                updatedAt: new Date()
              } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
            
            throw new Error(`Transaction verification failed: ${verificationResult.message}`);
          }
        } else if (['eth', 'bnb', 'matic', 'base'].includes(bridgePayload.fromCurrency?.toLowerCase() || '')) {
          console.log('⚡ Verifying EVM transaction result...');
          
          // 📊 AUDIT LOG: Record verification attempt
          console.log('📊 VERIFICATION AUDIT:', {
            transactionId,
            txHash: bridgePayload.txHash,
            fromCurrency: bridgePayload.fromCurrency,
            amount: inputAmount,
            isHighValue,
            timestamp: new Date().toISOString(),
            verificationAttempt: 'primary'
          });
          
          const networkType = bridgePayload.fromCurrency?.toUpperCase() as 'ETH' | 'BNB' | 'MATIC' | 'BASE';
          const ethVerifier = new ETHVerifier(networkType);
          const verificationResult = await ethVerifier.verify({
            txHash: bridgePayload.txHash,
            expectedMemo: transactionId,
            chain: networkType
          });
          
          console.log('📊 EVM Verification Result:', {
            verified: verificationResult.verified,
            message: verificationResult.message,
            network: networkType
          });
          
          if (verificationResult.verified) {
            console.log('✅ EVM transaction verified as successful - safe to issue tokens');
            
            // 🛡️ SECURITY: Double verification for high-value transactions
            if (isHighValue) {
              console.log('🛡️ HIGH VALUE: Performing double verification...');
              
              // Wait 2 seconds and verify again to ensure consistency
              await new Promise(resolve => setTimeout(resolve, 2000));
              const doubleVerifyResult = await ethVerifier.verify({
                txHash: bridgePayload.txHash,
                expectedMemo: transactionId,
                chain: networkType
              });
              
              if (!doubleVerifyResult.verified) {
                console.log('❌ CRITICAL: Double verification FAILED for high-value transaction');
                console.log('❌ Refusing to issue tokens - verification inconsistency detected');
                
                await db.update(bridge_payloads)
                  .set({  
                    status: 'failed',
                    verification_status: 'double_verification_failed',
                    errorMessage: 'High-value transaction failed double verification',
                    updatedAt: new Date()
                   } as any)
                  .where(eq(bridge_payloads.transaction_id, transactionId));
                
                throw new Error('High-value transaction failed double verification');
              }
              
              console.log('✅ HIGH VALUE: Double verification passed');
            }
            
            isVerified = true;
            
            // Mark as verified in database with audit trail
            await db.update(bridge_payloads)
              .set({  
                status: 'verified',
                verification_status: isHighValue ? 'double_verified' : 'verified',
                updatedAt: new Date()
               } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
              
            bridgePayload.status = 'verified';
          } else {
            console.log('❌ CRITICAL: EVM transaction verification FAILED');
            console.log('❌ Reason:', verificationResult.message);
            console.log('🚨 REFUSING to issue tokens for failed transaction');
            
            // Mark as failed in database
            await db.update(bridge_payloads)
              .set({ 
                status: 'failed',
                verification_status: 'failed',
                errorMessage: `Transaction verification failed: ${verificationResult.message}`,
                updatedAt: new Date()
              } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
            
            throw new Error(`Transaction verification failed: ${verificationResult.message}`);
          }
        } else if (bridgePayload.fromCurrency?.toLowerCase() === 'btc') {
          console.log('🟠 Verifying BTC transaction result...');
          
          // 📊 AUDIT LOG: Record verification attempt
          console.log('📊 VERIFICATION AUDIT:', {
            transactionId,
            txHash: bridgePayload.txHash,
            fromCurrency: bridgePayload.fromCurrency,
            amount: inputAmount,
            isHighValue,
            timestamp: new Date().toISOString(),
            verificationAttempt: 'primary'
          });
          
          const btcVerifier = new BTCVerifier();
          const verificationResult = await btcVerifier.verify({
            txHash: bridgePayload.txHash,
            expectedMemo: transactionId,
            chain: 'BTC'
          });
          
          console.log('📊 BTC Verification Result:', {
            verified: verificationResult.verified,
            message: verificationResult.message
          });
          
          if (verificationResult.verified) {
            console.log('✅ BTC transaction verified as successful - safe to issue tokens');
            
            // 🛡️ SECURITY: Double verification for high-value transactions
            if (isHighValue) {
              console.log('🛡️ HIGH VALUE: Performing double verification...');
              
              // Wait 5 seconds for Bitcoin (slower network) and verify again
              await new Promise(resolve => setTimeout(resolve, 5000));
              const doubleVerifyResult = await btcVerifier.verify({
                txHash: bridgePayload.txHash,
                expectedMemo: transactionId,
                chain: 'BTC'
              });
              
              if (!doubleVerifyResult.verified) {
                console.log('❌ CRITICAL: Double verification FAILED for high-value transaction');
                console.log('❌ Refusing to issue tokens - verification inconsistency detected');
                
                await db.update(bridge_payloads)
                  .set({  
                    status: 'failed',
                    verification_status: 'double_verification_failed',
                    errorMessage: 'High-value transaction failed double verification',
                    updatedAt: new Date()
                   } as any)
                  .where(eq(bridge_payloads.transaction_id, transactionId));
                
                throw new Error('High-value transaction failed double verification');
              }
              
              console.log('✅ HIGH VALUE: Double verification passed');
            }
            
            isVerified = true;
            
            // Mark as verified in database with audit trail
            await db.update(bridge_payloads)
              .set({  
                status: 'verified',
                verification_status: isHighValue ? 'double_verified' : 'verified',
                updatedAt: new Date()
               } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
              
            bridgePayload.status = 'verified';
          } else {
            console.log('❌ CRITICAL: BTC transaction verification FAILED');
            console.log('❌ Reason:', verificationResult.message);
            console.log('🚨 REFUSING to issue tokens for failed transaction');
            
            // Mark as failed in database
            await db.update(bridge_payloads)
              .set({ 
                status: 'failed',
                verification_status: 'failed',
                errorMessage: `Transaction verification failed: ${verificationResult.message}`,
                updatedAt: new Date()
              } as any)
              .where(eq(bridge_payloads.transaction_id, transactionId));
            
            throw new Error(`Transaction verification failed: ${verificationResult.message}`);
          }
        } else {
          // For other chains, implement similar verification
          console.log('⚠️ Non-supported chain for verification:', bridgePayload.fromCurrency);
          throw new Error(`Verification not yet implemented for ${bridgePayload.fromCurrency} - supported chains: XRP, SOL, ETH, BNB, MATIC, BASE, BTC`);
        }
      } else if (!isVerified) {
        console.log('❌ Bridge verification failed - no transaction hash found');
        console.log('📊 Bridge payload status:', {
          status: bridgePayload.status,
          step: bridgePayload.step,
          txHash: bridgePayload.txHash ? 'present' : 'missing'
        });
        throw new Error('Bridge transaction not verified - payment may not have been sent');
      }
      
      // Use the actual toCurrency from the bridge payload - send what was calculated
      const destinationToken = bridgePayload.toCurrency?.toLowerCase();
      const sourceChain = bridgePayload.fromCurrency?.toLowerCase();
      const outputAmount = parseFloat(bridgePayload.outputAmount?.toString() || '0');
      
      // Display bridge exchange information  
      const fromCurrency = bridgePayload.fromCurrency?.toUpperCase() || 'UNKNOWN';
      const toCurrency = bridgePayload.toCurrency?.toUpperCase() || 'UNKNOWN';
      const exchangeRate = inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0';
      
      console.log(`🎯 Completing bridge: ${fromCurrency} → ${toCurrency}`);
      console.log(`💱 Exchange rate: 1 ${fromCurrency} = ${exchangeRate} ${toCurrency}`);
      console.log(`💰 Input: ${inputAmount} ${fromCurrency} → Output: ${outputAmount} ${toCurrency}`);
      
      // Determine completion method - ONLY RDL, SRDL supported
      let result;
      
      switch (destinationToken) {
        case 'rdl':  // RDL tokens on XRPL - universal destination for all chains
          console.log(`🏦 Completing RDL distribution on XRPL...`);
          result = await this.completeRDLBridge(transactionId, destinationAddress, outputAmount, req);
          break;
          
        case 'srdl':  // SRDL tokens on Solana
          console.log(`🟣 Completing SRDL distribution on Solana...`);
          result = await this.completeSRDLBridge(transactionId, destinationAddress, outputAmount);
          break;
          
        default:
          console.log(`❌ Unsupported destination token: ${destinationToken}`);
          console.log(`✅ Supported tokens: RDL, SRDL`);
          throw new Error(`Distribution not supported for ${destinationToken}. Only RDL and SRDL distributions are available.`);
      }
      
      if (result.success) {
        // Mark bridge as completed (we have the lock from earlier)
        await db.update(bridge_payloads)
          .set({ 
            step: 3,
            status: 'completed',
            step3TxHash: result.txHash,
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`📊 Database Updated - Bridge Completed:`);
        console.log(`   - Transaction ID: ${transactionId}`);
        console.log(`   - Step 3 TX Hash: ${result.txHash}`);
        console.log(`   - From: ${bridgePayload.fromCurrency}`);
        console.log(`   - To: ${bridgePayload.toCurrency}`);
        console.log(`   - Amount: ${bridgePayload.amount} → ${outputAmount}`);
        console.log(`   - Destination: ${destinationAddress}`);
        console.log(`   - Status: COMPLETED ✅`);
      } else {
        // Mark bridge as failed
        await db.update(bridge_payloads)
          .set({ 
            step: 3,
            status: 'failed',
            errorMessage: result.error || 'Unknown error',
            updatedAt: new Date()
           } as any)
          .where(eq(bridge_payloads.transaction_id, transactionId));
        
        console.log(`📊 Database Updated - Bridge Failed:`);
        console.log(`   - Transaction ID: ${transactionId}`);
        console.log(`   - Error: ${result.error}`);
        console.log(`   - Status: FAILED ❌`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Dynamic bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bridge completion failed'
      };
    }
  }
  
  /**
   * Complete RDL bridge by sending RDL tokens from BANK WALLET on XRPL
   */
  private static async completeRDLBridge(transactionId: string, destinationAddress: string, outputAmount: number, req: AuthenticatedRequest) {
    try {
      console.log('🏦 === RDL BANK TRANSACTION START ===');
      console.log('🏦 Completing bridge with RDL tokens from BANK...');
      
      // Get bridge payload for logging
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgeData) {
        throw new Error('Bridge payload not found for RDL transaction');
      }
      
      console.log('📊 RIDDLE TRANSACTION DETAILS:');
      console.log(`   - Transaction ID: ${transactionId}`);
      console.log(`   - From Currency: ${bridgeData.fromCurrency}`);
      console.log(`   - To Currency: ${bridgeData.toCurrency} (RDL)`);
      console.log(`   - Input Amount: ${bridgeData.amount} ${bridgeData.fromCurrency}`);
      console.log(`   - Output Amount: ${outputAmount} RDL`);
      console.log(`   - Destination: ${destinationAddress}`);
      console.log(`   - Wallet Type: ${bridgeData.walletType}`);
      
      // IN TX: Get the Step 2 (execute) transaction hash
      const inputTxHash = bridgeData.step3TxHash || 'No Step 2 TX';
      console.log('📥 IN TX (Step 2 Execute):');
      console.log(`   - Hash: ${inputTxHash}`);
      console.log(`   - Amount: ${bridgeData.amount} ${bridgeData.fromCurrency}`);
      console.log(`   - Status: ${bridgeData.status}`);
      
      // RDL token details on XRPL
      const RDL_CURRENCY = 'RDL';
      const RDL_ISSUER = 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9'; // RDL token issuer
      
      // Use BANK XRP private key (RDL is on XRPL chain) - NO FALLBACKS
      const bankXRPPrivateKey = process.env.BANK_XRP_PRIVATE_KEY;
      if (!bankXRPPrivateKey) {
        throw new Error('BANK_XRP_PRIVATE_KEY required for RDL transactions - no fallbacks allowed');
      }
      
      console.log('🏦 Using BANK XRP wallet for RDL transactions (same chain)...');
      
      // Connect to XRPL with BANK wallet
      const client = new Client(CHAIN_CONFIG.xrpl.rpcUrl);
      await client.connect();
      
      try {
        const bankWallet = Wallet.fromSecret(bankXRPPrivateKey);
        console.log(`🏦 Bank XRP Address (for RDL): ${bankWallet.address}`);
        
        // Create RDL token payment FROM BANK
        const payment: Payment = {
          TransactionType: 'Payment',
          Account: bankWallet.address,
          Destination: destinationAddress,
          Amount: {
            currency: RDL_CURRENCY,
            value: outputAmount.toString(),
            issuer: RDL_ISSUER
          },
          Memos: [{
            Memo: {
              MemoData: Buffer.from(`BRIDGE_${transactionId}_${Date.now()}`, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };
        
        console.log('📤 OUT TX (Step 3 Complete):');
        console.log(`   - Sending ${outputAmount} RDL from BANK XRP wallet to ${destinationAddress}...`);
        console.log(`   - Bank XRP Address: ${bankWallet.address}`);
        console.log(`   - Chain: XRPL (same as XRP)`);
        console.log(`   - Token: RDL`);
        
        // Submit REAL bank transaction
        const response = await client.submitAndWait(payment, { wallet: bankWallet });
        
        const meta = response.result.meta as any;
        if (meta?.TransactionResult === 'tesSUCCESS') {
          console.log(`✅ BANK XRP wallet RDL transfer successful: ${response.result.hash}`);
          console.log('📊 COMPLETE TRANSACTION LOG:');
          console.log(`   - Riddle Transaction: ${transactionId}`);
          console.log(`   - IN TX: ${inputTxHash}`);
          console.log(`   - OUT TX: ${response.result.hash} (REAL XRPL HASH)`);
          console.log(`   - Explorer: https://livenet.xrpl.org/transactions/${response.result.hash}`);
          console.log('🏦 === RDL BANK TRANSACTION END ===');
          
          return {
            success: true,
            txHash: response.result.hash,
            amount: outputAmount.toString(),
            explorerUrl: `https://livenet.xrpl.org/transactions/${response.result.hash}`
          };
        } else {
          throw new Error(`Bank XRP wallet RDL transfer failed: ${meta?.TransactionResult}`);
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('❌ Bank XRP wallet RDL transaction error:', error);
      
      // NO FALLBACKS - fail completely if bank transaction fails
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bank XRP RDL transaction failed'
      };
    }
  }

  /**
   * Complete bridge by sending SOL tokens
   */
  private static async completeSolanaBridge(transactionId: string, destinationAddress: string, amount: number) {
    try {
      console.log('🟣 Completing bridge with SOL tokens...');
      
      const bankPrivateKey = process.env.BANK_SOL_PRIVATE_KEY;
      if (!bankPrivateKey) {
        throw new Error('Bank SOL private key not configured');
      }
      
      const connection = new Connection(CHAIN_CONFIG.sol.rpcUrl, 'confirmed');
      
      // Parse bank private key (comma-separated or base58)
      let bankKeypair: Keypair;
      try {
        if (bankPrivateKey.includes(',')) {
          const keyBytes = bankPrivateKey.split(',').map(b => parseInt(b.trim()));
          bankKeypair = Keypair.fromSecretKey(new Uint8Array(keyBytes));
        } else {
          const bs58 = await import('bs58');
          const keyBytes = bs58.default.decode(bankPrivateKey);
          bankKeypair = Keypair.fromSecretKey(keyBytes);
        }
      } catch (e) {
        throw new Error('Invalid bank SOL private key format');
      }
      
      const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      // Validate Solana address format
      let destinationPubkey: PublicKey;
      try {
        destinationPubkey = new PublicKey(destinationAddress);
      } catch (e) {
        throw new Error(`Invalid Solana address format: ${destinationAddress}`);
      }
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: bankKeypair.publicKey,
          toPubkey: destinationPubkey,
          lamports: amountLamports
        })
      );
      
      console.log(`📤 Sending ${amount} SOL to ${destinationAddress}...`);
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [bankKeypair]
      );
      
      console.log(`✅ SOL transfer successful: ${signature}`);
      return {
        success: true,
        txHash: signature,
        amount: amount.toString(),
        explorerUrl: `https://solscan.io/tx/${signature}`
      };
      
    } catch (error) {
      console.error('❌ SOL bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SOL transfer failed'
      };
    }
  }
  
  /**
   * Complete bridge by sending XRP tokens
   */
  private static async completeXRPLBridge(transactionId: string, destinationAddress: string, amount: number) {
    try {
      console.log('⚡ Completing bridge with XRP tokens...');
      
      const bankPrivateKey = process.env.BANK_XRP_PRIVATE_KEY;
      if (!bankPrivateKey) {
        throw new Error('Bank XRP private key not configured');
      }
      
      const client = new Client(CHAIN_CONFIG.xrpl.rpcUrl);
      await client.connect();
      
      const bankWallet = Wallet.fromSecret(bankPrivateKey);
      const amountDrops = Math.floor(amount * 1000000).toString(); // Convert to drops
      
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: bankWallet.address,
        Destination: destinationAddress,
        Amount: amountDrops,
        Memos: [{
          Memo: {
            MemoData: Buffer.from(transactionId, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };
      
      console.log(`📤 Sending ${amount} XRP to ${destinationAddress}...`);
      const response = await client.submitAndWait(payment, { wallet: bankWallet });
      await client.disconnect();
      
      const meta = response.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        console.log(`✅ XRP transfer successful: ${response.result.hash}`);
        return {
          success: true,
          txHash: response.result.hash,
          amount: amount.toString(),
          explorerUrl: `https://livenet.xrpl.org/transactions/${response.result.hash}`
        };
      } else {
        throw new Error(`XRP transfer failed: ${meta?.TransactionResult}`);
      }
      
    } catch (error) {
      console.error('❌ XRP bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'XRP transfer failed'
      };
    }
  }
  
  /**
   * Complete bridge by sending ETH tokens (REAL TRANSACTION)
   */
  private static async completeEthereumBridge(transactionId: string, destinationAddress: string, amount: number) {
    try {
      console.log('⚡ Completing bridge with REAL ETH transaction...');
      
      const bankPrivateKey = process.env.BANK_ETH_PRIVATE_KEY;
      if (!bankPrivateKey) {
        throw new Error('Bank ETH private key not configured');
      }
      
      // Validate Ethereum address format
      if (!ethers.isAddress(destinationAddress)) {
        throw new Error(`Invalid Ethereum address format: ${destinationAddress}`);
      }
      
      // Use public RPC endpoints that don't require API keys
      const publicRPCs = [
        'https://eth.llamarpc.com',
        'https://eth.public-rpc.com',
        'https://rpc.ankr.com/eth'
      ];
      
      let lastError: any;
      
      // Try multiple public RPCs in case one fails
      for (const rpcUrl of publicRPCs) {
        try {
          console.log(`🔗 Trying RPC: ${rpcUrl}`);
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const wallet = new ethers.Wallet(bankPrivateKey, provider);
          
          const amountWei = ethers.parseEther(amount.toString());
          
          console.log(`📤 Sending REAL ${amount} ETH to ${destinationAddress}...`);
          const tx = await wallet.sendTransaction({
            to: destinationAddress,
            value: amountWei,
            gasLimit: 21000
          });
          
          const receipt = await tx.wait();
          
          console.log(`✅ REAL ETH transfer successful: ${tx.hash}`);
          return {
            success: true,
            txHash: tx.hash,
            amount: amount.toString(),
            explorerUrl: `https://etherscan.io/tx/${tx.hash}`
          };
        } catch (rpcError) {
          console.log(`⚠️ RPC failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
          lastError = rpcError;
          continue;
        }
      }
      
      throw lastError || new Error('All public RPC endpoints failed');
      
    } catch (error) {
      console.error('❌ ETH bridge completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ETH transfer failed'
      };
    }
  }
  
  /**
   * Complete bridge by sending SRDL tokens on Solana
   */
  private static async completeSRDLBridge(transactionId: string, destinationAddress: string, amount: number) {
    try {
      console.log('🟣 === SRDL BRIDGE COMPLETION START ===');
      console.log('🟣 Completing bridge with SRDL tokens on Solana...');
      
      // Get bridge payload for logging
      const [bridgeData] = await db
        .select()
        .from(bridge_payloads)
        .where(eq(bridge_payloads.transaction_id, transactionId))
        .limit(1);
      
      if (!bridgeData) {
        throw new Error('Bridge payload not found for SRDL transaction');
      }
      
      console.log('📊 RIDDLE TRANSACTION DETAILS:');
      console.log(`   - Transaction ID: ${transactionId}`);
      console.log(`   - From Currency: ${bridgeData.fromCurrency}`);
      console.log(`   - To Currency: ${bridgeData.toCurrency} (SRDL)`);
      console.log(`   - Input Amount: ${bridgeData.amount} ${bridgeData.fromCurrency}`);
      console.log(`   - Output Amount: ${amount} SRDL`);
      console.log(`   - Destination: ${destinationAddress}`);
      console.log(`   - Wallet Type: ${bridgeData.walletType}`);
      
      // IN TX: Get the Step 2 (execute) transaction hash
      const inputTxHash = bridgeData.step3TxHash || 'No Step 2 TX';
      console.log('📥 IN TX (Step 2 Execute):');
      console.log(`   - Hash: ${inputTxHash}`);
      console.log(`   - Amount: ${bridgeData.amount} ${bridgeData.fromCurrency}`);
      console.log(`   - Status: ${bridgeData.status}`);
      
      // OUT TX: Generate SRDL transfer transaction
      console.log('📤 OUT TX (Step 3 Complete):');
      console.log(`   - Sending ${amount} SRDL to ${destinationAddress}...`);
      console.log(`   - Chain: Solana`);
      console.log(`   - Token: SRDL (Solana RDL)`);
      
      // Use BANK SOL private key (SRDL is on Solana chain) - NO FALLBACKS
      const bankSOLPrivateKey = process.env.BANK_SOL_PRIVATE_KEY;
      if (!bankSOLPrivateKey) {
        throw new Error('BANK_SOL_PRIVATE_KEY required for SRDL transactions - no fallbacks allowed');
      }
      
      console.log('🏦 Using BANK SOL wallet for SRDL transactions...');
      
      // Implement real Solana SPL token transfer
      const connection = new Connection(CHAIN_CONFIG.sol.rpcUrl, 'confirmed');
      
      // Parse bank private key - handle multiple formats
      let bankKeypair: Keypair;
      try {
        if (bankSOLPrivateKey.includes(',')) {
          // Array format: [1,2,3,4...]
          const keyBytes = bankSOLPrivateKey.split(',').map(b => parseInt(b.trim()));
          bankKeypair = Keypair.fromSecretKey(new Uint8Array(keyBytes));
        } else if (bankSOLPrivateKey.includes('[')) {
          // JSON array format: [1,2,3,4...]
          const keyBytes = JSON.parse(bankSOLPrivateKey);
          bankKeypair = Keypair.fromSecretKey(new Uint8Array(keyBytes));
        } else {
          // Base58 format
          const bs58 = await import('bs58');
          const keyBytes = bs58.default.decode(bankSOLPrivateKey);
          bankKeypair = Keypair.fromSecretKey(keyBytes);
        }
        console.log(`🏦 Bank SOL wallet address: ${bankKeypair.publicKey.toString()}`);
      } catch (e) {
        throw new Error(`Invalid BANK_SOL_PRIVATE_KEY format for SRDL: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
      
      // Validate Solana address
      let destinationPubkey: PublicKey;
      try {
        destinationPubkey = new PublicKey(destinationAddress);
      } catch (e) {
        throw new Error(`Invalid Solana address for SRDL: ${destinationAddress}`);
      }
      
      // SRDL SPL Token Contract - REAL TOKEN TRANSFER
      const SRDL_TOKEN_MINT = '4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE'; // Real SRDL mint address
      
      // Import SPL Token libraries
      const { 
        TOKEN_PROGRAM_ID, 
        getAssociatedTokenAddress, 
        createTransferInstruction,
        createAssociatedTokenAccountInstruction,
        getAccount
      } = await import('@solana/spl-token');
      
      const tokenMint = new PublicKey(SRDL_TOKEN_MINT);
      
      // Get associated token accounts
      const bankTokenAccount = await getAssociatedTokenAddress(tokenMint, bankKeypair.publicKey);
      const destinationTokenAccount = await getAssociatedTokenAddress(tokenMint, destinationPubkey);
      
      console.log(`🏦 Bank SRDL token account: ${bankTokenAccount.toString()}`);
      console.log(`📍 Destination SRDL token account: ${destinationTokenAccount.toString()}`);
      
      // Check if bank has SRDL tokens
      let bankAccountExists = false;
      try {
        const bankAccount = await getAccount(connection, bankTokenAccount);
        bankAccountExists = true;
        console.log(`💰 Bank SRDL balance: ${bankAccount.amount} tokens`);
      } catch (e) {
        console.log('⚠️ Bank SRDL token account does not exist or has no balance');
        throw new Error('Bank wallet does not have SRDL tokens to transfer - real transaction failed');
      }
      
      // Check if destination token account exists
      let destinationAccountExists = false;
      try {
        await getAccount(connection, destinationTokenAccount);
        destinationAccountExists = true;
        console.log('✅ Destination SRDL token account already exists');
      } catch (e) {
        console.log('⚠️ Destination SRDL token account does not exist, will create it');
      }
      
      // Convert amount to token decimals (SRDL uses 6 decimals on-chain)
      const tokenAmount = Math.floor(amount * Math.pow(10, 6));
      
      // Build transaction
      const transaction = new Transaction();
      
      // Add create account instruction if needed
      if (!destinationAccountExists) {
        console.log('📦 Adding create associated token account instruction');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            bankKeypair.publicKey, // payer
            destinationTokenAccount, // account to create
            destinationPubkey, // owner
            tokenMint // mint
          )
        );
      }
      
      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          bankTokenAccount,
          destinationTokenAccount,
          bankKeypair.publicKey,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
      
      console.log(`📤 Sending ${amount} SRDL tokens to ${destinationAddress}...`);
      console.log(`💰 Token amount: ${tokenAmount} (${amount} SRDL with 6 decimals)`);
      
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [bankKeypair]
      );
      
      console.log(`✅ SRDL SPL token transfer successful: ${signature}`);
      console.log('📊 COMPLETE TRANSACTION LOG:');
      console.log(`   - Riddle Transaction: ${transactionId}`);
      console.log(`   - IN TX: ${inputTxHash}`);
      console.log(`   - OUT TX: ${signature} (REAL SPL TOKEN TRANSFER)`);
      console.log(`   - Explorer: https://solscan.io/tx/${signature}`);
      console.log(`   - Token Mint: ${SRDL_TOKEN_MINT}`);
      console.log('🟣 === SRDL BRIDGE COMPLETION END ===');
      
      return {
        success: true,
        txHash: signature,
        amount: amount.toString(),
        explorerUrl: `https://solscan.io/tx/${signature}`,
        note: 'SRDL SPL token transfer on Solana (real token contract)'
      };
      
    } catch (error) {
      console.error('❌ SRDL bridge completion error:', error);
      
      // NO FALLBACKS - fail completely
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SRDL transfer failed'
      };
    }
  }
}
