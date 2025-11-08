import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Client as XRPLClient, convertStringToHex } from 'xrpl';

const router = express.Router();

// Import Xumm payload functions from external wallet routes
import { createXummPayload, getXummPayloadStatus } from '../external-wallet-routes.js';

// Store pending operations (in-memory, expires after 10 minutes)
const pendingOperations = new Map<string, any>();

// Cleanup expired operations every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, operation] of Array.from(pendingOperations.entries())) {
    if (now - operation.createdAt > 10 * 60 * 1000) {
      pendingOperations.delete(id);
    }
  }
}, 60 * 1000);

/**
 * PUBLIC: Prepare sell-all-tokens transaction for external wallet
 * Sells all tokens to XRP with DeliverMin slippage protection
 */
router.post('/prepare-sell-all', async (req, res) => {
  try {
    const { userAddress, currency, issuer, balance } = req.body;

    if (!userAddress || !currency || !issuer || !balance) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, currency, issuer, balance'
      });
    }

    console.log(`💰 [EXTERNAL SELL] Preparing sell-all transaction for ${balance} ${currency}`);

    // Calculate expected XRP output
    let estimatedXrpOutput = 0.001; // Minimum 0.001 XRP
    let minimumXrpOutput = 0.0001; // Minimum with 90% slippage tolerance

    try {
      // Try to get market price from DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${currency}`);
      const data = await response.json() as any;
      const xrplPair = data.pairs?.find((p: any) => 
        p.chainId === 'xrpl' && 
        p.baseToken.symbol === currency &&
        p.baseToken.address === issuer
      );

      if (xrplPair?.priceUsd) {
        // Get XRP price
        const xrpPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
        const xrpPriceData = await xrpPriceResponse.json();
        const xrpPrice = xrpPriceData.ripple?.usd || 2.5;

        // Calculate XRP output
        const tokenValueUsd = parseFloat(balance) * parseFloat(xrplPair.priceUsd);
        estimatedXrpOutput = tokenValueUsd / xrpPrice;
        minimumXrpOutput = estimatedXrpOutput * 0.9; // 10% slippage tolerance
      }
    } catch (priceError) {
      console.log('⚠️ [EXTERNAL SELL] Could not get market price, using default');
    }

    // Build Payment transaction with DeliverMin (Token → XRP)
    const txJson: any = {
      TransactionType: 'Payment',
      Account: userAddress,
      Destination: userAddress, // Self-payment for swap
      Amount: Math.floor(estimatedXrpOutput * 1000000).toString(), // XRP in drops (estimated max)
      DeliverMin: Math.floor(minimumXrpOutput * 1000000).toString(), // XRP in drops (minimum required)
      SendMax: {
        currency: currency.length === 3 ? currency : convertStringToHex(currency).toUpperCase().padEnd(40, '0'),
        value: balance,
        issuer: issuer
      },
      Flags: 131072, // tfPartialPayment
      Memos: [{
        Memo: {
          MemoType: convertStringToHex('RiddleSwap'),
          MemoData: convertStringToHex(`Sell all ${currency} to XRP`)
        }
      }]
    };

    const operationId = uuidv4();
    pendingOperations.set(operationId, {
      type: 'sell_all',
      userAddress,
      currency,
      issuer,
      balance,
      transaction: txJson,
      estimatedOutput: estimatedXrpOutput,
      minimumOutput: minimumXrpOutput,
      createdAt: Date.now()
    });

    console.log(`✅ [EXTERNAL SELL] Transaction prepared for ${currency} → XRP`);

    res.json({
      success: true,
      operationId,
      transaction: txJson,
      estimatedOutput: estimatedXrpOutput,
      minimumOutput: minimumXrpOutput,
      message: `Prepared to sell ${balance} ${currency} for ~${estimatedXrpOutput.toFixed(4)} XRP (min: ${minimumXrpOutput.toFixed(4)} XRP)`
    });

  } catch (error) {
    console.error('❌ [EXTERNAL SELL] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare sell transaction'
    });
  }
});

/**
 * PUBLIC: Prepare trustline removal transaction for external wallet
 */
router.post('/prepare-remove-trustline', async (req, res) => {
  try {
    const { userAddress, currency, issuer } = req.body;

    if (!userAddress || !currency || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, currency, issuer'
      });
    }

    console.log(`🗑️ [EXTERNAL REMOVE] Preparing trustline removal for ${currency}`);

    // Verify balance is zero before allowing removal
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    try {
      const balances = await client.getBalances(userAddress);
      const tokenBalance = balances.find(
        (b: any) => b.currency === currency && b.issuer === issuer
      );

      if (tokenBalance && parseFloat(tokenBalance.value) > 0) {
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: `Cannot remove trustline with non-zero balance: ${tokenBalance.value} ${currency}. Please sell all tokens first.`,
          currentBalance: tokenBalance.value
        });
      }

      // Build TrustSet transaction with limit = 0 (removes trustline)
      const txJson: any = {
        TransactionType: 'TrustSet',
        Account: userAddress,
        LimitAmount: {
          currency: currency.length === 3 ? currency : convertStringToHex(currency).toUpperCase().padEnd(40, '0'),
          issuer: issuer,
          value: '0' // Setting to 0 removes the trustline
        },
        Memos: [{
          Memo: {
            MemoType: convertStringToHex('RiddleSwap'),
            MemoData: convertStringToHex(`Remove ${currency} trustline`)
          }
        }]
      };

      const operationId = uuidv4();
      pendingOperations.set(operationId, {
        type: 'remove_trustline',
        userAddress,
        currency,
        issuer,
        transaction: txJson,
        createdAt: Date.now()
      });

      console.log(`✅ [EXTERNAL REMOVE] Trustline removal prepared for ${currency}`);

      res.json({
        success: true,
        operationId,
        transaction: txJson,
        message: `Prepared to remove ${currency} trustline`
      });

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('❌ [EXTERNAL REMOVE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare trustline removal'
    });
  }
});

