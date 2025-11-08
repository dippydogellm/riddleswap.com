import { Request, Response } from 'express';
import { generateRTN } from './utils/rtn-generator';
import { storage } from './storage';
import { sessionAuth } from './middleware/session-auth';

// Extend Request interface for auth data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        handle: string;
        userHandle: string;
        walletAddress: string;
        cachedKeys?: any;
      };
      session?: {
        handle: string;
        cachedKeys: any;
        walletData: any;
      };
    }
  }
}

// Use Bearer token authentication middleware like other wallet endpoints
const authenticateSession = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }

    // Get session from riddle-wallet-auth module
    const authModule = await import('./riddle-wallet-auth');
    const session = authModule.getActiveSession(sessionToken);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }
    
    // Security check
    if (Date.now() > session.expiresAt) {
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }
    
    req.user = {
      id: session.handle,
      handle: session.handle,
      userHandle: session.handle,
      walletAddress: session.walletData?.xrpAddress || ''
    };
    req.session = { 
      handle: session.handle,
      cachedKeys: session.cachedKeys,
      walletData: session.walletData
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Generic payment interface
interface PaymentRequest {
  fromAddress?: string;
  toAddress: string;
  amount: string;
  asset?: string; // 'SOL', 'XRP', or token mint/currency code
  memo?: string;
  destinationTag?: number; // For XRP exchanges
  chain: 'sol' | 'xrp' | 'eth' | 'btc';
  tokenCurrency?: string; // For XRPL token payments
  tokenIssuer?: string; // For XRPL token payments
}

interface PaymentResponse {
  success: boolean;
  rtn?: string;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
  fees?: string;
  estimatedTime?: string;
}

// Register payment routes
export function registerPaymentRoutes(app: any) {
  // Generic payment endpoint - handles all chains (uses sessionAuth middleware for proper cached keys)
  app.post('/api/payment/send', sessionAuth, async (req: Request, res: Response) => {
    let rtn: string | undefined;
    
    try {
      // Generate RTN first
      rtn = generateRTN();
      
      const payment = req.body as PaymentRequest;
      const handle = req.user?.handle || 'authenticated_user';
      
      console.log(`🔐 [RTN:${rtn}] Authentication successful for ${handle}`);
      
      console.log(`🔄 [RTN:${rtn}] Processing ${payment.chain?.toUpperCase() || 'UNKNOWN'} payment:`, {
        to: payment.toAddress,
        amount: payment.amount,
        asset: payment.asset || 'native',
        memo: payment.memo ? 'present' : 'none',
        destinationTag: payment.destinationTag
      });

      if (!payment.toAddress || !payment.amount || !payment.chain) {
        return res.status(400).json({
          success: false,
          rtn,
          error: 'Missing required fields: toAddress, amount, chain'
        });
      }
      
      console.log(`📝 [RTN:${rtn}] Processing payment for ${handle}`);
      console.log(`🔑 [RTN:${rtn}] Session data available:`, {
        hasCachedKeys: !!req.user?.cachedKeys,
        hasXrpPrivateKey: !!req.user?.cachedKeys?.xrpPrivateKey,
        sessionKeys: req.user?.cachedKeys ? Object.keys(req.user.cachedKeys) : []
      });

      let result: PaymentResponse;

      switch (payment.chain) {
        case 'xrp':
          result = await processXRPPayment(handle, payment, req.user?.cachedKeys, rtn);
          break;
        case 'sol':
          result = await processSolanaPayment(handle, payment, req.user?.cachedKeys, rtn);
          break;
        case 'eth':
          return res.json({
            success: false,
            rtn,
            error: 'Ethereum payments coming soon! Use existing wallet functionality.'
          });
        case 'btc':
          return res.json({
            success: false,
            rtn,
            error: 'Bitcoin payments coming soon! Use existing wallet functionality.'
          });
        default:
          return res.status(400).json({
            success: false,
            rtn,
            error: `Unsupported chain: ${payment.chain}`
          });
      }

      // Ensure RTN is included in response
      if (result && rtn) {
        result.rtn = rtn;
      }
      
      res.json(result);
    } catch (error) {
      console.error(`❌ [RTN:${rtn}] Payment processing error:`, error);
      
      res.status(500).json({
        success: false,
        rtn,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      });
    }
  });

  // Fee estimation endpoint
  app.post('/api/payment/estimate-fee', (req: Request, res: Response) => {
    res.json({
      success: true,
      estimatedFee: '0.000005 SOL',
      estimatedTime: '~30 seconds',
      note: 'Fee estimation coming soon'
    });
  });
}

// Chain-specific payment processors  
async function processXRPPayment(handle: string, payment: Omit<PaymentRequest, 'chain'>, cachedKeys?: any, rtn?: string): Promise<PaymentResponse> {
  try {
    const { Client, Wallet } = await import('xrpl');
    
    // Use cached private keys (already decrypted during login)
    if (!cachedKeys || !cachedKeys.xrpPrivateKey) {
      return { success: false, error: 'XRP wallet not found in session' };
    }

    const client = new Client('wss://xrplcluster.com/');
    await client.connect();
    
    const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
    
    // BALANCE VALIDATION: Check available balance before proceeding
    console.log('💰 [BALANCE CHECK] Validating available balance before payment...');
    
    try {
      const accountInfo = await client.request({
        command: 'account_info',
        account: wallet.address
      });
      
      const serverInfo = await client.request({ command: 'server_info' });
      
      const accountData = accountInfo.result.account_data;
      const totalBalance = parseFloat(accountData.Balance) / 1000000; // Convert drops to XRP
      const ownerCount = accountData.OwnerCount || 0;
      
      const validatedLedger = serverInfo.result?.info?.validated_ledger;
      const baseReserve = parseFloat(String(validatedLedger?.reserve_base_xrp || '10'));
      const ownerReserve = parseFloat(String(validatedLedger?.reserve_inc_xrp || '2'));
      
      const totalReserved = baseReserve + (ownerReserve * ownerCount);
      const availableBalance = Math.max(0, totalBalance - totalReserved);
      
      // Check balance based on payment type
      if (!payment.tokenCurrency || payment.tokenCurrency === 'XRP') {
        // XRP payment - check available XRP balance
        const requestedAmount = parseFloat(payment.amount);
        const estimatedNetworkFee = 0.000012; // Standard network fee
        const totalRequired = requestedAmount + estimatedNetworkFee;
        
        console.log(`💰 [BALANCE CHECK] XRP Payment: Available=${availableBalance.toFixed(6)}, Required=${totalRequired.toFixed(6)} (${requestedAmount} + ${estimatedNetworkFee} fee)`);
        
        if (availableBalance < totalRequired) {
          await client.disconnect();
          return {
            success: false,
            error: `Insufficient available balance. You have ${availableBalance.toFixed(6)} XRP available (${totalBalance.toFixed(6)} total - ${totalReserved.toFixed(2)} reserved), but need ${totalRequired.toFixed(6)} XRP for this payment (${requestedAmount} + ${estimatedNetworkFee} network fee).`
          };
        }
      } else {
        // Token payment - check if we have enough XRP for network fees
        const estimatedNetworkFee = 0.000012;
        
        console.log(`💰 [BALANCE CHECK] Token Payment: Available XRP=${availableBalance.toFixed(6)}, Network Fee=${estimatedNetworkFee}`);
        
        if (availableBalance < estimatedNetworkFee) {
          await client.disconnect();
          return {
            success: false,
            error: `Insufficient XRP for network fees. You need at least ${estimatedNetworkFee} XRP available for transaction fees, but only have ${availableBalance.toFixed(6)} XRP available.`
          };
        }
        
        // TODO: For token payments, we should also validate token balance
        // This would require checking trustlines and token balances
        console.log(`⚠️ [BALANCE CHECK] Token balance validation not implemented yet for ${payment.tokenCurrency}`);
      }
      
      console.log('✅ [BALANCE CHECK] Sufficient balance confirmed');
      
    } catch (balanceError) {
      console.error('⚠️ [BALANCE CHECK] Balance validation failed:', balanceError);
      await client.disconnect();
      return {
        success: false,
        error: 'Unable to verify wallet balance. Please try again.'
      };
    }
    
    // Create payment transaction
    const paymentTx: any = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: payment.toAddress
    };

    // Handle token vs XRP payments
    if (payment.tokenCurrency && payment.tokenIssuer) {
      // Token payment - use PartialPayment flag for security
      paymentTx.Amount = {
        currency: payment.tokenCurrency,
        value: payment.amount,
        issuer: payment.tokenIssuer
      };
      paymentTx.Flags = 131072; // tfPartialPayment for token payments only
      console.log(`💰 Sending ${payment.amount} ${payment.tokenCurrency} to ${payment.toAddress}`);
    } else {
      // XRP payment - NO PartialPayment flag (not allowed for XRP→XRP)
      paymentTx.Amount = Math.round(parseFloat(payment.amount) * 1000000).toString(); // Convert XRP to drops
      console.log(`💰 Sending ${payment.amount} XRP to ${payment.toAddress}`);
    }

    // Add destination tag if provided
    if (payment.destinationTag !== undefined && payment.destinationTag !== null) {
      paymentTx.DestinationTag = payment.destinationTag;
      console.log(`💳 Adding destination tag: ${payment.destinationTag}`);
    }

    // Add memo if provided
    if (payment.memo && payment.memo.trim()) {
      paymentTx.Memos = [{
        Memo: {
          MemoData: Buffer.from(payment.memo, 'utf8').toString('hex').toUpperCase()
        }
      }];
      console.log(`📝 Adding memo: ${payment.memo}`);
    }

    console.log(`💰 [RTN:${rtn}] Sending ${payment.amount} XRP to ${payment.toAddress}` + 
                (paymentTx.DestinationTag ? ` (Tag: ${paymentTx.DestinationTag})` : ''));
    
    const prepared = await client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    console.log(`📝 [RTN:${rtn}] XRP payment submitted with hash: ${signed.hash}`);
    
    const submitted = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();

    if (submitted.result.meta && typeof submitted.result.meta === 'object' && 
        'TransactionResult' in submitted.result.meta && 
        submitted.result.meta.TransactionResult === 'tesSUCCESS') {
      
      console.log(`✅ [RTN:${rtn}] XRP payment completed successfully`);
      
      return {
        success: true,
        rtn,
        txHash: submitted.result.hash,
        explorerUrl: `https://livenet.xrpl.org/transactions/${submitted.result.hash}`,
        fees: `${(parseInt(prepared.Fee) / 1000000).toFixed(6)} XRP`,
        estimatedTime: 'Confirmed'
      };
    } else {
      console.log(`❌ [RTN:${rtn}] XRP payment failed: Transaction not successful`);
      
      return { 
        success: false, 
        rtn,
        error: 'Transaction failed or was not successful' 
      };
    }

  } catch (error) {
    console.error(`❌ [RTN:${rtn}] XRP payment error:`, error);
    
    return { 
      success: false,
      rtn,
      error: error instanceof Error ? error.message : 'XRP payment failed' 
    };
  }
}

