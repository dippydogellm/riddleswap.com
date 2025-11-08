// XRP/XRPL Transaction Verifier

import { Client as XRPLClient } from 'xrpl';
import { ChainVerifier, VerificationRequest, VerificationResponse } from './types';

export class XRPVerifier implements ChainVerifier {
  private client: XRPLClient;

  constructor() {
    this.client = new XRPLClient('wss://s1.ripple.com');
  }

  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    console.log('🔍 === XRPL VERIFICATION START ===');
    console.log('📊 Verifying transaction:', request.txHash);

    try {
      // Connect to XRPL
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      // Get transaction details
      const txResponse = await this.client.request({
        command: 'tx',
        transaction: request.txHash
      });

      // Check if transaction exists and is validated
      if (!txResponse.result || !txResponse.result.validated) {
        console.log('❌ Transaction not found or not validated');
        return {
          verified: false,
          message: 'Transaction not found or not validated on XRPL'
        };
      }

      const tx = txResponse.result;
      
      // CRITICAL: Check if transaction was successful
      if (tx.meta && typeof tx.meta === 'object' && 'TransactionResult' in tx.meta) {
        const txResult = tx.meta.TransactionResult;
        console.log('🎯 Transaction result:', txResult);
        
        if (txResult !== 'tesSUCCESS') {
          console.log('❌ Transaction failed with result:', txResult);
          return {
            verified: false,
            message: `Transaction failed on XRPL: ${txResult}`
          };
        }
      } else {
        console.log('❌ No transaction result found in meta');
        return {
          verified: false,
          message: 'Unable to verify transaction result'
        };
      }
      console.log('📦 Transaction found:', {
        hash: tx.hash,
        account: tx.tx_json?.Account,
        destination: tx.tx_json?.Destination,
        validated: tx.validated
      });

      // Check memo if provided
      let memoMatch = false;
      let transactionId: string | undefined;

      const memos = tx.tx_json?.Memos;
      if (request.expectedMemo && memos && Array.isArray(memos)) {
        for (const memoObj of memos) {
          if (memoObj.Memo?.MemoData) {
            const memoData = Buffer.from(memoObj.Memo.MemoData, 'hex').toString('utf8');
            console.log('📝 Found memo:', memoData);
            
            if (memoData === request.expectedMemo) {
              memoMatch = true;
              transactionId = memoData;
              break;
            }
          }
        }
      }

      // Extract amount
      let actualAmount: string | undefined;
      const amount = tx.tx_json?.Amount;
      if (amount) {
        if (typeof amount === 'string') {
          // XRP amount in drops
          actualAmount = (parseInt(amount) / 1000000).toString();
        } else if (typeof amount === 'object' && amount && 'value' in amount && typeof amount.value === 'string') {
          // Token amount
          actualAmount = amount.value;
        }
      }

      // Get delivered amount for more accurate verification
      if (tx.meta && typeof tx.meta === 'object' && 'delivered_amount' in tx.meta) {
        const delivered = tx.meta.delivered_amount;
        if (typeof delivered === 'string') {
          actualAmount = (parseInt(delivered) / 1000000).toString();
        } else if (typeof delivered === 'object' && delivered.value) {
          actualAmount = delivered.value;
        }
        console.log('💰 Delivered amount:', actualAmount);
      }

      // Get block information
      const ledgerIndex = tx.ledger_index || 0;
      const currentLedger = await this.client.request({ command: 'ledger_current' });
      const confirmations = currentLedger.result.ledger_current_index - ledgerIndex;

      console.log('✅ XRPL verification complete');
      return {
        verified: true,
        memoMatch: memoMatch || !request.expectedMemo,
        transactionId,
        actualAmount,
        blockNumber: ledgerIndex,
        confirmations,
        message: 'Transaction verified on XRPL'
      };

    } catch (error) {
      console.error('💥 XRPL verification error:', error);
      return {
        verified: false,
        message: error instanceof Error ? error.message : 'XRPL verification failed'
      };
    } finally {
      if (this.client.isConnected()) {
        await this.client.disconnect();
      }
      console.log('🔍 === XRPL VERIFICATION END ===');
    }
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      const txResponse = await this.client.request({
        command: 'tx',
        transaction: txHash
      });

      if (!txResponse.result || !txResponse.result.validated) {
        return 0;
      }

      const ledgerIndex = txResponse.result.ledger_index;
      if (typeof ledgerIndex !== 'number') {
        return 0;
      }
      
      const currentLedger = await this.client.request({ command: 'ledger_current' });
      return currentLedger.result.ledger_current_index - ledgerIndex;

    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    } finally {
      if (this.client.isConnected()) {
        await this.client.disconnect();
      }
    }
  }
}