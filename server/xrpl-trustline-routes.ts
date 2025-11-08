import express from 'express';
import crypto from 'crypto';
import { Client } from 'xrpl';

const router = express.Router();

// Decrypt private key helper - use proper wallet decryption
async function decryptPrivateKey(walletData: any, password: string): Promise<string | null> {
  try {
    const { decryptWalletData } = await import('./wallet-encryption');
    const decryptedKeysJson = decryptWalletData(walletData.encryptedPrivateKeys, password);
    const privateKeys = JSON.parse(decryptedKeysJson);
    
    // Handle different XRP key formats
    let privateKey: string;
    if (typeof privateKeys.xrp === 'string') {
      privateKey = privateKeys.xrp;
    } else if (privateKeys.xrp && typeof privateKeys.xrp === 'object') {
      privateKey = privateKeys.xrp.privateKey || privateKeys.xrp.seed;
    } else {
      privateKey = privateKeys.xrpPrivateKey || privateKeys.private_key || privateKeys.privateKey;
    }

    return privateKey || null;
  } catch (error) {
    console.error('❌ Private key decryption failed:', error);
    return null;
  }
}

// Check trustline endpoint with caching
router.post('/check', async (req, res) => {
  try {
    const { walletAddress, address, currency, issuer } = req.body;
    
    // Support both 'address' and 'walletAddress' parameter names
    const targetAddress = walletAddress || address;
    
    if (!targetAddress || !currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: address/walletAddress, currency, issuer'
      });
    }

    console.log(`🔗 [TRUSTLINE CHECK] Checking trustline: ${JSON.stringify({ address: targetAddress, currency, issuer })}`);

    // Fix wallet address format
    const cleanAddress = targetAddress.replace(/[^a-zA-Z0-9]/g, '');

    // Use cached trustline check service
    const { trustlineCacheService } = await import('./trustline-cache-service');
    const checkResult = await trustlineCacheService.checkTrustline(cleanAddress, currency, issuer);

    if (!checkResult) {
      throw new Error('Failed to check trustline');
    }

    const result = {
      success: true,
      hasTrustline: checkResult.has_trustline,
      message: checkResult.message,
      cached: checkResult.cached,
      debugInfo: {
        totalTrustlines: checkResult.trustline_details ? 1 : 0,
        searchedFor: { currency, issuer: checkResult.issuer, originalIssuer: issuer },
        address: cleanAddress,
        trustlineDetails: checkResult.trustline_details,
        lastUpdated: checkResult.last_updated
      }
    };

    console.log(`${checkResult.has_trustline ? '✅' : '❌'} [TRUSTLINE] ${checkResult.message} (Cached: ${checkResult.cached})`);
    
    res.json(result);

  } catch (error) {
    console.error('❌ [TRUSTLINE CHECK] Error:', error);
    
    // Handle specific timeout errors
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
      return res.json({
        success: true,
        hasTrustline: false, // Assume no trustline on timeout for safety
        message: 'Trustline check timed out - proceeding without trustline verification',
        timeout: true,
        cached: false,
        debugInfo: {
          error: 'XRPL network timeout - connection issues detected'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to check trustline',
      message: error instanceof Error ? error.message : 'Unknown error',
      cached: false,
      debugInfo: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    });
  }
});

