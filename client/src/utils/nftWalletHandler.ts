// Comprehensive NFT Wallet Handler for Multi-Wallet Support
// Supports Riddle Wallet, Xaman, and Joey wallets

export interface WalletOption {
  id: string;
  name: string;
  type: 'riddle' | 'xaman' | 'joey';
  address: string;
  available: boolean;
}

export function getAvailableXRPLWallets(): WalletOption[] {
  const wallets: WalletOption[] = [];
  
  // Check Riddle wallet
  const walletData = localStorage.getItem('walletData');
  if (walletData) {
    try {
      const wallet = JSON.parse(walletData);
      if (wallet.xrpAddress) {
        wallets.push({
          id: 'riddle',
          name: 'Riddle Wallet',
          type: 'riddle',
          address: wallet.xrpAddress,
          available: true
        });
      }
    } catch (e) {
      console.error('Error parsing Riddle wallet data:', e);
    }
  }
  
  // Check Xaman wallet (from external wallet connection)
  const xamanAddress = localStorage.getItem('xaman_address');
  if (xamanAddress) {
    wallets.push({
      id: 'xaman',
      name: 'Xaman Wallet',
      type: 'xaman',
      address: xamanAddress,
      available: true
    });
  }
  
  // Check Joey wallet (from external wallet connection)
  const joeyAddress = localStorage.getItem('joey_address');
  if (joeyAddress) {
    wallets.push({
      id: 'joey',
      name: 'Joey Wallet',
      type: 'joey',
      address: joeyAddress,
      available: true
    });
  }
  
  console.log(`🔍 Found ${wallets.length} available XRPL wallets:`, wallets.map(w => w.name));
  return wallets;
}

export async function handleRiddleBuyOffer(
  nftId: string,
  offerAmount: string,
  ownerAddress: string,
  sessionToken: string,
  password: string
): Promise<{success: boolean; data?: any; error?: string}> {
  try {
    const response = await fetch('/api/broker/buyer-create-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        nftId,
        offerAmount,
        ownerAddress,
        password
      })
    });

    const data = await response.json() as any;
    return { success: data.success, data, error: data.error };
  } catch (error) {
    console.error('Riddle buy offer error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function handleExternalBuyOffer(
  nftId: string,
  offerAmount: string,
  ownerAddress: string,
  buyerAddress: string,
  walletType: 'xaman' | 'joey',
  sessionToken: string
): Promise<{success: boolean; transaction?: any; error?: string}> {
  try {
    // Calculate broker fee (1.589%)
    const brokerFee = (parseFloat(offerAmount) * 0.01589).toFixed(6);
    const totalAmount = (parseFloat(offerAmount) + parseFloat(brokerFee)).toFixed(6);
    
    console.log(`💰 Buy Offer: ${offerAmount} XRP + ${brokerFee} XRP fee = ${totalAmount} XRP total`);

    const response = await fetch('/api/nft/external/prepare-buy-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        nftokenID: nftId,
        buyerAddress,
        ownerAddress,
        amount: totalAmount, // Buyer pays total amount (price + broker fee)
        brokerFee: brokerFee
      })
    });

    const data = await response.json() as any;
    
    if (data.success && data.transaction) {
      // Return unsigned transaction for wallet to sign
      return { 
        success: true, 
        transaction: {
          ...data.transaction,
          walletType,
          operation: 'buy_offer'
        }
      };
    } else {
      return { success: false, error: data.error || 'Failed to prepare buy offer' };
    }
  } catch (error) {
    console.error('External buy offer error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function handleExternalInstantBuy(
  sellOfferID: string,
  nftId: string,
  buyerAddress: string,
  walletType: 'xaman' | 'joey',
  sessionToken: string
): Promise<{success: boolean; transaction?: any; error?: string}> {
  try {
    const response = await fetch('/api/nft/external/prepare-accept-sell-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        sellOfferID,
        buyerAddress
      })
    });

    const data = await response.json() as any;
    
    if (data.success && data.transaction) {
      return { 
        success: true, 
        transaction: {
          ...data.transaction,
          walletType,
          operation: 'instant_buy'
        }
      };
    } else {
      return { success: false, error: data.error || 'Failed to prepare instant buy' };
    }
  } catch (error) {
    console.error('External instant buy error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function signWithXaman(transaction: any): Promise<{success: boolean; signedTx?: string; error?: string}> {
  try {
    // For Xaman, we need to use the Xaman SDK to sign
    // This will open Xaman app/extension for signing
    console.log('🔐 Opening Xaman for signing:', transaction);
    
    // TODO: Implement Xaman SDK signing
    // For now, return a placeholder
    return { 
      success: false, 
      error: 'Xaman signing not yet implemented - please use Riddle wallet or wait for full Xaman integration' 
    };
  } catch (error) {
    console.error('Xaman signing error:', error);
    return { success: false, error: 'Failed to sign with Xaman' };
  }
}

export async function signWithJoey(transaction: any): Promise<{success: boolean; signedTx?: string; error?: string}> {
  try {
    // For Joey, we need to use the Joey Wallet SDK to sign
    console.log('🔐 Opening Joey Wallet for signing:', transaction);
    
    // TODO: Implement Joey Wallet SDK signing
    return { 
      success: false, 
      error: 'Joey Wallet signing not yet implemented - please use Riddle wallet or wait for full Joey integration' 
    };
  } catch (error) {
    console.error('Joey signing error:', error);
    return { success: false, error: 'Failed to sign with Joey' };
  }
}
