// XRPL Wallet Operations - Burn, Transfer, Sell using session private keys
import { Router } from 'express';
import { Client, Wallet, convertStringToHex, Payment, TrustSet, NFTokenBurn, NFTokenCreateOffer, OfferCreate } from 'xrpl';
import { sessionAuth } from './middleware/session-auth';

const router = Router();

// CORS headers for wallet operations
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});


// Use session authentication for all wallet operations below this point
router.use(sessionAuth);

// =======================================================================================
// TEST ENDPOINT - Check session data structure (WITH AUTH MIDDLEWARE)
// =======================================================================================
router.get('/test-session', async (req: any, res) => {
  try {
    console.log('🧪 [SESSION TEST] Checking session structure...');
    console.log('🔍 [SESSION TEST] req.session:', req.session ? 'EXISTS' : 'NULL');
    console.log('🔍 [SESSION TEST] req.user:', req.user ? JSON.stringify(req.user) : 'NULL');
    
    if (req.session) {
      console.log('🔍 [SESSION TEST] Session keys:', Object.keys(req.session));
      console.log('🔍 [SESSION TEST] Has privateKeys:', !!req.session.privateKeys);
      console.log('🔍 [SESSION TEST] Has xrp key:', !!req.session.privateKeys?.xrp);
    }
    
    return res.json({
      success: true,
      sessionExists: !!req.session,
      userExists: !!req.user,
      hasPrivateKeys: !!req.session?.privateKeys,
      hasXrpKey: !!req.session?.privateKeys?.xrp,
      sessionStructure: req.session ? Object.keys(req.session) : [],
      userAddress: req.user?.walletAddress
    });
  } catch (error: any) {
    console.error('❌ [SESSION TEST] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =======================================================================================
// TOKEN TRANSFER ENDPOINT
// =======================================================================================
router.post('/transfer/token', async (req: any, res) => {
  try {
    const { destinationAddress, issuer, currency, amount, memo } = req.body;
    
    // Validate input
    if (!destinationAddress || !issuer || !currency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: destinationAddress, issuer, currency, amount'
      });
    }

    // Get session data with private keys
    const sessionData = req.session;
    if (!sessionData?.privateKeys?.xrp) {
      return res.status(401).json({
        success: false,
        error: 'XRP private key not found in session'
      });
    }

    console.log(`💸 [TOKEN TRANSFER] Transferring ${amount} ${currency} from ${req.user?.walletAddress} to ${destinationAddress}`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from session private key
    const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
    
    // Prepare payment transaction
    let paymentTransaction: Payment;
    
    if (currency === 'XRP') {
      // XRP payment - XRPL.js compliant structure
      paymentTransaction = {
        TransactionType: 'Payment' as const,
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: (parseFloat(amount) * 1000000).toString(), // XRP in drops
        Fee: '12', // Standard fee in drops
        Flags: 131072 // tfPartialPayment for security
      };
    } else {
      // Token payment - XRPL.js compliant structure
      paymentTransaction = {
        TransactionType: 'Payment' as const,
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: {
          currency: currency.length > 3 ? convertStringToHex(currency) : currency,
          issuer: issuer,
          value: amount.toString()
        },
        Fee: '12', // Standard fee in drops
        Flags: 131072 // tfPartialPayment for security
      };
    }

    // Add memo if provided
    if (memo) {
      paymentTransaction.Memos = [{
        Memo: {
          MemoData: convertStringToHex(memo)
        }
      }];
    }

    // Submit and wait for validation
    console.log(`🔗 [TOKEN TRANSFER] Submitting transaction...`);
    const response = await client.submitAndWait(paymentTransaction, { wallet });
    
    await client.disconnect();

    if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [TOKEN TRANSFER] Transfer successful: ${response.result.hash}`);
      return res.json({
        success: true,
        message: `Successfully transferred ${amount} ${currency}`,
        hash: response.result.hash,
        validated: response.result.validated
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      console.log(`❌ [TOKEN TRANSFER] Transfer failed: ${errorResult}`);
      return res.status(400).json({
        success: false,
        error: `Transfer failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [TOKEN TRANSFER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Transfer failed'
    });
  }
});

// =======================================================================================
// TOKEN BURN ENDPOINT
// =======================================================================================
router.post('/burn/token', async (req: any, res) => {
  try {
    const { issuer, currency, amount } = req.body;
    
    // Validate input
    if (!issuer || !currency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: issuer, currency, amount'
      });
    }

    // Get session data with private keys
    const sessionData = req.session;
    if (!sessionData?.privateKeys?.xrp) {
      return res.status(401).json({
        success: false,
        error: 'XRP private key not found in session'
      });
    }

    console.log(`🔥 [TOKEN BURN] Burning ${amount} ${currency} from ${req.user?.walletAddress}`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from session private key
    const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
    
    // Burn tokens by sending them back to issuer with amount 0
    const burnTransaction: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: issuer,
      Amount: {
        currency: currency.length > 3 ? convertStringToHex(currency) : currency,
        issuer: issuer,
        value: amount.toString()
      },
      Fee: '12' // 12 drops fee
    };

    // Submit and wait for validation
    console.log(`🔗 [TOKEN BURN] Submitting burn transaction...`);
    const response = await client.submitAndWait(burnTransaction, { wallet });
    
    await client.disconnect();

    if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [TOKEN BURN] Burn successful: ${response.result.hash}`);
      return res.json({
        success: true,
        message: `Successfully burned ${amount} ${currency}`,
        hash: response.result.hash,
        validated: response.result.validated
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      console.log(`❌ [TOKEN BURN] Burn failed: ${errorResult}`);
      return res.status(400).json({
        success: false,
        error: `Burn failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [TOKEN BURN] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Burn failed'
    });
  }
});

