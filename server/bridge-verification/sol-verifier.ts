// Solana Transaction Verifier

import { Connection, PublicKey } from '@solana/web3.js';
import { ChainVerifier, VerificationRequest, VerificationResponse } from './types';

export class SOLVerifier implements ChainVerifier {
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    console.log('🔍 === SOLANA VERIFICATION START ===');
    console.log('📊 Verifying transaction:', request.txHash);

    try {
      // Get transaction details
      const tx = await this.connection.getTransaction(request.txHash, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        console.log('❌ Transaction not found');
        return {
          verified: false,
          message: 'Transaction not found on Solana'
        };
      }

      // Check if transaction was successful
      if (tx.meta?.err) {
        console.log('❌ Transaction failed');
        return {
          verified: false,
          message: 'Transaction failed on blockchain'
        };
      }

      console.log('📦 Transaction found:', {
        signature: request.txHash,
        slot: tx.slot,
        blockTime: tx.blockTime
      });

      // Check memo if provided
      let memoMatch = false;
      let transactionId: string | undefined;

      if (request.expectedMemo && tx.meta?.logMessages) {
        for (const log of tx.meta.logMessages) {
          if (log.includes('Program log: Memo')) {
            const memoData = log.split('"')[1];
            console.log('📝 Found memo:', memoData);
            
            if (memoData === request.expectedMemo) {
              memoMatch = true;
              transactionId = memoData;
              break;
            }
          }
        }
      }

      // Extract amount from balance changes
      let actualAmount: string | undefined;
      if (tx.meta?.postBalances && tx.meta?.preBalances) {
        const balanceChange = Math.abs(tx.meta.postBalances[0] - tx.meta.preBalances[0]);
        actualAmount = (balanceChange / 1e9).toString(); // Convert lamports to SOL
        console.log('💰 Transaction amount:', actualAmount, 'SOL');
      }

      // Get confirmations
      const currentSlot = await this.connection.getSlot();
      const confirmations = currentSlot - tx.slot;

      console.log('✅ Solana verification complete');
      return {
        verified: true,
        memoMatch: memoMatch || !request.expectedMemo,
        transactionId,
        actualAmount,
        blockNumber: tx.slot,
        confirmations,
        message: 'Transaction verified on Solana'
      };

    } catch (error) {
      console.error('💥 Solana verification error:', error);
      return {
        verified: false,
        message: error instanceof Error ? error.message : 'Solana verification failed'
      };
    } finally {
      console.log('🔍 === SOLANA VERIFICATION END ===');
    }
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      const tx = await this.connection.getTransaction(txHash, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return 0;
      }

      const currentSlot = await this.connection.getSlot();
      return currentSlot - tx.slot;

    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    }
  }
}