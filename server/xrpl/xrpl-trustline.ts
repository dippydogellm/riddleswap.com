import * as xrpl from 'xrpl';
import { decryptXrplWallet, getXrplClient, disconnectClient } from './xrpl-wallet';

export async function setTrustline(
  handle: string,
  password: string,
  currency: string,
  issuer: string,
  limit: string = '1000000'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    const trustSet: xrpl.TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: currency,
        issuer: issuer,
        value: limit
      },
      Flags: xrpl.TrustSetFlags.tfSetNoRipple
    };
    
    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    return {
      success: (result.result.meta as any)?.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('Trustline setup failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Trustline setup failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

export async function removeTrustline(
  handle: string,
  password: string,
  currency: string,
  issuer: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    // Always use proper password-based decryption - no session shortcuts
    const decrypted = await decryptXrplWallet(handle, password);
    const wallet = decrypted.wallet;
    console.log(`🔓 [TRUSTLINE REMOVE] Decrypted wallet for ${handle}`);
    
    client = await getXrplClient();
    
    // Check current balance
    const balances = await client.getBalances(wallet.address);
    const tokenBalance = balances.find(
      b => b.currency === currency && b.issuer === issuer
    );
    
    if (tokenBalance && parseFloat(tokenBalance.value) > 0) {
      return {
        success: false,
        error: `Cannot remove trustline with non-zero balance: ${tokenBalance.value} ${currency}`
      };
    }
    
    // Set limit to 0 to remove trustline
    const trustSet: xrpl.TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: currency,
        issuer: issuer,
        value: '0'
      },
      // No flags needed - setting value to '0' removes the trustline
    };
    
    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    return {
      success: (result.result.meta as any)?.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('Trustline removal failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Trustline removal failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

// Remove trustline using CACHED private key (from session)
export async function removeTrustlineWithCachedKey(
  privateKey: string,
  walletAddress: string,
  currency: string,
  issuer: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`🔓 [TRUSTLINE REMOVE CACHED] Using cached key for ${walletAddress}`);
    
    const wallet = xrpl.Wallet.fromSeed(privateKey);
    client = await getXrplClient();
    
    // Check current balance
    const balances = await client.getBalances(wallet.address);
    const tokenBalance = balances.find(
      b => b.currency === currency && b.issuer === issuer
    );
    
    if (tokenBalance && parseFloat(tokenBalance.value) > 0) {
      return {
        success: false,
        error: `Cannot remove trustline with non-zero balance: ${tokenBalance.value} ${currency}`
      };
    }
    
    // Set limit to 0 to remove trustline
    const trustSet: xrpl.TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: currency,
        issuer: issuer,
        value: '0'
      },
    };
    
    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    console.log(`✅ [TRUSTLINE REMOVE CACHED] Transaction result: ${(result.result.meta as any)?.TransactionResult}`);
    
    return {
      success: (result.result.meta as any)?.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
    
  } catch (error) {
    console.error('❌ [TRUSTLINE REMOVE CACHED] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Trustline removal failed'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}

export async function getTrustlines(
  handle: string,
  password: string
): Promise<{
  success: boolean;
  trustlines?: Array<{
    currency: string;
    issuer: string;
    limit: string;
    balance: string;
  }>;
  error?: string;
}> {
  let client: xrpl.Client | null = null;
  
  try {
    const { wallet } = await decryptXrplWallet(handle, password);
    client = await getXrplClient();
    
    const response = await client.request({
      command: 'account_lines',
      account: wallet.address
    });
    
    const trustlines = response.result.lines.map((line: any) => ({
      currency: line.currency,
      issuer: line.account,
      limit: line.limit,
      balance: line.balance
    }));
    
    return {
      success: true,
      trustlines
    };
    
  } catch (error) {
    console.error('Failed to get trustlines:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trustlines'
    };
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}