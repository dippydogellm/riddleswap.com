// Ethereum/EVM Transaction Verifier

import { ethers } from 'ethers';
import { ChainVerifier, VerificationRequest, VerificationResponse } from './types';

export class ETHVerifier implements ChainVerifier {
  private provider: ethers.JsonRpcProvider;
  private network: string;

  constructor(network: 'ETH' | 'BNB' | 'MATIC' | 'BASE' = 'ETH') {
    this.network = network;
    
    // Set RPC URLs for different networks
    switch (network) {
      case 'ETH':
        this.provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
        break;
      case 'BNB':
        this.provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org');
        break;
      case 'MATIC':
        this.provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        break;
      case 'BASE':
        this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        break;
      default:
        this.provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    }
  }

  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    console.log(`🔍 === ${this.network} VERIFICATION START ===`);
    console.log('📊 Verifying transaction:', request.txHash);

    try {
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(request.txHash);
      
      if (!receipt) {
        console.log('❌ Transaction not found');
        return {
          verified: false,
          message: `Transaction not found on ${this.network}`
        };
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        console.log('❌ Transaction failed');
        return {
          verified: false,
          message: 'Transaction failed on blockchain'
        };
      }

      console.log('📦 Transaction found:', {
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to,
        blockNumber: receipt.blockNumber
      });

      // Get transaction details
      const tx = await this.provider.getTransaction(request.txHash);
      
      if (!tx) {
        return {
          verified: false,
          message: 'Unable to get transaction details'
        };
      }

      // Check memo in data field if provided
      let memoMatch = false;
      let transactionId: string | undefined;
      
      if (request.expectedMemo && tx.data && tx.data !== '0x') {
        try {
          const memoData = ethers.toUtf8String(tx.data);
          console.log('📝 Found memo:', memoData);
          
          if (memoData === request.expectedMemo) {
            memoMatch = true;
            transactionId = memoData;
          }
        } catch {
          // Data might not be UTF-8 encoded
        }
      }

      // Extract amount
      const actualAmount = ethers.formatEther(tx.value);
      console.log('💰 Transaction amount:', actualAmount, this.network);

      // Get confirmations
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      console.log(`✅ ${this.network} verification complete`);
      return {
        verified: true,
        memoMatch: memoMatch || !request.expectedMemo,
        transactionId,
        actualAmount,
        blockNumber: receipt.blockNumber,
        confirmations,
        message: `Transaction verified on ${this.network}`
      };

    } catch (error) {
      console.error(`💥 ${this.network} verification error:`, error);
      return {
        verified: false,
        message: error instanceof Error ? error.message : `${this.network} verification failed`
      };
    } finally {
      console.log(`🔍 === ${this.network} VERIFICATION END ===`);
    }
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return 0;
      }

      const currentBlock = await this.provider.getBlockNumber();
      return currentBlock - receipt.blockNumber;

    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    }
  }
}