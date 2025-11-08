import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuthentication, readOnlyAuth } from '../middleware/session-auth';
import { getMultiChainBalances } from '../lib/balance-aggregator';
import { getActiveSession } from '../riddle-wallet-auth';

const router = Router();

interface ChainBalance {
  chain: string;
  balance: string;
  usdValue: number;
  nativeSymbol: string;
}

interface BalanceResponse {
  totalUsd: number;
  chains: ChainBalance[];
}

router.get('/total-balance', readOnlyAuth, async (req: any, res: Response) => {
  try {
    console.log('💰 [TOTAL-BALANCE] Endpoint called');
    
    // readOnlyAuth middleware already validated session and set req.user and req.session
    if (!req.session || !req.session.walletData) {
      console.log('❌ [TOTAL-BALANCE] Session or wallet data not found');
      return res.status(400).json({ error: 'No wallet data found' });
    }
    
    console.log('📊 [TOTAL-BALANCE] Session found for:', req.user.handle);
    
    // Extract wallet addresses from session (set by readOnlyAuth middleware)
    const walletData = {
      xrpAddress: req.session.walletData.xrpAddress,
      ethAddress: req.session.walletData.ethAddress,
      solAddress: req.session.walletData.solAddress,
      btcAddress: req.session.walletData.btcAddress
    };

    console.log('📊 [TOTAL-BALANCE] Wallet addresses:', {
      xrp: walletData.xrpAddress ? 'present' : 'missing',
      eth: walletData.ethAddress ? 'present' : 'missing',
      sol: walletData.solAddress ? 'present' : 'missing',
      btc: walletData.btcAddress ? 'present' : 'missing'
    });

    if (!walletData.xrpAddress && !walletData.ethAddress && !walletData.solAddress && !walletData.btcAddress) {
      console.log('❌ [TOTAL-BALANCE] No wallet addresses in session');
      return res.status(400).json({ error: 'No wallet addresses found' });
    }

    // Get balances for all chains
    const balances = await getMultiChainBalances(walletData);
    console.log('💵 [TOTAL-BALANCE] Fetched balances:', {
      totalUsd: balances.totalUsd,
      chainsCount: balances.chains.length,
      chains: balances.chains.map(c => `${c.chain}: ${c.balance} (${c.usdValue} USD)`)
    });

    const response: BalanceResponse = {
      totalUsd: balances.totalUsd,
      chains: balances.chains.map(chain => ({
        chain: chain.chain,
        balance: chain.balance,
        usdValue: chain.usdValue,
        nativeSymbol: chain.symbol
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('❌ [TOTAL-BALANCE] Error fetching total balance:', error);
    res.status(500).json({ 
      error: 'Failed to fetch total balance',
      totalUsd: 0,
      chains: []
    });
  }
});

export default router;
