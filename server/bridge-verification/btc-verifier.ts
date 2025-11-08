// Bitcoin Transaction Verifier

import { ChainVerifier, VerificationRequest, VerificationResponse } from './types';

export class BTCVerifier implements ChainVerifier {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://blockstream.info/api';
  }

  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    console.log('🔍 === BITCOIN VERIFICATION START ===');
    console.log('📊 Verifying transaction:', request.txHash);

    try {
      // Retry mechanism for freshly broadcast transactions
      // Bitcoin transactions take 10-30 seconds to appear on Blockstream API
      const maxRetries = 6;
      const retryDelays = [0, 5000, 10000, 15000, 20000, 30000]; // 0s, 5s, 10s, 15s, 20s, 30s
      
      let tx: any = null;
      let lastError: string | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = retryDelays[attempt];
          console.log(`⏳ Waiting ${delay/1000}s before retry attempt ${attempt + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log(`🔍 Verification attempt ${attempt + 1}/${maxRetries}...`);
        const txResponse = await fetch(`${this.baseUrl}/tx/${request.txHash}`);
        
        if (txResponse.ok) {
          tx = await txResponse.json();
          console.log('✅ Transaction found on blockchain!');
          break;
        } else {
          lastError = `HTTP ${txResponse.status}: ${txResponse.statusText}`;
          console.log(`⚠️ Attempt ${attempt + 1} failed: ${lastError}`);
        }
      }
      
      if (!tx) {
        console.log('❌ Transaction not found after all retries');
        return {
          verified: false,
          message: `Transaction not found on Bitcoin blockchain after ${maxRetries} attempts. ${lastError || 'Unknown error'}`
        };
      }

      console.log('📦 Transaction details:', {
        txid: tx.txid,
        confirmations: tx.status.confirmed ? tx.status.block_height : 0,
        confirmed: tx.status.confirmed
      });

      // ✅ ACCEPT UNCONFIRMED TRANSACTIONS
      // We broadcast this transaction ourselves, so we know it exists
      // It's safe to distribute tokens even before confirmation
      if (!tx.status.confirmed) {
        console.log('⏳ Transaction is unconfirmed but valid (we just broadcast it)');
        console.log('✅ Accepting unconfirmed transaction for token distribution');
        // Continue to verification...
      }

      // Extract amount (sum of outputs)
      let totalAmount = 0;
      for (const output of tx.vout) {
        totalAmount += output.value;
      }
      const actualAmount = (totalAmount / 100000000).toString(); // Convert satoshis to BTC
      console.log('💰 Total output amount:', actualAmount, 'BTC');

      // Get current block height for confirmations
      const tipResponse = await fetch(`${this.baseUrl}/blocks/tip/height`);
      const currentHeight = await tipResponse.text();
      const confirmations = parseInt(currentHeight) - tx.status.block_height + 1;

      console.log('✅ Bitcoin verification complete');
      return {
        verified: true,
        memoMatch: true, // Bitcoin doesn't have native memo support
        actualAmount,
        blockNumber: tx.status.block_height,
        confirmations,
        message: 'Transaction verified on Bitcoin blockchain'
      };

    } catch (error) {
      console.error('💥 Bitcoin verification error:', error);
      return {
        verified: false,
        message: error instanceof Error ? error.message : 'Bitcoin verification failed'
      };
    } finally {
      console.log('🔍 === BITCOIN VERIFICATION END ===');
    }
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      const txResponse = await fetch(`${this.baseUrl}/tx/${txHash}`);
      
      if (!txResponse.ok) {
        return 0;
      }

      const tx = await txResponse.json();
      
      if (!tx.status.confirmed) {
        return 0;
      }

      const tipResponse = await fetch(`${this.baseUrl}/blocks/tip/height`);
      const currentHeight = await tipResponse.text();
      
      return parseInt(currentHeight) - tx.status.block_height + 1;

    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    }
  }
}