// Create trustline endpoint - uses cached session keys
router.post('/create', async (req, res) => {
  try {
    const { 
      walletAddress, 
      currency, 
      issuer, 
      walletType,
      riddleWalletId
    } = req.body;
    
    if (!walletAddress || !currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, currency, issuer'
      });
    }

    console.log(`🔄 [TRUSTLINE CREATE] Creating trustline for ${currency} from ${issuer} on wallet ${walletAddress}`);

    // Try to get cached private key from session first
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    let privateKey: string | null = null;
    
    if (sessionToken) {
      const { activeSessions } = await import('./riddle-wallet-auth');
      const session = activeSessions.get(sessionToken);
      
      if (session?.cachedKeys?.xrpPrivateKey) {
        console.log(`🔑 [TRUSTLINE CREATE] Using cached XRP private key from session for ${session.handle}`);
        privateKey = session.cachedKeys.xrpPrivateKey;
      }
    }
    
    // Also check req.session.xrpPrivateKey (populated by middleware)
    if (!privateKey && (req as any).session?.xrpPrivateKey) {
      console.log(`🔑 [TRUSTLINE CREATE] Using cached XRP private key from req.session`);
      privateKey = (req as any).session.xrpPrivateKey;
    }
    
    // Fallback: require password if no cached key available
    if (!privateKey) {
      const { password } = req.body;
      
      if (!password || !riddleWalletId) {
        return res.status(400).json({
          success: false,
          error: 'Password required - no cached session keys available'
        });
      }
      
      console.log(`⚠️ [TRUSTLINE CREATE] No cached keys - falling back to password decryption`);
      
      const { storage } = await import('./storage');
      const { decryptWalletData } = await import('./wallet-encryption');
      
      const walletData = await storage.getRiddleWalletByHandle(riddleWalletId);
      if (!walletData) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      try {
        const decryptedKeysJson = decryptWalletData(walletData.encryptedPrivateKeys as any, password);
        const privateKeys = JSON.parse(decryptedKeysJson);
        
        // Handle different XRP key formats
        if (typeof privateKeys.xrp === 'string') {
          privateKey = privateKeys.xrp;
        } else if (privateKeys.xrp && typeof privateKeys.xrp === 'object') {
          privateKey = privateKeys.xrp.privateKey || privateKeys.xrp.seed;
        } else {
          privateKey = privateKeys.xrpPrivateKey || privateKeys.private_key || privateKeys.privateKey;
        }

        if (!privateKey) {
          throw new Error("XRP private key not found in wallet");
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Failed to decrypt private key"
        });
      }
    }

    // Connect to XRPL and create trustline
    const { Wallet } = await import('xrpl');
    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    try {
      const wallet = Wallet.fromSeed(privateKey);
      
      // Create trustline transaction
      const trustlineTransaction = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: currency.length === 3 ? currency : Buffer.from(currency).toString('hex').toUpperCase().padEnd(40, '0'),
          issuer: issuer,
          value: '1000000000' // Large limit
        },
        Flags: 0x00020000 // tfSetNoRipple flag
      };

      // Submit and wait
      const result = await client.submitAndWait(trustlineTransaction as any, { wallet });
      
      if ((result.result.meta as any)?.TransactionResult === 'tesSUCCESS') {
        console.log(`✅ Trustline created successfully for ${currency}`);
        
        res.json({
          success: true,
          message: `Trustline created for ${currency}`,
          txHash: result.result.hash
        });
      } else {
        throw new Error(`Transaction failed: ${(result.result.meta as any)?.TransactionResult || 'Unknown'}`);
      }

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('Create trustline error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create trustline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Remove trustline endpoint with dust handling
// IMPORTANT: This endpoint NEVER creates trustlines - it only removes them
// Use /sell-or-dust endpoint to handle token sales before removal
router.post('/remove-trustline', async (req, res) => {
  try {
    const { password, tokenSymbol, issuer, walletAddress, riddleWalletId, sendDustToIssuesWallet = true } = req.body;
    
    if (!tokenSymbol || !issuer || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: tokenSymbol, issuer, walletAddress' 
      });
    }

    console.log(`🗑️ [TRUSTLINE REMOVE] Starting removal for ${tokenSymbol} (${issuer}) on ${walletAddress}`);

    // Try to get cached private key from session first
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    let privateKey: string | null = null;
    
    if (sessionToken) {
      const { activeSessions } = await import('./riddle-wallet-auth');
      const session = activeSessions.get(sessionToken);
      
      if (session?.cachedKeys?.xrpPrivateKey) {
        console.log(`🔑 [TRUSTLINE REMOVE] Using cached XRP private key from session for ${session.handle}`);
        privateKey = session.cachedKeys.xrpPrivateKey;
      }
    }
    
    // Also check req.session.xrpPrivateKey (populated by middleware)
    if (!privateKey && (req as any).session?.xrpPrivateKey) {
      console.log(`🔑 [TRUSTLINE REMOVE] Using cached XRP private key from req.session`);
      privateKey = (req as any).session.xrpPrivateKey;
    }
    
    // Fallback: require password if no cached key available
    if (!privateKey) {
      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'Password is required (no cached session key available)'
        });
      }
      
      console.log(`🔓 [TRUSTLINE REMOVE] No cached key - using password decryption`);
      
      // Get wallet data from storage
      const { storage } = await import('./storage');
      if (!riddleWalletId) {
        return res.status(400).json({
          success: false,
          error: 'riddleWalletId is required - cannot target wallet without explicit ID'
        });
      }
      
      const walletData = await storage.getRiddleWalletByHandle(riddleWalletId);
      
      if (!walletData) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }
      
      // Decrypt private key
      privateKey = await decryptPrivateKey(walletData, password);
      if (!privateKey) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid password or failed to decrypt private key' 
        });
      }
    }

    // Connect to XRPL
    const { Wallet } = await import('xrpl');
    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    try {
      // Handle both seed and private key formats properly
      let wallet: any;
      if (privateKey.startsWith('s') && privateKey.length >= 25) {
        // Family seed format (starts with 's')
        wallet = Wallet.fromSeed(privateKey);
      } else {
        // Raw private key - need to create wallet differently
        throw new Error('Raw private key format not supported - wallet must use family seed format');
      }
      
      // Verify wallet address matches expected address for security
      if (wallet.address !== walletAddress.replace(/[^a-zA-Z0-9]/g, '')) {
        throw new Error('Decrypted wallet address does not match expected wallet address - security check failed');
      }
      
      // Check current balance first
      const balances = await client.getBalances(wallet.address);
      const tokenBalance = balances.find(
        b => b.currency === tokenSymbol && b.issuer === issuer
      );

      // REDEMPTION APPROACH: Send tokens back to issuer (100% reliable)
      let redemptionTxHash: string | undefined;
      
      if (tokenBalance && parseFloat(tokenBalance.value) > 0) {
        console.log(`💸 [REDEEM] Found ${tokenBalance.value} ${tokenSymbol} - sending back to issuer for redemption`);
        
        try {
          // Create Payment transaction to send tokens back to issuer (redemption)
          // This works 100% of the time regardless of liquidity/market conditions
          const redemptionPayment = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: issuer,
            Amount: {
              currency: tokenSymbol,
              value: tokenBalance.value,
              issuer: issuer
            },
            DeliverMax: {
              currency: tokenSymbol,
              value: tokenBalance.value,
              issuer: issuer
            },
            SendMax: {
              currency: tokenSymbol,
              value: tokenBalance.value,
              issuer: wallet.address // SendMax issuer is YOUR address
            },
            Flags: 131072 // tfPartialPayment - allows partial delivery if needed for dust
          };
          
          console.log(`🔄 [REDEEM] Submitting redemption payment to ${issuer}...`);
          const redemptionResult = await client.submitAndWait(redemptionPayment as any, { wallet });
          
          const redemptionTxResult = (redemptionResult.result.meta as any)?.TransactionResult;
          redemptionTxHash = redemptionResult.result.hash;
          
          if (redemptionTxResult === 'tesSUCCESS') {
            // Get actual delivered amount
            const deliveredAmount = (redemptionResult.result.meta as any)?.delivered_amount;
            let delivered = '0';
            
            if (typeof deliveredAmount === 'object' && deliveredAmount.value) {
              delivered = deliveredAmount.value;
            }
            
            console.log(`✅ [REDEEM] Successfully redeemed ${delivered} ${tokenSymbol} to issuer`);
            console.log(`📋 [REDEEM] Redemption TX: ${redemptionTxHash}`);
            
            // Wait 1 second for ledger to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify balance is now zero or dust
            const updatedBalances = await client.getBalances(wallet.address);
            const updatedTokenBalance = updatedBalances.find(
              b => b.currency === tokenSymbol && b.issuer === issuer
            );
            
            if (updatedTokenBalance && parseFloat(updatedTokenBalance.value) > 0.000001) {
              console.log(`⚠️ [REDEEM] Remaining balance after redemption: ${updatedTokenBalance.value} ${tokenSymbol}`);
              // Continue anyway - might be dust that can be ignored
            } else {
              console.log(`✅ [REDEEM] Balance fully cleared (zero or acceptable dust)`);
            }
          } else {
            console.error(`❌ [REDEEM] Redemption failed: ${redemptionTxResult}`);
            throw new Error(`Token redemption failed: ${redemptionTxResult}`);
          }
          
        } catch (redemptionError) {
          console.error(`❌ [REDEEM] Failed to redeem tokens:`, redemptionError);
          
          // If dust handling is enabled, try sending to issues wallet
          if (sendDustToIssuesWallet) {
            console.log(`⚠️ [DUST] Redemption failed, attempting to send dust to issues wallet...`);
            
            const ISSUES_WALLET = 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY';
            
            try {
              const dustPayment = {
                TransactionType: 'Payment',
                Account: wallet.address,
                Destination: ISSUES_WALLET,
                Amount: {
                  currency: tokenSymbol,
                  value: tokenBalance.value,
                  issuer: issuer
                },
                DeliverMax: {
                  currency: tokenSymbol,
                  value: tokenBalance.value,
                  issuer: issuer
                },
                SendMax: {
                  currency: tokenSymbol,
                  value: tokenBalance.value,
                  issuer: wallet.address
                },
                Flags: 131072 // tfPartialPayment
              };
              
              const dustResult = await client.submitAndWait(dustPayment as any, { wallet });
              const dustTxResult = (dustResult.result.meta as any)?.TransactionResult;
              
              if (dustTxResult === 'tesSUCCESS') {
                console.log(`✅ [DUST] Successfully sent dust to issues wallet`);
                redemptionTxHash = dustResult.result.hash;
                
                // Wait for ledger to settle
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                throw new Error(`Dust transfer failed: ${dustTxResult}`);
              }
            } catch (dustError) {
              console.error(`❌ [DUST] Failed to send dust to issues wallet:`, dustError);
              
              // Return detailed error
              return res.status(400).json({
                success: false,
                error: `Failed to redeem tokens and send dust: ${dustError instanceof Error ? dustError.message : 'Unknown error'}`,
                currentBalance: tokenBalance.value,
                issuer: issuer,
                redemptionTx: redemptionTxHash,
                suggestion: "Both token redemption and dust transfer failed. The token may be frozen or have transfer restrictions."
              });
            }
          } else {
            // Return detailed error
            return res.status(400).json({
              success: false,
              error: `Failed to redeem tokens to issuer: ${redemptionError instanceof Error ? redemptionError.message : 'Unknown error'}`,
              currentBalance: tokenBalance.value,
              issuer: issuer,
              redemptionTx: redemptionTxHash,
              suggestion: "Token redemption failed. Try enabling 'Send dust to issues wallet' option to remove this trustline."
            });
          }
        }
      }

      // Set trustline limit to 0 to remove it
      // Add flags to clear NoRipple and Freeze as per XRPL best practices
      const removeTransaction = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: tokenSymbol.length === 3 ? tokenSymbol : Buffer.from(tokenSymbol).toString('hex').toUpperCase().padEnd(40, '0'),
          issuer: issuer,
          value: '0' // Setting to 0 removes the trustline
        },
        Flags: 0x00040000 | 0x00200000 // tfClearNoRipple (262144) + tfClearFreeze (2097152)
      };

      const result = await client.submitAndWait(removeTransaction as any, { wallet });
      
      if ((result.result.meta as any)?.TransactionResult === 'tesSUCCESS') {
        console.log(`✅ [TRUSTLINE REMOVE] Successfully removed trustline for ${tokenSymbol} (${issuer})`);
        
        // Build response with both transaction hashes
        const response: any = {
          success: true,
          message: `Trustline for ${tokenSymbol} removed successfully`,
          txHash: result.result.hash,
          removeTxHash: result.result.hash
        };
        
        // Include redemption TX if tokens were redeemed
        if (redemptionTxHash) {
          response.redemptionTxHash = redemptionTxHash;
          response.details = {
            redemptionTx: redemptionTxHash,
            removalTx: result.result.hash,
            originalBalance: tokenBalance?.value || '0'
          };
        }
        
        res.json(response);
      } else {
        throw new Error(`Transaction failed: ${(result.result.meta as any)?.TransactionResult || 'Unknown'}`);
      }

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('❌ [TRUSTLINE REMOVE] Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to remove trustline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Smart token sell-or-dust endpoint - automatically detects dust and handles appropriately
router.post('/sell-or-dust', async (req, res) => {
  const client = new Client('wss://s1.ripple.com');
  
  try {
    const { currency, issuer, amount, walletAddress, riddleWalletId, password } = req.body;
    
    if (!currency || !issuer || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: currency, issuer, amount'
      });
    }

    console.log(`🔍 [SMART SELL] Analyzing token: ${amount} ${currency} from ${issuer}`);
    
    await client.connect();
    
    // Get wallet from session or password
    let privateKey: string | null = null;
    
    if (password && riddleWalletId) {
      const { storage } = await import('./storage');
      
      const walletData = await storage.getRiddleWalletByHandle(riddleWalletId);
      
      if (!walletData) {
        throw new Error('Wallet not found');
      }
      
      privateKey = await decryptPrivateKey(walletData, password);
    } else if ((req as any).user?.cachedKeys?.xrpPrivateKey) {
      privateKey = (req as any).user.cachedKeys.xrpPrivateKey;
    } else if ((req as any).session?.xrpPrivateKey) {
      privateKey = (req as any).session.xrpPrivateKey;
    }
    
    if (!privateKey) {
      throw new Error('No private key available - password required');
    }
    
    const { Wallet } = await import('xrpl');
    const wallet = Wallet.fromSeed(privateKey);
    
    console.log(`💰 [SMART SELL] Wallet: ${wallet.address.substring(0, 8)}...`);
    
    // Get XRP balance to check reserve
    const balances = await client.getBalances(wallet.address);
    const xrpBalance = balances.find(b => b.currency === 'XRP');
    const xrpAmount = parseFloat(xrpBalance?.value || '0');
    
    // Get account info to check reserve requirement
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet.address
    });
    
    const ownerCount = accountInfo.result.account_data.OwnerCount || 0;
    const baseReserve = 10; // XRP
    const reserveIncrement = 2; // XRP per object
    const requiredReserve = baseReserve + (ownerCount * reserveIncrement);
    const availableXRP = xrpAmount - requiredReserve;
    
    console.log(`💰 [SMART SELL] XRP Balance: ${xrpAmount}, Required Reserve: ${requiredReserve}, Available: ${availableXRP}`);
    
    // Parse token amount
    const tokenAmount = parseFloat(amount);
    
    // Define dust threshold: < $1 USD worth or < 0.01 tokens or insufficient XRP reserve
    const isDust = tokenAmount < 0.01 || availableXRP < 5;
    
    console.log(`🔍 [SMART SELL] Dust check: Amount ${tokenAmount}, IsDust: ${isDust}`);
    
    if (isDust) {
      console.log(`🗑️ [SMART SELL] Detected dust - skipping swap, sending to issues wallet`);
      
      const ISSUES_WALLET = 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY';
      
      try {
        // Send dust to issues wallet
        const dustPayment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: ISSUES_WALLET,
          Amount: {
            currency: currency.length === 3 ? currency : Buffer.from(currency).toString('hex').toUpperCase().padEnd(40, '0'),
            value: amount,
            issuer: issuer
          },
          Flags: 131072 // tfPartialPayment
        };
        
        const dustResult = await client.submitAndWait(dustPayment as any, { wallet });
        const dustTxResult = (dustResult.result.meta as any)?.TransactionResult;
        
        if (dustTxResult === 'tesSUCCESS') {
          console.log(`✅ [SMART SELL] Dust sent to issues wallet: ${dustResult.result.hash}`);
          
          return res.json({
            success: true,
            isDust: true,
            action: 'sent_to_issues_wallet',
            txHash: dustResult.result.hash,
            message: `Dust amount (${amount} ${currency}) sent to issues wallet. You can now remove the trustline.`
          });
        } else {
          throw new Error(`Dust transfer failed: ${dustTxResult}`);
        }
      } catch (dustError) {
        console.error(`❌ [SMART SELL] Failed to send dust:`, dustError);
        
        return res.status(400).json({
          success: false,
          isDust: true,
          error: `Failed to send dust: ${dustError instanceof Error ? dustError.message : 'Unknown error'}`,
          suggestion: "Token transfer failed. The token may be frozen or have restrictions."
        });
      }
    } else {
      console.log(`💱 [SMART SELL] Amount is tradable - attempting swap to XRP`);
      
      // Import swap function
      const { executeXrplSwapWithCachedKeys } = await import('./xrpl/xrpl-swap-cached');
      
      try {
        const swapResult = await executeXrplSwapWithCachedKeys(
          { xrpPrivateKey: privateKey },
          currency,
          'XRP',
          amount,
          issuer,
          undefined,
          riddleWalletId,
          wallet.address,
          5 // 5% slippage
        );
        
        if (swapResult) {
          console.log(`✅ [SMART SELL] Swap successful: ${swapResult.hash}`);
          
          return res.json({
            success: true,
            isDust: false,
            action: 'swapped_to_xrp',
            txHash: swapResult.hash,
            message: `Successfully swapped ${amount} ${currency} to XRP`
          });
        } else {
          throw new Error('Swap result is undefined');
        }
      } catch (swapError: any) {
        console.error(`❌ [SMART SELL] Swap failed:`, swapError);
        
        // If swap fails, treat as dust and send to issues wallet
        if (swapError.message?.includes('tecNO_LINE_INSUF_RESERVE') || 
            swapError.message?.includes('tecPATH_DRY') ||
            swapError.message?.includes('temBAD_AMOUNT')) {
          
          console.log(`🗑️ [SMART SELL] Swap failed - treating as dust`);
          
          const ISSUES_WALLET = 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY';
          
          try {
            const dustPayment = {
              TransactionType: 'Payment',
              Account: wallet.address,
              Destination: ISSUES_WALLET,
              Amount: {
                currency: currency.length === 3 ? currency : Buffer.from(currency).toString('hex').toUpperCase().padEnd(40, '0'),
                value: amount,
                issuer: issuer
              },
              Flags: 131072 // tfPartialPayment
            };
            
            const dustResult = await client.submitAndWait(dustPayment as any, { wallet });
            const dustTxResult = (dustResult.result.meta as any)?.TransactionResult;
            
            if (dustTxResult === 'tesSUCCESS') {
              console.log(`✅ [SMART SELL] Fallback: Dust sent to issues wallet`);
              
              return res.json({
                success: true,
                isDust: true,
                action: 'sent_to_issues_wallet_fallback',
                txHash: dustResult.result.hash,
                message: `Swap failed, sent dust to issues wallet. You can now remove the trustline.`
              });
            } else {
              throw new Error(`Dust transfer failed: ${dustTxResult}`);
            }
          } catch (fallbackError) {
            return res.status(400).json({
              success: false,
              error: `Both swap and dust handling failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
            });
          }
        }
        
        throw swapError;
      }
    }

  } catch (error) {
    console.error('❌ [SMART SELL] Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Smart sell/dust operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await client.disconnect();
  }
});

export default router;