// =======================================================================================
// TOKEN SELL ENDPOINT (Create Sell Offer)
// =======================================================================================
router.post('/sell/token', async (req: any, res) => {
  try {
    const { issuer, currency, sellAmount, priceXRP, expiration } = req.body;
    
    // Validate input
    if (!issuer || !currency || !sellAmount || !priceXRP) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: issuer, currency, sellAmount, priceXRP'
      });
    }

    // Get session data with private keys
    const sessionData = req.session;
    if (!sessionData?.privateKeys?.xrp) {
      return res.status(401).json({
        success: false,
        error: 'XRP private key not found in session'
      });
    }

    console.log(`💰 [TOKEN SELL] Creating sell offer: ${sellAmount} ${currency} for ${priceXRP} XRP`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from session private key
    const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
    
    // Create sell offer transaction
    const sellOfferTransaction: OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerGets: (parseFloat(priceXRP) * 1000000).toString(), // XRP in drops
      TakerPays: {
        currency: currency.length > 3 ? convertStringToHex(currency) : currency,
        issuer: issuer,
        value: sellAmount.toString()
      },
      Fee: '12' // 12 drops fee
    };

    // Add expiration if provided (seconds since Ripple Epoch)
    if (expiration) {
      const rippleEpoch = 946684800; // January 1, 2000 (00:00 UTC)
      const expirationTimestamp = Math.floor(new Date(expiration).getTime() / 1000) - rippleEpoch;
      sellOfferTransaction.Expiration = expirationTimestamp;
    }

    // Submit and wait for validation
    console.log(`🔗 [TOKEN SELL] Submitting sell offer...`);
    const response = await client.submitAndWait(sellOfferTransaction, { wallet });
    
    await client.disconnect();

    if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [TOKEN SELL] Sell offer created: ${response.result.hash}`);
      return res.json({
        success: true,
        message: `Successfully created sell offer for ${sellAmount} ${currency}`,
        hash: response.result.hash,
        validated: response.result.validated,
        offerSequence: response.result.tx_json?.Sequence
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      console.log(`❌ [TOKEN SELL] Sell offer failed: ${errorResult}`);
      return res.status(400).json({
        success: false,
        error: `Sell offer failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [TOKEN SELL] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Sell offer failed'
    });
  }
});

