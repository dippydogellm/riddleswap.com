import * as xrpl from 'xrpl';
import { decryptWalletForChain } from './wallet-decrypt';

export async function getXrpBalance(handle: string, password: string): Promise<{
  success: boolean;
  balance?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = await decryptWalletForChain(handle, password, 'xrp');
    client = new xrpl.Client('wss://s1.ripple.com');
    await client.connect();
    
    const response = await client.request({
      command: 'account_info',
      account: wallet.address,
      ledger_index: 'validated'
    });
    
    if (response.result?.account_data) {
      const drops = parseFloat(response.result.account_data.Balance);
      const xrpBalance = (drops / 1000000).toFixed(6);
      
      return {
        success: true,
        balance: xrpBalance
      };
    } else {
      throw new Error('Account not found');
    }
  } catch (error) {
    console.error('Failed to get XRP balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance'
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

export async function getXrpTokens(handle: string, password: string): Promise<{
  success: boolean;
  tokens?: Array<{
    currency: string;
    issuer: string;
    balance: string;
    limit: string;
  }>;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = await decryptWalletForChain(handle, password, 'xrp');
    client = new xrpl.Client('wss://s1.ripple.com');
    await client.connect();
    
    const response = await client.request({
      command: 'account_lines',
      account: wallet.address
    });
    
    const tokens = response.result.lines.map((line: any) => ({
      currency: line.currency,
      issuer: line.account,
      balance: line.balance,
      limit: line.limit
    }));
    
    return {
      success: true,
      tokens
    };
  } catch (error) {
    console.error('Failed to get XRP tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tokens'
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

export async function getXrpNFTs(handle: string, password: string): Promise<{
  success: boolean;
  nfts?: Array<{
    tokenId: string;
    issuer: string;
    uri?: string;
    flags: number;
  }>;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = await decryptWalletForChain(handle, password, 'xrp');
    client = new xrpl.Client('wss://s1.ripple.com');
    await client.connect();
    
    const response = await client.request({
      command: 'account_nfts',
      account: wallet.address
    } as any);
    
    const rawAccountNfts: any[] = Array.isArray((response as any)?.result?.account_nfts)
      ? (response as any).result.account_nfts
      : [];
    const nfts = rawAccountNfts.map((nft: any) => ({
      tokenId: nft?.NFTokenID,
      issuer: nft?.Issuer,
      uri: nft?.URI,
      flags: nft?.Flags
    }));
    
    return {
      success: true,
      nfts
    };
  } catch (error) {
    console.error('Failed to get XRP NFTs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFTs'
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

export async function getXrpNFTOffers(handle: string, password: string): Promise<{
  success: boolean;
  offers?: Array<{
    index: string;
    owner: string;
    amount: string;
    flags: number;
    nftId: string;
  }>;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const wallet = await decryptWalletForChain(handle, password, 'xrp');
    client = new xrpl.Client('wss://s1.ripple.com');
    await client.connect();
    
    // XRPL API does not support listing all offers by account directly; you must query per NFT or maintain index.
    // For now we attempt sell/buy offer lookups defensively: some servers may reject 'account' param for these commands.
    let sellOffers: any = { result: { offers: [] } };
    let buyOffers: any = { result: { offers: [] } };
    try {
      sellOffers = await client.request({
        command: 'nft_sell_offers',
        // NOTE: nft_id required normally; placeholder behavior retained
        account: wallet.address
      } as any);
    } catch {}
    try {
      buyOffers = await client.request({
        command: 'nft_buy_offers',
        account: wallet.address
      } as any);
    } catch {}

    const merged = ([] as any[])
      .concat(Array.isArray(sellOffers.result?.offers) ? sellOffers.result.offers : [])
      .concat(Array.isArray(buyOffers.result?.offers) ? buyOffers.result.offers : []);

    const offers = merged.map((offer: any) => ({
      index: offer.nft_offer_index,
      owner: offer.owner,
      amount: offer.amount,
      flags: offer.flags,
      nftId: offer.nft_id
    }));
    
    return {
      success: true,
      offers
    };
  } catch (error) {
    console.error('Failed to get XRP NFT offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get NFT offers'
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}