/**
 * PUBLIC: Get operation status
 */
router.get('/operation-status/:operationId', async (req, res) => {
  try {
    const { operationId } = req.params;
    const operation = pendingOperations.get(operationId);

    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operation not found or expired'
      });
    }

    res.json({
      success: true,
      operation: {
        type: operation.type,
        currency: operation.currency,
        issuer: operation.issuer,
        status: operation.status || 'pending',
        txHash: operation.txHash
      }
    });

  } catch (error) {
    console.error('❌ [EXTERNAL STATUS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operation status'
    });
  }
});

/**
 * PUBLIC: Create Xumm signing payload for operation
 */
router.post('/create-payload', async (req, res) => {
  try {
    const { operationId } = req.body;

    if (!operationId) {
      console.error('❌ [EXTERNAL PAYLOAD] Missing operationId');
      return res.status(400).json({
        success: false,
        error: 'Missing operationId'
      });
    }

    const operation = pendingOperations.get(operationId);
    if (!operation) {
      console.error('❌ [EXTERNAL PAYLOAD] Operation not found:', operationId);
      return res.status(404).json({
        success: false,
        error: 'Operation not found or expired'
      });
    }

    console.log(`📱 [EXTERNAL PAYLOAD] Creating Xumm payload for ${operation.type} operation`);
    console.log(`📋 [EXTERNAL PAYLOAD] Transaction:`, JSON.stringify(operation.transaction, null, 2));

    // Create Xumm payload
    const payloadResponse = await createXummPayload({
      txjson: operation.transaction,
      options: {
        submit: false,
        return_url: {
          web: 'https://riddleswap.com'
        }
      }
    });

    console.log(`✅ [EXTERNAL PAYLOAD] Xumm payload created successfully:`, {
      uuid: payloadResponse.uuid,
      hasQr: !!payloadResponse.refs?.qr_png,
      hasDeepLink: !!payloadResponse.next?.always
    });

    res.json({
      success: true,
      payload: {
        uuid: payloadResponse.uuid,
        qr: payloadResponse.refs?.qr_png,
        deepLink: payloadResponse.next?.always,
        websocket: payloadResponse.refs?.websocket_status
      },
      message: operation.type === 'sell_all' 
        ? `Scan QR code to sell ${operation.currency} to XRP`
        : `Scan QR code to remove ${operation.currency} trustline`
    });

  } catch (error) {
    console.error('❌ [EXTERNAL PAYLOAD] Error creating payload:', error);
    console.error('❌ [EXTERNAL PAYLOAD] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payload'
    });
  }
});

/**
 * PUBLIC: Check Xumm payload status
 */
router.get('/payload-status/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;

    const statusResponse = await getXummPayloadStatus(uuid);

    res.json({
      success: true,
      status: statusResponse.meta?.signed ? 'signed' : 'pending',
      signed: statusResponse.meta?.signed,
      txHash: statusResponse.response?.txid
    });

  } catch (error) {
    console.error('❌ [EXTERNAL STATUS] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
});

/**
 * PUBLIC: Verify signed transaction was successful on XRPL
 */
router.post('/verify-transaction', async (req, res) => {
  try {
    const { operationId, txHash } = req.body;

    if (!operationId || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing operationId or txHash'
      });
    }

    const operation = pendingOperations.get(operationId);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operation not found or expired'
      });
    }

    console.log(`🔍 [EXTERNAL VERIFY] Verifying transaction ${txHash} for ${operation.currency}`);

    // Connect to XRPL and verify transaction
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    try {
      const txResponse = await client.request({
        command: 'tx',
        transaction: txHash
      });

      const isSuccess = txResponse.result.meta && 
        (txResponse.result.meta as any).TransactionResult === 'tesSUCCESS';

      if (isSuccess) {
        operation.status = 'completed';
        operation.txHash = txHash;

        console.log(`✅ [EXTERNAL VERIFY] Transaction successful: ${txHash}`);

        res.json({
          success: true,
          verified: true,
          txHash,
          explorerUrl: `https://livenet.xrpl.org/transactions/${txHash}`,
          message: operation.type === 'sell_all' 
            ? `Successfully sold ${operation.currency} to XRP`
            : `Successfully removed ${operation.currency} trustline`
        });
      } else {
        res.json({
          success: false,
          verified: false,
          error: `Transaction failed: ${(txResponse.result.meta as any)?.TransactionResult}`
        });
      }

    } finally {
      await client.disconnect();
    }

  } catch (error) {
    console.error('❌ [EXTERNAL VERIFY] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify transaction'
    });
  }
});

export default router;
