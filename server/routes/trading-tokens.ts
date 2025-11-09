import { Router } from 'express';
import { Client } from 'xrpl';
import { Connection, PublicKey } from '@solana/web3.js';

const router = Router();

// Price feeds - you can integrate with your existing price service
async function getPrice(symbol: string): Promise<number> {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`);
    const data = await response.json();
    return data[symbol.toLowerCase()]?.usd || 0;
  } catch {
    return 0;
  }
}

// Get XRP balance
async function getXRPBalance(address: string): Promise<string> {
  try {
    const client = new Client('wss://s1.ripple.com');
    await client.connect();
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    await client.disconnect();
    const drops = response.result.account_data.Balance;
    return (Number(drops) / 1000000).toFixed(6);
  } catch {
    return '0';
  }
}

// Get SOL balance
async function getSOLBalance(address: string): Promise<string> {
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return (balance / 1e9).toFixed(6);
  } catch {
    return '0';
  }
}

// Get ETH balance (placeholder - add proper provider)
async function getETHBalance(address: string): Promise<string> {
  // TODO: Integrate with Ethereum provider
  return '0';
}

// Get BTC balance (placeholder - add proper provider)
async function getBTCBalance(address: string): Promise<string> {
  // TODO: Integrate with Bitcoin provider  
  return '0';
}

/**
 * GET /api/trading/tokens
 * Get all available trading tokens with balances and prices
 */
router.get('/tokens', async (req, res) => {
  try {
    const session = (req as any).riddleSession;
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
    
    console.log(`📊 [TRADING] Fetching tokens for @${session.handle}`);
    
    // Fetch balances and prices in parallel
    const [xrpPrice, solPrice, btcPrice, ethPrice] = await Promise.all([
      getPrice('ripple'),
      getPrice('solana'),
      getPrice('bitcoin'),
      getPrice('ethereum')
    ]);
    
    const [xrpBalance, solBalance, ethBalance, btcBalance] = await Promise.all([
      getXRPBalance(session.walletData.xrpAddress),
      getSOLBalance(session.walletData.solAddress),
      getETHBalance(session.walletData.ethAddress),
      getBTCBalance(session.walletData.btcAddress)
    ]);
    
    const tokens = [
      {
        symbol: 'XRP',
        name: 'Ripple',
        address: session.walletData.xrpAddress,
        balance: xrpBalance,
        price: xrpPrice,
        value: (parseFloat(xrpBalance) * xrpPrice).toFixed(2),
        chain: 'XRPL',
        icon: 'https://cdn.bithomp.com/chains/xrp.svg'
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        address: session.walletData.solAddress,
        balance: solBalance,
        price: solPrice,
        value: (parseFloat(solBalance) * solPrice).toFixed(2),
        chain: 'Solana',
        icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg'
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        address: session.walletData.btcAddress,
        balance: btcBalance,
        price: btcPrice,
        value: (parseFloat(btcBalance) * btcPrice).toFixed(2),
        chain: 'Bitcoin',
        icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg'
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: session.walletData.ethAddress,
        balance: ethBalance,
        price: ethPrice,
        value: (parseFloat(ethBalance) * ethPrice).toFixed(2),
        chain: 'Ethereum',
        icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg'
      }
    ];
    
    const totalValue = tokens.reduce((sum, t) => sum + parseFloat(t.value), 0);
    
    res.json({
      success: true,
      tokens,
      totalValue: totalValue.toFixed(2),
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ [TRADING] Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tokens'
    });
  }
});

export default router;
