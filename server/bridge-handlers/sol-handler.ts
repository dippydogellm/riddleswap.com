// Solana Bridge Handler - Handles SOL and SPL tokens

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { ChainHandler, ChainPaymentParams, BridgePaymentResponse, BANK_WALLETS } from './types';

export class SOLHandler implements ChainHandler {
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  getBankWallet(): string {
    return BANK_WALLETS.SOL;
  }

  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async execute(params: ChainPaymentParams): Promise<BridgePaymentResponse> {
    console.log('🔗 === SOLANA TRANSFER START ===');
    console.log('📊 Transfer Parameters:', {
      from: params.fromAddress,
      to: params.toAddress,
      amount: params.amount,
      token: params.fromToken
    });

    try {
      // Parse private key
      let keypair: Keypair;
      
      if (params.privateKey.includes(',')) {
        // Handle comma-separated format
        const keyArray = params.privateKey.split(',').map(num => parseInt(num.trim()));
        
        if (keyArray.length === 32) {
          // 32-byte seed - convert to full keypair
          keypair = Keypair.fromSeed(new Uint8Array(keyArray));
        } else if (keyArray.length === 64) {
          // Full 64-byte keypair
          keypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        } else {
          throw new Error(`Invalid Solana key length: ${keyArray.length}`);
        }
      } else {
        // Handle base58 format
        const bs58 = await import('bs58');
        const secretKey = bs58.default.decode(params.privateKey);
        keypair = Keypair.fromSecretKey(secretKey);
      }

      console.log('🔑 Wallet created:', keypair.publicKey.toString());

      // Verify address matches
      if (keypair.publicKey.toString() !== params.fromAddress) {
        throw new Error(`Address mismatch: expected ${params.fromAddress}, got ${keypair.publicKey.toString()}`);
      }

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(params.toAddress),
          lamports: Math.round(parseFloat(params.amount) * LAMPORTS_PER_SOL)
        })
      );

      // Add memo if provided
      if (params.memo) {
        transaction.add(
          new TransactionInstruction({
            keys: [],
            programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
            data: Buffer.from(params.memo, 'utf-8')
          })
        );
      }

      // Send transaction
      console.log(`📡 Sending ${params.amount} SOL...`);
      const signature = await this.connection.sendTransaction(transaction, [keypair]);
      console.log('✍️ Transaction sent. Signature:', signature);

      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const confirmation = await this.connection.confirmTransaction(signature);
      console.log('✅ Transaction confirmed');

      return {
        success: true,
        txHash: signature,
        bankWalletAddress: params.toAddress,
        memo: params.memo,
        message: `Successfully sent ${params.amount} SOL`
      };

    } catch (error) {
      console.error('💥 Solana transaction error:', error);
      return {
        success: false,
        error: 'Transaction failed',
        message: error instanceof Error ? error.message : 'Solana transaction failed'
      };
    } finally {
      console.log('🔗 === SOLANA TRANSFER END ===');
    }
  }
}