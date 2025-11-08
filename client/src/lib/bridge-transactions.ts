// Bridge Transaction Management System
// Handles Xaman (XRPL), WalletConnect (other chains), and Riddle Wallet transactions

interface CreateBridgeTransactionParams {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  calculation: any;
  destinationAddress: string;
  walletAddress: string;
  walletType: 'riddle' | 'xaman' | 'walletconnect';
}

interface BridgeTransactionResponse {
  transactionId: string;
  bankWalletAddress: string;
  memo?: string;
  destinationTag?: number;
}

// Create bridge transaction with memo/ID tracking
export async function createBridgeTransaction(params: CreateBridgeTransactionParams & { password?: string; handle?: string }): Promise<BridgeTransactionResponse> {
  try {
    // Generate ONE unique ID to prevent duplicates
    const uniqueId = Date.now().toString();
    
    // Use the working bridge endpoint instead of the old create-transaction endpoint
    const response = await fetch('/api/riddle-wallet/bridge-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: params.handle,
        fromToken: params.fromToken,
        toToken: params.toToken, // Add destination token for bank wallet selection
        amount: params.fromAmount.toString(),
        destinationAddress: params.destinationAddress,
        password: params.password,
        transactionId: `bridge-${uniqueId}`,
        memo: `BRIDGE-${uniqueId}`
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create bridge transaction');
    }

    return await response.json() as any;
  } catch (error) {

    throw error;
  }
}

// Create Xaman payload using external wallet API
export async function createXamanBridgePayload(params: {
  fromToken: string;
  amount: number;
  destinationAddress: string;
  transactionId: string;
  paymentType?: 'token' | 'fee';
}): Promise<{
  payloadUUID: string;
  qrCodeUrl: string;
  deepLinkUrl: string;
}> {
  try {
    // Use external wallet API for Xaman connection
    const response = await fetch('/api/external-wallets/xaman/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: `Bridge payment: ${params.amount} ${params.fromToken} to ${params.destinationAddress}`,
        memo: `BRIDGE-${params.transactionId}`,
        destinationTag: generateDestinationTag(params.transactionId)
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create Xaman bridge payload');
    }

    const data = await response.json() as any;
    return {
      payloadUUID: data.uuid,
      qrCodeUrl: `data:image/png;base64,${data.qrCode}`,
      deepLinkUrl: data.deepLink
    };
  } catch (error) {
    throw error;
  }
}

// Create WalletConnect transaction for non-XRPL tokens
export async function createWalletConnectTransaction(params: {
  fromToken: string;
  amount: number;
  destinationAddress: string;
  transactionId: string;
  walletAddress: string;
}): Promise<{
  txHash: string;
  success: boolean;
}> {
  try {
    // Get transaction data from backend
    const response = await fetch('/api/bridge/walletconnect-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromToken: params.fromToken,
        amount: params.amount,
        destinationAddress: params.destinationAddress,
        transactionId: params.transactionId,
        walletAddress: params.walletAddress,
        memo: `BRIDGE-${params.transactionId}` // Include transaction ID in memo
      })
    });

    if (!response.ok) {
      throw new Error('Failed to prepare transaction');
    }

    const { txData } = await response.json() as any;

    // Execute transaction through ethers provider
    const { ethers } = await import('ethers');
    
    // Get provider from window.ethereum (injected by wallet)
    if (!window.ethereum) {
      throw new Error('No Ethereum provider found');
    }

    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    
    // Verify correct address
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== params.walletAddress.toLowerCase()) {
      throw new Error('Wallet address mismatch');
    }

    // Send transaction
    const tx = await signer.sendTransaction({
      to: txData.to,
      value: txData.value,
      data: txData.data,
      gasLimit: 100000 // Higher gas limit for token transfers
    });

    // Wait for transaction to be mined
    await tx.wait();

    return {
      txHash: tx.hash,
      success: true
    };
  } catch (error) {

    throw error;
  }
}

// Update transaction with hash after completion
export async function updateTransactionHash(transactionId: string, step: number, txHash: string): Promise<void> {
  try {
    await fetch('/api/bridge/update-transaction-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId,
        step,
        txHash
      })
    });
  } catch (error) {

    throw error;
  }
}

// Enhanced verification system for all wallet types
export async function verifyTransaction(params: {
  transactionId: string;
  step: number;
  walletAddress: string;
  expectedAmount: number;
  tokenType: string;
}): Promise<{
  verified: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/bridge/verify-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Verification failed');
    }

    return await response.json() as any;
  } catch (error) {

    return { verified: false, error: (error as Error).message };
  }
}

// Create Riddle Wallet transaction for any supported token
export async function createRiddleWalletTransaction(params: {
  fromToken: string;
  toToken: string;
  amount: number;
  destinationAddress: string;
  transactionId: string;
  paymentType: 'token' | 'fee';
  riddleWalletHandle: string;
}): Promise<{
  txHash: string;
  success: boolean;
  message: string;
}> {
  try {
    // Send transaction through Riddle wallet backend
    const response = await fetch('/api/riddle-wallet/bridge-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromToken: params.fromToken,
        toToken: params.toToken,
        amount: params.amount,
        destinationAddress: params.destinationAddress,
        transactionId: params.transactionId,
        paymentType: params.paymentType,
        handle: params.riddleWalletHandle,
        memo: `BRIDGE-${params.transactionId}` // Include transaction ID in memo
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      throw new Error(errorData.error || 'Failed to execute Riddle wallet transaction');
    }

    const result = await response.json() as any;
    return {
      txHash: result.txHash,
      success: result.success,
      message: result.message || 'Transaction completed successfully'
    };
  } catch (error) {

    throw error;
  }
}

// Helper functions
function getChainFromToken(token: string): string {
  const chainMap: Record<string, string> = {
    'XRP': 'xrpl',
    'RDL': 'xrpl',
    'ETH': 'ethereum',
    'USDC': 'ethereum',
    'SOL': 'solana',
    'BNB': 'bsc'
  };
  return chainMap[token] || 'xrpl';
}

function generateDestinationTag(transactionId: string): number {
  // Generate deterministic destination tag from transaction ID
  const hash = transactionId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(hash) % 4294967295; // Max destination tag value
}
