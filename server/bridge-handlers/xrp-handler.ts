// XRP/XRPL Bridge Handler - Handles XRP and RDL tokens

import { Client as XRPLClient, Wallet } from 'xrpl';
import { ChainHandler, ChainPaymentParams, BridgePaymentResponse, BANK_WALLETS } from './types';

export class XRPHandler implements ChainHandler {
  private client: XRPLClient;

  constructor() {
    this.client = new XRPLClient('wss://s1.ripple.com');
  }

  getBankWallet(): string {
    return BANK_WALLETS.XRP;
  }

  validateAddress(address: string): boolean {
    return address.startsWith('r') && address.length >= 25 && address.length <= 35;
  }

  async execute(params: ChainPaymentParams): Promise<BridgePaymentResponse> {
    console.log('🔗 === XRPL TRANSFER START ===');
    console.log('📊 Transfer Parameters:', {
      from: params.fromAddress,
      to: params.toAddress,
      amount: params.amount,
      token: params.fromToken
    });

    try {
      // Connect to XRPL
      console.log('🔗 Connecting to XRPL network...');
      await this.client.connect();
      console.log('✅ Connected to XRPL');

      // Create wallet from private key
      const wallet = Wallet.fromSecret(params.privateKey);
      console.log('🔑 Wallet created:', wallet.address);

      // Verify address matches
      if (wallet.address !== params.fromAddress) {
        throw new Error(`Address mismatch: expected ${params.fromAddress}, got ${wallet.address}`);
      }

      // Generate destination tag from memo
      let destTag = 0;
      if (params.memo) {
        let hash = 0;
        for (let i = 0; i < params.memo.length; i++) {
          hash = ((hash << 5) - hash) + params.memo.charCodeAt(i);
          hash = hash & hash;
        }
        destTag = Math.abs(hash) % 4294967295;
      }

      // Create payment transaction
      const payment: any = {
        TransactionType: 'Payment',
        Account: params.fromAddress,
        Destination: params.toAddress,
        DestinationTag: destTag
      };

      // Set amount based on token type
      if (params.fromToken.toUpperCase() === 'XRP') {
        // Convert XRP to drops precisely
        const drops = this.xrpToDrops(params.amount);
        payment.Amount = drops;
        console.log(`💰 Sending ${params.amount} XRP (${drops} drops)`);
      } else if (params.fromToken.toUpperCase() === 'RDL') {
        // RDL token transfer
        payment.Amount = {
          currency: 'RDL',
          value: params.amount,
          issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9'
        };
        console.log(`💰 Sending ${params.amount} RDL tokens`);
      } else {
        throw new Error(`Unsupported XRPL token: ${params.fromToken}`);
      }

      // Add memo if provided
      if (params.memo) {
        payment.Memos = [{
          Memo: {
            MemoData: Buffer.from(params.memo).toString('hex').toUpperCase(),
            MemoType: Buffer.from('bridge').toString('hex').toUpperCase()
          }
        }];
      }

      console.log('📝 Payment object:', JSON.stringify(payment, null, 2));

      // Prepare and sign transaction
      console.log('🔧 Preparing transaction...');
      const prepared = await this.client.autofill(payment);
      
      console.log('✍️ Signing transaction...');
      const signed = wallet.sign(prepared);
      console.log('✍️ Transaction signed. Hash:', signed.hash);

      // Submit and wait for validation
      console.log('📡 Submitting transaction...');
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      // Check result
      if (result.result.meta && 
          typeof result.result.meta === 'object' && 
          'TransactionResult' in result.result.meta) {
        
        const txResult = result.result.meta.TransactionResult;
        console.log('🎯 Transaction result:', txResult);

        if (txResult === 'tesSUCCESS') {
          console.log('✅ XRPL transaction successful:', result.result.hash);
          
          await this.client.disconnect();
          
          return {
            success: true,
            txHash: result.result.hash,
            bankWalletAddress: params.toAddress,
            memo: params.memo,
            message: `Successfully sent ${params.amount} ${params.fromToken}`
          };
        }
      }

      throw new Error(`Transaction failed: ${JSON.stringify(result.result)}`);

    } catch (error) {
      console.error('💥 XRPL transaction error:', error);
      return {
        success: false,
        error: 'Transaction failed',
        message: error instanceof Error ? error.message : 'XRPL transaction failed'
      };
    } finally {
      if (this.client.isConnected()) {
        await this.client.disconnect();
      }
      console.log('🔗 === XRPL TRANSFER END ===');
    }
  }

  private xrpToDrops(xrpAmount: string): string {
    // Precise conversion without floating point errors
    const parts = xrpAmount.split('.');
    const whole = parts[0] || '0';
    const decimal = parts[1] || '0';
    
    const wholeDrops = parseInt(whole) * 1000000;
    const decimalDrops = parseInt(decimal.padEnd(6, '0').substring(0, 6));
    const totalDrops = wholeDrops + decimalDrops;
    
    console.log(`🔢 Conversion: ${xrpAmount} XRP = ${totalDrops} drops`);
    return totalDrops.toString();
  }
}