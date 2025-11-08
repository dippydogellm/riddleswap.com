import * as xrpl from 'xrpl';
import { decryptXrplWallet, getXrplClient, disconnectClient } from './xrpl-wallet';

export async function createBuyOffer(
  handle: string,
  password: string,
  payAmount: string,
  payCurrency: string,
  payIssuer: string,
  getAmount: string,
  getCurrency: string,
  getIssuer: string
): Promise<{
  success: boolean;
  txHash?: string;
  offerId?: number;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    const takerPays = payCurrency === 'XRP' 
      ? xrpl.xrpToDrops(payAmount)
      : { currency: payCurrency, issuer: payIssuer, value: payAmount };
    
    const takerGets = getCurrency === 'XRP'
      ? xrpl.xrpToDrops(getAmount)
      : { currency: getCurrency, issuer: getIssuer, value: getAmount };
    
    const offer: xrpl.OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerPays: takerPays,
      TakerGets: takerGets
    };
    
    const prepared = await client.autofill(offer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = typeof result.result.meta === 'object' && result.result.meta ? result.result.meta as any : null;
    const txResult = meta && 'TransactionResult' in meta ? meta.TransactionResult : undefined;
    return {
      success: txResult === 'tesSUCCESS',
      txHash: result.result.hash,
      offerId: (result.result as any).Sequence
    };
    
  } catch (error) {
    console.error('Buy offer creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Offer creation failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

export async function createSellOffer(
  handle: string,
  password: string,
  sellAmount: string,
  sellCurrency: string,
  sellIssuer: string,
  forAmount: string,
  forCurrency: string,
  forIssuer: string
): Promise<{
  success: boolean;
  txHash?: string;
  offerId?: number;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    const takerGets = sellCurrency === 'XRP'
      ? xrpl.xrpToDrops(sellAmount)
      : { currency: sellCurrency, issuer: sellIssuer, value: sellAmount };
    
    const takerPays = forCurrency === 'XRP'
      ? xrpl.xrpToDrops(forAmount)
      : { currency: forCurrency, issuer: forIssuer, value: forAmount };
    
    const offer: xrpl.OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerGets: takerGets,
      TakerPays: takerPays
    };
    
    const prepared = await client.autofill(offer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = typeof result.result.meta === 'object' && result.result.meta ? result.result.meta as any : null;
    const txResult = meta && 'TransactionResult' in meta ? meta.TransactionResult : undefined;
    return {
      success: txResult === 'tesSUCCESS',
      txHash: result.result.hash,
      offerId: (result.result as any).Sequence
    };
    
  } catch (error) {
    console.error('Sell offer creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Offer creation failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

export async function acceptOffer(
  handle: string,
  password: string,
  offerSequence: number,
  offerOwner: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    // Get offer details
    const offerRequest: xrpl.AccountOffersRequest = {
      command: 'account_offers',
      account: offerOwner
    };
    
    const offerResponse = await client.request(offerRequest);
    const offer = offerResponse.result.offers.find(o => o.seq === offerSequence);
    
    if (!offer) {
      throw new Error('Offer not found');
    }
    
    // Create matching offer to accept
    const acceptOffer: xrpl.OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerPays: offer.taker_gets,
      TakerGets: offer.taker_pays,
      OfferSequence: offerSequence
    };
    
    const prepared = await client.autofill(acceptOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = typeof result.result.meta === 'object' && result.result.meta ? result.result.meta as any : null;
    const txResult = meta && 'TransactionResult' in meta ? meta.TransactionResult : undefined;
    return {
      success: txResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('Offer acceptance failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Offer acceptance failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

export async function cancelOffer(
  handle: string,
  password: string,
  offerSequence: number
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    const cancel: xrpl.OfferCancel = {
      TransactionType: 'OfferCancel',
      Account: wallet.address,
      OfferSequence: offerSequence
    };
    
    const prepared = await client.autofill(cancel);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const meta = typeof result.result.meta === 'object' && result.result.meta ? result.result.meta as any : null;
    const txResult = meta && 'TransactionResult' in meta ? meta.TransactionResult : undefined;
    return {
      success: txResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('Offer cancellation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Offer cancellation failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}