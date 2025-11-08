// Ethereum/EVM Bridge Handler - Handles ETH, BNB, MATIC, BASE and ERC20 tokens

import { ethers } from 'ethers';
import { ChainHandler, ChainPaymentParams, BridgePaymentResponse, BANK_WALLETS } from './types';

export class ETHHandler implements ChainHandler {
  private network: string;
  private rpcUrl: string;
  private bankWallet: string;

  constructor(network: 'ETH' | 'BNB' | 'MATIC' | 'BASE' = 'ETH') {
    this.network = network;
    this.bankWallet = BANK_WALLETS[network];
    
    // Set RPC URLs for different networks
    switch (network) {
      case 'ETH':
        this.rpcUrl = 'https://eth.llamarpc.com';
        break;
      case 'BNB':
        this.rpcUrl = 'https://bsc-dataseed.binance.org';
        break;
      case 'MATIC':
        this.rpcUrl = 'https://polygon-rpc.com';
        break;
      case 'BASE':
        this.rpcUrl = 'https://mainnet.base.org';
        break;
      default:
        this.rpcUrl = 'https://eth.llamarpc.com';
    }
  }

  getBankWallet(): string {
    return this.bankWallet;
  }

  validateAddress(address: string): boolean {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  async execute(params: ChainPaymentParams): Promise<BridgePaymentResponse> {
    console.log(`🔗 === ${this.network} TRANSFER START ===`);
    console.log('📊 Transfer Parameters:', {
      from: params.fromAddress,
      to: params.toAddress,
      amount: params.amount,
      token: params.fromToken,
      network: this.network
    });

    try {
      // Connect to network
      const provider = new ethers.JsonRpcProvider(this.rpcUrl);
      const wallet = new ethers.Wallet(params.privateKey, provider);
      
      console.log('🔑 Wallet created:', wallet.address);

      // Verify address matches
      if (wallet.address.toLowerCase() !== params.fromAddress.toLowerCase()) {
        throw new Error(`Address mismatch: expected ${params.fromAddress}, got ${wallet.address}`);
      }

      // Get current gas price with buffer
      console.log('💰 Getting gas price...');
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? feeData.gasPrice * BigInt(150) / BigInt(100) : BigInt(40000000000);
      
      // Create transaction
      const tx = {
        to: params.toAddress,
        value: ethers.parseEther(params.amount),
        gasLimit: BigInt(25000),
        gasPrice: gasPrice,
        data: params.memo ? ethers.hexlify(ethers.toUtf8Bytes(params.memo)) : '0x'
      };

      console.log('💰 Transaction details:', {
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasPrice: tx.gasPrice.toString(),
        hasData: tx.data !== '0x'
      });

      // Send transaction
      console.log(`📡 Sending ${params.amount} ${this.network}...`);
      const txResponse = await wallet.sendTransaction(tx);
      console.log('✍️ Transaction sent. Hash:', txResponse.hash);

      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const receipt = await txResponse.wait();
      console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

      return {
        success: true,
        txHash: txResponse.hash,
        bankWalletAddress: params.toAddress,
        memo: params.memo,
        message: `Successfully sent ${params.amount} ${this.network}`
      };

    } catch (error) {
      console.error(`💥 ${this.network} transaction error:`, error);
      return {
        success: false,
        error: 'Transaction failed',
        message: error instanceof Error ? error.message : `${this.network} transaction failed`
      };
    } finally {
      console.log(`🔗 === ${this.network} TRANSFER END ===`);
    }
  }
}