async function processSolanaPayment(handle: string, payment: Omit<PaymentRequest, 'chain'>, cachedKeys?: any, rtn?: string): Promise<PaymentResponse> {
  try {
    // Import Solana libraries
    const { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair } = await import('@solana/web3.js');
    
    // Use cached private keys (already decrypted during login)
    if (!cachedKeys || !cachedKeys.solPrivateKey) {
      return { success: false, error: 'Solana wallet not found in session' };
    }

    const connection = new Connection('https://api.mainnet-beta.solana.com');
    
    // Create keypair from private key
    const privateKeyBuffer = Buffer.from(cachedKeys.solPrivateKey, 'hex');
    const fromKeypair = Keypair.fromSecretKey(privateKeyBuffer);
    
    const toPublicKey = new PublicKey(payment.toAddress);
    const lamports = Math.round(parseFloat(payment.amount) * 1e9); // Convert SOL to lamports

    // BALANCE VALIDATION: Check available balance before proceeding
    console.log('💰 [BALANCE CHECK] Validating Solana balance before payment...');
    
    try {
      const balance = await connection.getBalance(fromKeypair.publicKey);
      const balanceSOL = balance / 1e9; // Convert lamports to SOL
      const requestedAmountSOL = parseFloat(payment.amount);
      const estimatedFee = 0.000005; // Standard Solana transaction fee (5000 lamports)
      const totalRequired = requestedAmountSOL + estimatedFee;
      
      console.log(`💰 [BALANCE CHECK] SOL Payment: Available=${balanceSOL.toFixed(9)}, Required=${totalRequired.toFixed(9)} (${requestedAmountSOL} + ${estimatedFee} fee)`);
      
      if (balanceSOL < totalRequired) {
        return {
          success: false,
          error: `Insufficient SOL balance. You have ${balanceSOL.toFixed(6)} SOL available, but need ${totalRequired.toFixed(6)} SOL for this payment (${requestedAmountSOL} + ${estimatedFee} network fee).`
        };
      }
      
      console.log('✅ [BALANCE CHECK] Sufficient SOL balance confirmed');
      
    } catch (balanceError) {
      console.error('⚠️ [BALANCE CHECK] SOL balance validation failed:', balanceError);
      return {
        success: false,
        error: 'Unable to verify SOL wallet balance. Please try again.'
      };
    }

    if (payment.asset === 'native' || !payment.asset) {
      // Native SOL transfer
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports,
        })
      );

      if (payment.memo) {
        // Add memo instruction if provided
        transaction.add({
          keys: [],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(payment.memo, 'utf8'),
        });
      }

      const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
      
      return {
        success: true,
        txHash: signature,
        explorerUrl: `https://solscan.io/tx/${signature}`,
        fees: '0.000005 SOL',
        estimatedTime: 'Confirmed'
      };
    } else {
      // SPL token transfer (if needed in future)
      return { success: false, error: 'SPL token transfers not yet implemented' };
    }
  } catch (error) {
    console.error('Solana payment error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Solana payment failed' 
    };
  }
}

async function processXRPLPayment(handle: string, payment: Omit<PaymentRequest, 'chain'>): Promise<PaymentResponse> {
  try {
    // Use existing XRPL payment endpoint
    const xrplModule = await import('./xrpl/xrpl-routes');
    // This would integrate with existing XRPL payment system
    return { success: false, error: 'XRPL payment integration pending' };
  } catch (error) {
    return { success: false, error: 'XRPL payment failed' };
  }
}

async function processEthereumPayment(handle: string, payment: Omit<PaymentRequest, 'chain'>): Promise<PaymentResponse> {
  // Future implementation for Ethereum payments
  return { success: false, error: 'Ethereum payments not yet implemented' };
}

async function processBitcoinPayment(handle: string, payment: Omit<PaymentRequest, 'chain'>): Promise<PaymentResponse> {
  // Future implementation for Bitcoin payments
  return { success: false, error: 'Bitcoin payments not yet implemented' };
}

console.log('✅ Payment endpoints module loaded');