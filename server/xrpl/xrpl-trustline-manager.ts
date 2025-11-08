// Production-Ready XRPL Trustline Manager with Cached Private Keys
// Implements 100% trustline removal with automatic token redemption
// Based on XRPL best practices guide

import { Client as XRPLClient, Wallet, TrustSet, Payment } from 'xrpl';

const XRPL_SERVER = 'wss://s1.ripple.com';

// ISSUES WALLET - For accepting dust/problematic tokens that can't be redeemed
// This wallet accepts tokens that users can't swap or redeem
const ISSUES_WALLET_ADDRESS = 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // RiddleSwap bank wallet

interface TrustLine {
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
  limit_peer: string;
  no_ripple: boolean;
  no_ripple_peer: boolean;
  authorized: boolean;
  peer_authorized: boolean;
  freeze: boolean;
  freeze_peer: boolean;
}

interface TrustlineRemovalResult {
  success: boolean;
  message: string;
  txHash?: string;
  error?: string;
  details?: {
    redemptionTx?: string;
    removalTx?: string;
    balance?: string;
    step?: 'redemption' | 'removal';
  };
}

/**
 * Query ALL trustlines for an account with pagination support
 * Handles >200 trustlines by following marker pagination
 */
export async function getAllTrustlines(
  walletAddress: string
): Promise<TrustLine[]> {
  const client = new XRPLClient(XRPL_SERVER);
  
  try {
    await client.connect();
    console.log(`🔍 [TRUSTLINES] Fetching all trustlines for ${walletAddress}`);
    
    let allLines: TrustLine[] = [];
    let marker: string | undefined = undefined;
    let pageCount = 0;
    
    // Paginate through all trustlines (max 200 per request)
    do {
      pageCount++;
      console.log(`📄 [TRUSTLINES] Fetching page ${pageCount}...`);
      
      const response = await client.request({
        command: 'account_lines',
        account: walletAddress,
        limit: 200,
        marker: marker,
        ledger_index: 'validated'
      });
      
      const lines = response.result.lines.map((line: any) => ({
        currency: line.currency,
        issuer: line.account, // XRPL uses 'account' for issuer
        balance: line.balance,
        limit: line.limit,
        limit_peer: line.limit_peer,
        no_ripple: line.no_ripple,
        no_ripple_peer: line.no_ripple_peer,
        authorized: line.authorized,
        peer_authorized: line.peer_authorized,
        freeze: line.freeze,
        freeze_peer: line.freeze_peer
      })) as TrustLine[];
      allLines = allLines.concat(lines);
      marker = response.result.marker as string | undefined;
      
      console.log(`📄 [TRUSTLINES] Page ${pageCount}: ${lines.length} trustlines (Total: ${allLines.length})`);
      
    } while (marker); // Continue if there's a next page
    
    console.log(`✅ [TRUSTLINES] Total trustlines found: ${allLines.length}`);
    return allLines;
    
  } catch (error) {
    console.error('❌ [TRUSTLINES] Failed to fetch trustlines:', error);
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Send dust/problematic tokens to issues wallet
 * Used when tokens can't be redeemed to issuer
 */
export async function sendTokensToIssuesWallet(
  privateKey: string,
  issuer: string,
  currency: string,
  balance: string
): Promise<{ success: boolean; txHash?: string; error?: string; delivered?: string }> {
  const client = new XRPLClient(XRPL_SERVER);
  
  try {
    const wallet = Wallet.fromSeed(privateKey);
    await client.connect();
    
    console.log(`🗑️ [DUST] Sending ${balance} ${currency} to issues wallet ${ISSUES_WALLET_ADDRESS}`);
    
    // Create payment transaction to send tokens to issues wallet
    const payment: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: ISSUES_WALLET_ADDRESS,
      Amount: {
        currency: currency,
        value: balance,
        issuer: issuer
      },
      DeliverMax: {
        currency: currency,
        value: balance,
        issuer: issuer
      },
      SendMax: {
        currency: currency,
        value: balance,
        issuer: wallet.address
      },
      Flags: 131072 // tfPartialPayment
    };
    
    // Auto-fill sequence, fee, etc.
    const prepared = await client.autofill(payment);
    
    // Sign and submit
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    // Check transaction result
    const meta = result.result.meta as any;
    const txResult = meta?.TransactionResult;
    
    if (txResult === 'tesSUCCESS') {
      const deliveredAmount = meta?.delivered_amount;
      let delivered = '0';
      
      if (typeof deliveredAmount === 'object' && deliveredAmount.value) {
        delivered = deliveredAmount.value;
      }
      
      console.log(`✅ [DUST] Successfully sent ${delivered} ${currency} to issues wallet`);
      console.log(`📋 [DUST] Transaction hash: ${result.result.hash}`);
      
      return {
        success: true,
        txHash: result.result.hash,
        delivered: delivered
      };
    } else {
      console.error(`❌ [DUST] Transaction failed: ${txResult}`);
      return {
        success: false,
        error: `Dust transfer failed: ${txResult}`
      };
    }
    
  } catch (error) {
    console.error('❌ [DUST] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Dust transfer failed'
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Redeem tokens back to issuer to zero out balance
 * Uses partial payment flag for safety
 */
export async function redeemTokensToIssuer(
  privateKey: string,
  issuer: string,
  currency: string,
  balance: string
): Promise<{ success: boolean; txHash?: string; error?: string; delivered?: string }> {
  const client = new XRPLClient(XRPL_SERVER);
  
  try {
    const wallet = Wallet.fromSeed(privateKey);
    await client.connect();
    
    console.log(`💸 [REDEEM] Redeeming ${balance} ${currency} back to issuer ${issuer}`);
    
    // Create payment transaction to send tokens back to issuer (redemption)
    const payment: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: issuer,
      Amount: {
        currency: currency,
        value: balance,
        issuer: issuer
      },
      DeliverMax: {
        currency: currency,
        value: balance,
        issuer: issuer
      },
      SendMax: {
        currency: currency,
        value: balance,
        issuer: wallet.address // Important: SendMax issuer is YOUR address
      },
      Flags: 131072 // tfPartialPayment - allows partial delivery if needed
    };
    
    // Auto-fill sequence, fee, etc.
    const prepared = await client.autofill(payment);
    
    // Sign and submit
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    // Check transaction result
    const meta = result.result.meta as any;
    const txResult = meta?.TransactionResult;
    
    if (txResult === 'tesSUCCESS') {
      // Get actual delivered amount
      const deliveredAmount = meta?.delivered_amount;
      let delivered = '0';
      
      if (typeof deliveredAmount === 'object' && deliveredAmount.value) {
        delivered = deliveredAmount.value;
      }
      
      console.log(`✅ [REDEEM] Successfully redeemed ${delivered} ${currency}`);
      console.log(`📋 [REDEEM] Transaction hash: ${result.result.hash}`);
      
      return {
        success: true,
        txHash: result.result.hash,
        delivered: delivered
      };
    } else {
      console.error(`❌ [REDEEM] Transaction failed: ${txResult}`);
      return {
        success: false,
        error: `Redemption failed: ${txResult}`
      };
    }
    
  } catch (error) {
    console.error('❌ [REDEEM] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Redemption failed'
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Remove trustline by setting limit to 0
 * Only works when balance is 0
 */
export async function removeTrustlineAfterZeroBalance(
  privateKey: string,
  issuer: string,
  currency: string,
  clearNoRipple: boolean = true,
  clearFreeze: boolean = true
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const client = new XRPLClient(XRPL_SERVER);
  
  try {
    const wallet = Wallet.fromSeed(privateKey);
    await client.connect();
    
    console.log(`🗑️ [REMOVE] Removing trustline for ${currency} (${issuer})`);
    
    // Build flags to clear No Ripple and Freeze if needed
    let flags = 0;
    if (clearNoRipple) {
      flags |= 0x00040000; // tfClearNoRipple (262144)
    }
    if (clearFreeze) {
      flags |= 0x00200000; // tfClearFreeze (2097152)
    }
    
    // Create TrustSet transaction with limit = 0
    const trustSet: TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: currency,
        value: '0', // Setting to 0 removes the trustline
        issuer: issuer
      },
      Flags: flags
    };
    
    // Auto-fill and submit
    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    // Check result
    const meta = result.result.meta as any;
    const txResult = meta?.TransactionResult;
    
    if (txResult === 'tesSUCCESS') {
      console.log(`✅ [REMOVE] Trustline removed successfully`);
      console.log(`📋 [REMOVE] Transaction hash: ${result.result.hash}`);
      
      return {
        success: true,
        txHash: result.result.hash
      };
    } else {
      console.error(`❌ [REMOVE] Transaction failed: ${txResult}`);
      return {
        success: false,
        error: `Removal failed: ${txResult}`
      };
    }
    
  } catch (error) {
    console.error('❌ [REMOVE] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed'
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Complete 100% trustline removal with dust handling
 * 1. Check balance
 * 2. If balance > 0, try to redeem tokens to issuer
 * 3. If redemption fails, send dust to issues wallet
 * 4. Set limit to 0 to remove trustline
 */
export async function removeCompleteTrustline(
  privateKey: string,
  issuer: string,
  currency: string,
  sendDustToIssuesWallet: boolean = false
): Promise<TrustlineRemovalResult> {
  const wallet = Wallet.fromSeed(privateKey);
  const client = new XRPLClient(XRPL_SERVER);
  
  try {
    await client.connect();
    
    console.log(`🚀 [COMPLETE REMOVE] Starting complete removal for ${currency} (${issuer})`);
    
    // Step 1: Check current balance
    const balances = await client.getBalances(wallet.address);
    const tokenBalance = balances.find(
      b => b.currency === currency && b.issuer === issuer
    );
    
    await client.disconnect();
    
    let redemptionTxHash: string | undefined;
    
    // Step 2: If balance > 0, try to redeem tokens first
    if (tokenBalance && parseFloat(tokenBalance.value) > 0) {
      console.log(`💰 [COMPLETE REMOVE] Non-zero balance: ${tokenBalance.value} ${currency}`);
      console.log(`🔄 [COMPLETE REMOVE] Attempting to redeem tokens to issuer...`);
      
      const redeemResult = await redeemTokensToIssuer(
        privateKey,
        issuer,
        currency,
        tokenBalance.value
      );
      
      if (!redeemResult.success) {
        // If redemption failed and dust handling is enabled, try sending to issues wallet
        if (sendDustToIssuesWallet) {
          console.log(`⚠️ [COMPLETE REMOVE] Redemption failed, trying to send dust to issues wallet...`);
          
          const dustResult = await sendTokensToIssuesWallet(
            privateKey,
            issuer,
            currency,
            tokenBalance.value
          );
          
          if (!dustResult.success) {
            return {
              success: false,
              message: `Failed to redeem or transfer dust: ${dustResult.error}`,
              error: `Redemption: ${redeemResult.error}, Dust transfer: ${dustResult.error}`,
              details: {
                step: 'redemption',
                balance: tokenBalance.value
              }
            };
          }
          
          redemptionTxHash = dustResult.txHash;
          console.log(`✅ [COMPLETE REMOVE] Dust sent to issues wallet: ${dustResult.delivered} ${currency}`);
        } else {
          return {
            success: false,
            message: `Failed to redeem tokens: ${redeemResult.error}. Try enabling 'Send dust to issues wallet' option.`,
            error: redeemResult.error,
            details: {
              step: 'redemption',
              balance: tokenBalance.value
            }
          };
        }
      } else {
        redemptionTxHash = redeemResult.txHash;
        console.log(`✅ [COMPLETE REMOVE] Tokens redeemed: ${redeemResult.delivered} ${currency}`);
      }
      
      // Wait 1 second for ledger to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log(`✅ [COMPLETE REMOVE] Balance already zero, proceeding to removal`);
    }
    
    // Step 3: Remove trustline (set limit to 0)
    console.log(`🗑️ [COMPLETE REMOVE] Removing trustline...`);
    const removeResult = await removeTrustlineAfterZeroBalance(
      privateKey,
      issuer,
      currency,
      true, // Clear NoRipple
      true  // Clear Freeze
    );
    
    if (!removeResult.success) {
      return {
        success: false,
        message: `Failed to remove trustline: ${removeResult.error}`,
        error: removeResult.error,
        details: {
          step: 'removal',
          redemptionTx: redemptionTxHash,
            balance: tokenBalance?.value || '0'
          }
        };
      }
      
      console.log(`✅ [COMPLETE REMOVE] Trustline completely removed!`);
      
      return {
        success: true,
        message: `Trustline for ${currency} completely removed`,
        txHash: removeResult.txHash,
        details: {
          redemptionTx: redemptionTxHash,
          removalTx: removeResult.txHash,
          balance: tokenBalance?.value || '0'
        }
      };
      
    } catch (error) {
      console.error('❌ [COMPLETE REMOVE] Error:', error);
      return {
        success: false,
        message: 'Complete removal failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Remove ALL trustlines for an account
   * Automatically redeems balances and removes each trustline
   */
  export async function removeAllTrustlines(
    privateKey: string,
    sendDustToIssuesWallet: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    totalRemoved: number;
    failed: Array<{ currency: string; issuer: string; error: string }>;
    details: Array<TrustlineRemovalResult>;
  }> {
    const wallet = Wallet.fromSeed(privateKey);
    
    try {
      console.log(`🚀 [REMOVE ALL] Starting complete trustline removal for ${wallet.address}`);
      if (sendDustToIssuesWallet) {
        console.log(`🗑️ [REMOVE ALL] Dust handling enabled - problematic tokens will be sent to issues wallet`);
      }
      
      // Get all trustlines
      const trustlines = await getAllTrustlines(wallet.address);
      console.log(`📊 [REMOVE ALL] Found ${trustlines.length} trustlines to remove`);
      
      if (trustlines.length === 0) {
        return {
          success: true,
          message: 'No trustlines to remove',
          totalRemoved: 0,
          failed: [],
          details: []
        };
      }
      
      const results: TrustlineRemovalResult[] = [];
      const failed: Array<{ currency: string; issuer: string; error: string }> = [];
      let successCount = 0;
      
      // Process each trustline sequentially (safer than parallel)
      for (let i = 0; i < trustlines.length; i++) {
        const line = trustlines[i];
        console.log(`\n🔄 [REMOVE ALL] Processing ${i + 1}/${trustlines.length}: ${line.currency} (${line.issuer})`);
        
        const result = await removeCompleteTrustline(
          privateKey,
          line.issuer,
          line.currency,
          sendDustToIssuesWallet
        );
        
        results.push(result);
        
        if (result.success) {
          successCount++;
          console.log(`✅ [REMOVE ALL] Success (${successCount}/${trustlines.length})`);
        } else {
          failed.push({
            currency: line.currency,
            issuer: line.issuer,
            error: result.error || 'Unknown error'
          });
          console.error(`❌ [REMOVE ALL] Failed: ${result.error}`);
        }
        
        // Wait 1 second between operations to avoid rate limiting
        if (i < trustlines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`\n🎯 [REMOVE ALL] Complete! Removed: ${successCount}/${trustlines.length}`);
      
      return {
        success: successCount === trustlines.length,
        message: `Removed ${successCount} of ${trustlines.length} trustlines`,
        totalRemoved: successCount,
        failed: failed,
        details: results
      };
      
    } catch (error) {
      console.error('❌ [REMOVE ALL] Fatal error:', error);
      return {
        success: false,
        message: 'Failed to remove trustlines',
        totalRemoved: 0,
        failed: [],
        details: []
      };
    }
  }
  
  /**
   * Verify trustline is completely removed
   * Returns true if trustline no longer exists
   */
  export async function verifyTrustlineRemoved(
    walletAddress: string,
    issuer: string,
    currency: string
  ): Promise<{ removed: boolean; stillExists?: boolean; balance?: string }> {
    const client = new XRPLClient(XRPL_SERVER);
    
    try {
      await client.connect();
      
      const response = await client.request({
        command: 'account_lines',
        account: walletAddress,
        peer: issuer,
        ledger_index: 'validated'
      });
      
      const lines = response.result.lines.map((line: any) => ({
        currency: line.currency,
        issuer: line.account, // XRPL uses 'account' for issuer
        balance: line.balance,
        limit: line.limit,
        limit_peer: line.limit_peer,
        no_ripple: line.no_ripple,
        no_ripple_peer: line.no_ripple_peer,
        authorized: line.authorized,
        peer_authorized: line.peer_authorized,
        freeze: line.freeze,
        freeze_peer: line.freeze_peer
      })) as TrustLine[];
      const trustline = lines.find(
        line => line.currency === currency && line.issuer === issuer
      );
      
      if (!trustline) {
        console.log(`✅ [VERIFY] Trustline completely removed`);
        return { removed: true };
      }
      
      console.log(`⚠️ [VERIFY] Trustline still exists:`, trustline);
      return {
        removed: false,
        stillExists: true,
        balance: trustline.balance
      };
      
    } catch (error) {
      console.error('❌ [VERIFY] Verification failed:', error);
      throw error;
    } finally {
      await client.disconnect();
    }
  }