// =======================================================================================
// NFT BURN ENDPOINT
// =======================================================================================
router.post('/burn/nft', async (req: any, res) => {
  try {
    const { nftTokenId } = req.body;
    
    // Validate input
    if (!nftTokenId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: nftTokenId'
      });
    }

    // Get session data with private keys
    const sessionData = req.session;
    if (!sessionData?.privateKeys?.xrp) {
      return res.status(401).json({
        success: false,
        error: 'XRP private key not found in session'
      });
    }

    console.log(`🔥 [NFT BURN] Burning NFT: ${nftTokenId}`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from session private key
    const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
    
    // Create NFT burn transaction
    const burnTransaction: NFTokenBurn = {
      TransactionType: 'NFTokenBurn',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Fee: '12' // 12 drops fee
    };

    // Submit and wait for validation
    console.log(`🔗 [NFT BURN] Submitting NFT burn transaction...`);
    const response = await client.submitAndWait(burnTransaction, { wallet });
    
    await client.disconnect();

    if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [NFT BURN] NFT burn successful: ${response.result.hash}`);
      return res.json({
        success: true,
        message: `Successfully burned NFT: ${nftTokenId}`,
        hash: response.result.hash,
        validated: response.result.validated
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      console.log(`❌ [NFT BURN] NFT burn failed: ${errorResult}`);
      return res.status(400).json({
        success: false,
        error: `NFT burn failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [NFT BURN] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'NFT burn failed'
    });
  }
});

// =======================================================================================
// NFT SELL ENDPOINT (Create Sell Offer)
// =======================================================================================
router.post('/sell/nft', async (req: any, res) => {
  try {
    const { nftTokenId, priceXRP, destination, expiration } = req.body;
    
    // Validate input
    if (!nftTokenId || !priceXRP) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nftTokenId, priceXRP'
      });
    }

    // Get session data with private keys
    const sessionData = req.session;
    if (!sessionData?.privateKeys?.xrp) {
      return res.status(401).json({
        success: false,
        error: 'XRP private key not found in session'
      });
    }

    console.log(`💰 [NFT SELL] Creating NFT sell offer: ${nftTokenId} for ${priceXRP} XRP`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from session private key
    const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
    
    // Create NFT sell offer transaction
    const sellOfferTransaction: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Amount: (parseFloat(priceXRP) * 1000000).toString(), // XRP in drops
      Flags: 1, // tfSellNFToken flag
      Fee: '12' // 12 drops fee
    };

    // Add destination if provided (private sale)
    if (destination) {
      sellOfferTransaction.Destination = destination;
    }

    // Add expiration if provided (seconds since Ripple Epoch)
    if (expiration) {
      const rippleEpoch = 946684800; // January 1, 2000 (00:00 UTC)
      const expirationTimestamp = Math.floor(new Date(expiration).getTime() / 1000) - rippleEpoch;
      sellOfferTransaction.Expiration = expirationTimestamp;
    }

    // Submit and wait for validation
    console.log(`🔗 [NFT SELL] Submitting NFT sell offer...`);
    const response = await client.submitAndWait(sellOfferTransaction, { wallet });
    
    await client.disconnect();

    if (response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta && response.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log(`✅ [NFT SELL] NFT sell offer created: ${response.result.hash}`);
      return res.json({
        success: true,
        message: `Successfully created NFT sell offer for ${priceXRP} XRP`,
        hash: response.result.hash,
        validated: response.result.validated,
        offerSequence: response.result.tx_json?.Sequence
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      console.log(`❌ [NFT SELL] NFT sell offer failed: ${errorResult}`);
      return res.status(400).json({
        success: false,
        error: `NFT sell offer failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [NFT SELL] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'NFT sell offer failed'
    });
  }
});

export default router;