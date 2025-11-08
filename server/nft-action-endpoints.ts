// NFT Action Endpoints - Burn, Transfer, Sell NFTs using session private keys
import { Router } from 'express';
import { Client, Wallet, NFTokenBurn, NFTokenCreateOffer } from 'xrpl';
import { sessionAuth } from './middleware/session-auth';

const router = Router();

// CORS headers
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Use session authentication for all NFT operations
router.use(sessionAuth);

// =======================================================================================
// CREATE BUY OFFER - Offer to buy someone else's NFT
// =======================================================================================
router.post('/buy-offer/:nftId', async (req: any, res) => {
  try {
    const { nftId } = req.params;
    const { offerAmountXRP, destination, expiration, destinationTag } = req.body;
    const user = req.user;
    
    console.log(`💰 [BUY OFFER] Creating buy offer for NFT: ${nftId}`);
    
    if (!offerAmountXRP) {
      return res.status(400).json({
        success: false,
        error: 'Offer amount in XRP is required'
      });
    }

    // Get XRP private key from sessionAuth cached keys
    const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
    if (!xrpPrivateKey) {
      console.error('❌ [BUY OFFER] No XRP private key in cached keys');
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session'
      });
    }
    console.log(`✅ [BUY OFFER] Private key retrieved from cachedKeys`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(xrpPrivateKey);
    
    // Ensure proper XRP to drops conversion
    const offerAmountDrops = Math.floor(parseFloat(offerAmountXRP) * 1000000);
    
    // Create buy offer transaction - XRPL.js compliant structure
    const buyOfferTransaction: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftId,
      Amount: offerAmountDrops.toString(), // XRP in drops
      Owner: destination || undefined, // Current NFT owner (required for buy offers)
      Flags: 0, // Buy offer flag (or omit for default)
      Fee: '12'
    };

    // Add destination if provided (offer to specific owner)
    if (destination) {
      buyOfferTransaction.Destination = destination;
    }

    // Add destination tag if provided
    if (destinationTag !== undefined && destinationTag !== null) {
      buyOfferTransaction.DestinationTag = destinationTag;
      console.log(`💳 [BUY OFFER] Adding destination tag: ${destinationTag}`);
    }

    // Add expiration if provided
    if (expiration) {
      const rippleEpoch = 946684800; // January 1, 2000 (00:00 UTC)
      const expirationTimestamp = Math.floor(new Date(expiration).getTime() / 1000) - rippleEpoch;
      buyOfferTransaction.Expiration = expirationTimestamp;
    }

    const response = await client.submitAndWait(buyOfferTransaction, { wallet });
    await client.disconnect();
    
    // Improved success validation for XRPL transactions
    const isSuccess = response.result.meta && 
                     typeof response.result.meta === 'object' && 
                     'TransactionResult' in response.result.meta && 
                     response.result.meta.TransactionResult === 'tesSUCCESS';
    
    if (isSuccess) {
      console.log(`✅ [BUY OFFER] Buy offer created successfully: ${response.result.hash}`);
      return res.json({
        success: true,
        message: `Buy offer for ${offerAmountXRP} XRP created successfully`,
        hash: response.result.hash,
        validated: response.result.validated,
        offerAmount: offerAmountXRP
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      return res.status(400).json({
        success: false,
        error: `Buy offer failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [BUY OFFER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Buy offer creation failed'
    });
  }
});

// =======================================================================================
// BURN NFT ENDPOINT
// =======================================================================================
router.post('/burn/:nftId', async (req: any, res) => {
  try {
    const { nftId } = req.params;
    const user = req.user;
    console.log(`🔥 [NFT BURN] Burning NFT: ${nftId}`);

    // Get XRP private key from sessionAuth cached keys
    const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
    if (!xrpPrivateKey) {
      console.error('❌ [NFT BURN] No XRP private key in cached keys');
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session'
      });
    }
    console.log(`✅ [NFT BURN] Private key retrieved from cachedKeys`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(xrpPrivateKey);
    
    const response = await handleNFTBurn(client, wallet, nftId);
    await client.disconnect();
    
    if (response.success) {
      console.log(`✅ [NFT BURN] Burn successful: ${response.hash}`);
      return res.json({
        success: true,
        message: 'NFT burn prepared successfully',
        hash: response.hash,
        validated: response.validated
      });
    } else {
      console.log(`❌ [NFT BURN] Burn failed: ${response.error}`);
      return res.status(400).json({
        success: false,
        error: response.error
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
// TRANSFER NFT ENDPOINT
// =======================================================================================
router.post('/transfer/:nftId', async (req: any, res) => {
  try {
    const { nftId } = req.params;
    const { destinationAddress, destinationTag } = req.body;
    const user = req.user;
    
    console.log(`📤 [NFT TRANSFER] Transferring NFT: ${nftId} to ${destinationAddress}`);

    if (!destinationAddress) {
      return res.status(400).json({
        success: false,
        error: 'Destination address is required'
      });
    }

    // Get XRP private key from sessionAuth cached keys
    const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
    if (!xrpPrivateKey) {
      console.error('❌ [NFT TRANSFER] No XRP private key in cached keys');
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session'
      });
    }
    console.log(`✅ [NFT TRANSFER] Private key retrieved from cachedKeys`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(xrpPrivateKey);
    
    const response = await handleNFTTransfer(client, wallet, nftId, { destinationAddress, destinationTag });
    await client.disconnect();
    
    if (response.success) {
      console.log(`✅ [NFT TRANSFER] Transfer successful: ${response.hash}`);
      return res.json({
        success: true,
        message: 'NFT transfer prepared successfully',
        hash: response.hash,
        validated: response.validated
      });
    } else {
      console.log(`❌ [NFT TRANSFER] Transfer failed: ${response.error}`);
      return res.status(400).json({
        success: false,
        error: response.error
      });
    }

  } catch (error: any) {
    console.error('❌ [NFT TRANSFER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'NFT transfer failed'
    });
  }
});

// =======================================================================================
// ACCEPT INCOMING OFFER ENDPOINT
// =======================================================================================
router.post('/accept-offer/:nftId', async (req: any, res) => {
  try {
    const { nftId } = req.params;
    const { offerIndex } = req.body;
    
    console.log(`✅ [ACCEPT OFFER] Accepting offer for NFT: ${nftId}, Offer Index: ${offerIndex}`);

    if (!offerIndex) {
      return res.status(400).json({
        success: false,
        error: 'Offer index is required'
      });
    }

    // Get cached private keys directly from session (middleware assigns cachedKeys to req.session)
    const cachedKeys = req.session || {};
    if (!cachedKeys.xrpPrivateKey) {
      console.error('❌ Private key missing - session restored from DB without keys');
      return res.status(401).json({
        success: false,
        error: 'Session restored without private keys. Please log out and log back in to restore your wallet access.',
        action_required: 'logout_login'
      });
    }

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
    
    // Accept the buy offer - XRPL.js compliant structure
    const acceptOfferTransaction = {
      TransactionType: 'NFTokenAcceptOffer' as const,
      Account: wallet.address,
      NFTokenBuyOffer: offerIndex, // Accept a buy offer made by someone else
      Fee: '12' // Standard fee in drops
    };

    const response = await client.submitAndWait(acceptOfferTransaction, { wallet });
    await client.disconnect();
    
    // Improved success validation for XRPL transactions
    const isSuccess = response.result.meta && 
                     typeof response.result.meta === 'object' && 
                     'TransactionResult' in response.result.meta && 
                     response.result.meta.TransactionResult === 'tesSUCCESS';
    
    if (isSuccess) {
      console.log(`✅ [ACCEPT OFFER] Offer accepted successfully: ${response.result.hash}`);
      return res.json({
        success: true,
        message: 'Incoming offer accepted successfully',
        hash: response.result.hash,
        validated: response.result.validated
      });
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      return res.status(400).json({
        success: false,
        error: `Accept offer failed: ${errorResult}`
      });
    }

  } catch (error: any) {
    console.error('❌ [ACCEPT OFFER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Accept offer failed'
    });
  }
});

// =======================================================================================
// SELL NFT ENDPOINT
// =======================================================================================
router.post('/sell/:nftId', async (req: any, res) => {
  try {
    const { nftId } = req.params;
    const { priceXRP, destination, expiration, destinationTag } = req.body;
    const user = req.user;
    
    console.log(`💰 [NFT SELL] Creating sell offer for NFT: ${nftId} at ${priceXRP} XRP`);

    if (!priceXRP) {
      return res.status(400).json({
        success: false,
        error: 'Price in XRP is required'
      });
    }

    // Get XRP private key from sessionAuth cached keys
    const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
    if (!xrpPrivateKey) {
      console.error('❌ [NFT SELL] No XRP private key in cached keys');
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session'
      });
    }
    console.log(`✅ [NFT SELL] Private key retrieved from cachedKeys`);

    const client = new Client('wss://s1.ripple.com');
    await client.connect();

    // Create wallet from cached private key
    const wallet = Wallet.fromSeed(xrpPrivateKey);
    
    const response = await handleNFTSell(client, wallet, nftId, { priceXRP, destination, expiration, destinationTag });
    await client.disconnect();
    
    if (response.success) {
      console.log(`✅ [NFT SELL] Sell offer successful: ${response.hash}`);
      return res.json({
        success: true,
        message: `NFT sell offer for ${priceXRP} XRP created successfully`,
        hash: response.hash,
        validated: response.validated
      });
    } else {
      console.log(`❌ [NFT SELL] Sell offer failed: ${response.error}`);
      return res.status(400).json({
        success: false,
        error: response.error
      });
    }

  } catch (error: any) {
    console.error('❌ [NFT SELL] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'NFT sell failed'
    });
  }
});

// =======================================================================================
// NFT ACTION HANDLERS
// =======================================================================================

async function handleNFTBurn(client: Client, wallet: Wallet, nftTokenId: string) {
  try {
    // NFTokenBurn - XRPL.js compliant structure
    const burnTransaction: NFTokenBurn = {
      TransactionType: 'NFTokenBurn',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Fee: '12' // Standard fee in drops
    };

    const response = await client.submitAndWait(burnTransaction, { wallet });
    
    // Improved success validation for XRPL transactions
    const isSuccess = response.result.meta && 
                     typeof response.result.meta === 'object' && 
                     'TransactionResult' in response.result.meta && 
                     response.result.meta.TransactionResult === 'tesSUCCESS';
    
    if (isSuccess) {
      return {
        success: true,
        hash: response.result.hash,
        validated: response.result.validated
      };
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      return {
        success: false,
        error: `Burn failed: ${errorResult}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Burn error: ${error.message}`
    };
  }
}

async function handleNFTSell(client: Client, wallet: Wallet, nftTokenId: string, actionData: any) {
  try {
    const { priceXRP, destination, expiration, destinationTag } = actionData;
    
    if (!priceXRP) {
      return {
        success: false,
        error: 'Price in XRP is required for sell action'
      };
    }

    // Ensure proper XRP to drops conversion
    const priceDrops = Math.floor(parseFloat(priceXRP) * 1000000);
    
    console.log(`💰 [SELL OFFER] Converting ${priceXRP} XRP to ${priceDrops} drops`);
    
    // NFTokenCreateOffer for selling - XRPL.js compliant structure
    const sellOfferTransaction: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Amount: priceDrops.toString(), // XRP in drops
      Flags: 1, // tfSellNFToken flag (required for sell offers)
      Fee: '12'
      // Note: No Owner field for sell offers (Account is implied owner)
    };

    // Add destination if provided (private sale)
    if (destination) {
      sellOfferTransaction.Destination = destination;
      console.log(`🎯 [SELL OFFER] Adding destination: ${destination}`);
    }

    // Add destination tag if provided
    if (destinationTag !== undefined && destinationTag !== null) {
      sellOfferTransaction.DestinationTag = destinationTag;
      console.log(`💳 [SELL OFFER] Adding destination tag: ${destinationTag}`);
    }

    // Add expiration if provided
    if (expiration) {
      const rippleEpoch = 946684800; // January 1, 2000 (00:00 UTC)
      const expirationTimestamp = Math.floor(new Date(expiration).getTime() / 1000) - rippleEpoch;
      sellOfferTransaction.Expiration = expirationTimestamp;
    }

    const response = await client.submitAndWait(sellOfferTransaction, { wallet });
    
    // Improved success validation for XRPL transactions
    const isSuccess = response.result.meta && 
                     typeof response.result.meta === 'object' && 
                     'TransactionResult' in response.result.meta && 
                     response.result.meta.TransactionResult === 'tesSUCCESS';
    
    if (isSuccess) {
      return {
        success: true,
        hash: response.result.hash,
        validated: response.result.validated
      };
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      return {
        success: false,
        error: `Sell offer failed: ${errorResult}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Sell error: ${error.message}`
    };
  }
}

async function handleNFTTransfer(client: Client, wallet: Wallet, nftTokenId: string, actionData: any) {
  try {
    const { destinationAddress, destinationTag } = actionData;
    
    if (!destinationAddress) {
      return {
        success: false,
        error: 'Destination address is required for transfer action'
      };
    }

    // NFT Transfer via sell offer - XRPL.js compliant structure
    const transferOfferTransaction: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftTokenId,
      Amount: '0', // 0 XRP (free transfer/gift)
      Destination: destinationAddress, // Only this address can accept
      Flags: 1, // tfSellNFToken flag (required for sell offers)
      Fee: '12'
      // Note: No Owner field for sell offers (Account is implied owner)
    };

    // Add destination tag if provided
    if (destinationTag !== undefined && destinationTag !== null) {
      transferOfferTransaction.DestinationTag = destinationTag;
      console.log(`💳 [TRANSFER] Adding destination tag: ${destinationTag}`);
    }

    const response = await client.submitAndWait(transferOfferTransaction, { wallet });
    
    // Improved success validation for XRPL transactions
    const isSuccess = response.result.meta && 
                     typeof response.result.meta === 'object' && 
                     'TransactionResult' in response.result.meta && 
                     response.result.meta.TransactionResult === 'tesSUCCESS';
    
    if (isSuccess) {
      return {
        success: true,
        hash: response.result.hash,
        validated: response.result.validated
      };
    } else {
      const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
      return {
        success: false,
        error: `Transfer failed: ${errorResult}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Transfer error: ${error.message}`
    };
  }
}

export default router;