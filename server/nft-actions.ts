import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { decryptWithPasswordServer } from './wallet-generation.js';

const XRPL_NETWORK = 'wss://xrplcluster.com/';

export async function createNFTSellOffer(
  nftId: string,
  amount: string,
  encryptedPrivateKey: string,
  password: string,
  ownerAddress: string
) {
  const client = new Client(XRPL_NETWORK);
  
  try {
    await client.connect();
    
    // Decrypt the private key
    const privateKey = decryptWithPasswordServer(encryptedPrivateKey, password);
    const wallet = Wallet.fromSeed(privateKey);
    
    // Create sell offer transaction
    const sellOfferTx: any = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftId,
      Amount: xrpToDrops(amount),
      Flags: 1, // Sell offer flag
      Fee: '12',
    };
    
    // Sign and submit transaction
    const prepared = await client.autofill(sellOfferTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    return {
      success: true,
      hash: result.result.hash,
      offerId: (result.result.meta as any)?.CreatedNodes?.[0]?.CreatedNode?.LedgerIndex
    };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function transferNFT(
  nftId: string,
  destination: string,
  encryptedPrivateKey: string,
  password: string,
  ownerAddress: string
) {
  const client = new Client(XRPL_NETWORK);
  
  try {
    await client.connect();
    
    // Decrypt the private key
    const privateKey = decryptWithPasswordServer(encryptedPrivateKey, password);
    const wallet = Wallet.fromSeed(privateKey);
    
    // Create a sell offer for 0 XRP (free transfer)
    const sellOfferTx: any = {
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftId,
      Amount: '0',
      Destination: destination,
      Flags: 1, // Sell offer flag
      Fee: '12',
    };
    
    const prepared = await client.autofill(sellOfferTx);
    const signed = wallet.sign(prepared);
    const sellResult = await client.submitAndWait(signed.tx_blob);
    
    // Get the offer ID from the result
    const offerId = (sellResult.result.meta as any)?.CreatedNodes?.find(
      (node: any) => node.CreatedNode?.LedgerEntryType === 'NFTokenOffer'
    )?.CreatedNode?.LedgerIndex;
    
    if (!offerId) {
      throw new Error('Failed to create transfer offer');
    }
    
    // Auto-accept the offer from destination (if we have control)
    // For now, just return the offer ID for manual acceptance
    
    await client.disconnect();
    
    return {
      success: true,
      hash: sellResult.result.hash,
      offerId: offerId,
      message: `Transfer offer created. The recipient needs to accept offer ID: ${offerId}`
    };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function burnNFT(
  nftId: string,
  encryptedPrivateKey: string,
  password: string,
  ownerAddress: string
) {
  const client = new Client(XRPL_NETWORK);
  
  try {
    await client.connect();
    
    // Decrypt the private key
    const privateKey = decryptWithPasswordServer(encryptedPrivateKey, password);
    const wallet = Wallet.fromSeed(privateKey);
    
    // Create burn transaction
    const burnTx: any = {
      TransactionType: 'NFTokenBurn',
      Account: wallet.address,
      NFTokenID: nftId,
      Fee: '12',
    };
    
    const prepared = await client.autofill(burnTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    return {
      success: true,
      hash: result.result.hash,
      message: 'NFT successfully burned'
    };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function acceptNFTOffer(
  offerId: string,
  encryptedPrivateKey: string,
  password: string,
  buyerAddress: string
) {
  const client = new Client(XRPL_NETWORK);
  
  try {
    await client.connect();
    
    // Decrypt the private key
    const privateKey = decryptWithPasswordServer(encryptedPrivateKey, password);
    const wallet = Wallet.fromSeed(privateKey);
    
    // Get offer details first
    const offerResponse = await client.request({
      command: 'ledger_entry',
      index: offerId,
      ledger_index: 'validated'
    });
    
    const offer = offerResponse.result.node as any;
    const amount = offer?.Amount || '0';
    
    // Create accept offer transaction
    const acceptTx: any = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: wallet.address,
      NFTokenSellOffer: offerId,
      Fee: '12',
    };
    
    const prepared = await client.autofill(acceptTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    return {
      success: true,
      hash: result.result.hash,
      message: 'NFT offer successfully accepted'
    };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function fetchNFTOffers(nftId: string, ownerAddress: string) {
  const client = new Client(XRPL_NETWORK);
  
  try {
    await client.connect();
    
    console.log(`🔍 Fetching offers for NFT: ${nftId}, Owner: ${ownerAddress}`);
    
    // Get buy offers (incoming offers to the owner)
    let buyOffers: any = { result: { offers: [] } };
    try {
      buyOffers = await client.request({
        command: 'nft_buy_offers',
        nft_id: nftId,
        ledger_index: 'validated'
      });
      console.log(`📈 Buy offers found:`, buyOffers.result.offers?.length || 0);
      if (buyOffers.result.offers?.length > 0) {
        console.log(`🔍 First buy offer details:`, JSON.stringify(buyOffers.result.offers[0], null, 2));
      }
    } catch (error: any) {
      console.log(`⚠️ No buy offers found for NFT ${nftId}:`, error.message || error);
      
      // Try alternative query method using current ledger
      try {
        console.log(`🔄 Retrying with current ledger...`);
        buyOffers = await client.request({
          command: 'nft_buy_offers',
          nft_id: nftId,
          ledger_index: 'current'
        });
        console.log(`📈 Buy offers found (current):`, buyOffers.result.offers?.length || 0);
      } catch (altError: any) {
        console.log(`⚠️ Alternative query also failed:`, altError.message || altError);
      }
    }
    
    // Get sell offers  
    let sellOffers: any = { result: { offers: [] } };
    try {
      sellOffers = await client.request({
        command: 'nft_sell_offers',
        nft_id: nftId,
        ledger_index: 'validated'
      });
      console.log(`📉 Sell offers found:`, sellOffers.result.offers?.length || 0);
      if (sellOffers.result.offers?.length > 0) {
        console.log(`🔍 First sell offer details:`, JSON.stringify(sellOffers.result.offers[0], null, 2));
      }
    } catch (error: any) {
      console.log(`⚠️ No sell offers found for NFT ${nftId}:`, error.message || error);
      
      // Try alternative query method using current ledger
      try {
        console.log(`🔄 Retrying sell offers with current ledger...`);
        sellOffers = await client.request({
          command: 'nft_sell_offers',
          nft_id: nftId,
          ledger_index: 'current'
        });
        console.log(`📉 Sell offers found (current):`, sellOffers.result.offers?.length || 0);
      } catch (altError: any) {
        console.log(`⚠️ Alternative sell query also failed:`, altError.message || altError);
      }
    }
    
    await client.disconnect();
    
    // Process buy offers (these are incoming offers TO the owner)
    const incomingOffers = (buyOffers.result.offers || []).map((offer: any) => {
      console.log(`💰 Processing buy offer:`, offer);
      return {
        ...offer,
        type: 'buy',
        amountXRP: offer.amount ? dropsToXrp(offer.amount) : '0',
        nft_offer_index: offer.nft_offer_index,
        owner: offer.owner,
        destination: offer.destination
      };
    });
    
    // Process sell offers (these are outgoing offers FROM the owner)
    const outgoingOffers = (sellOffers.result.offers || []).map((offer: any) => {
      console.log(`📤 Processing sell offer:`, offer);
      return {
        ...offer,
        type: 'sell',
        amountXRP: offer.amount ? dropsToXrp(offer.amount) : '0',
        nft_offer_index: offer.nft_offer_index,
        owner: offer.owner,
        destination: offer.destination
      };
    });
    
    console.log(`✅ Final offer summary: ${incomingOffers.length} incoming, ${outgoingOffers.length} outgoing`);
    
    return {
      incoming: incomingOffers,
      outgoing: outgoingOffers
    };
  } catch (error) {
    console.error('Error fetching NFT offers:', error);
    await client.disconnect();
    throw error;
  }
}