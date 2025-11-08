import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { CHAIN_CONFIGS } from '../bridge/multi-chain-bridge-routes';
import bs58 from 'bs58';

/**
 * Solana NFT Marketplace Broker Service
 * 
 * This service facilitates NFT trades on Solana using:
 * - SPL Token transfers for NFTs
 * - Native SOL for payments
 * - Broker fee collection (1.589% like XRPL/EVM)
 * - Escrow functionality
 */

export const SOLANA_BROKER_FEE_CONFIG = {
  feePercentage: 1.589,
  minimumFeeSOL: 0.01,
  
  calculateBrokerFee(salePrice: number): number {
    const feeFromPercentage = salePrice * (this.feePercentage / 100);
    return Math.max(feeFromPercentage, this.minimumFeeSOL);
  },
  
  getFeeBreakdown(salePrice: number): {
    salePrice: number;
    brokerFee: number;
    royaltyEstimate: string;
    sellerReceives: string;
  } {
    const brokerFee = this.calculateBrokerFee(salePrice);
    
    return {
      salePrice,
      brokerFee,
      royaltyEstimate: '0-10% of sale price (Metaplex royalties)',
      sellerReceives: `${(salePrice - brokerFee).toFixed(6)} SOL (minus royalty)`
    };
  }
};

export interface SolanaBrokerConfig {
  privateKey: string; // Base58 encoded private key
}

export class SolanaBrokerService {
  private keypair: Keypair;
  private connection: Connection;
  private publicKey: PublicKey;

  constructor(config: SolanaBrokerConfig) {
    // Decode base58 private key to keypair
    const secretKey = bs58.decode(config.privateKey);
    this.keypair = Keypair.fromSecretKey(secretKey);
    this.publicKey = this.keypair.publicKey;
    this.connection = new Connection(CHAIN_CONFIGS.solana.rpcUrl, 'confirmed');
    
    console.log('🏦 Solana Broker Service initialized');
    console.log(`📍 Broker Address: ${this.publicKey.toString()}`);
  }

  getAddress(): string {
    return this.publicKey.toString();
  }

  async getBalance(): Promise<{ lamports: number; sol: string }> {
    try {
      const balance = await this.connection.getBalance(this.publicKey);
      return {
        lamports: balance,
        sol: (balance / LAMPORTS_PER_SOL).toFixed(6)
      };
    } catch (error) {
      console.error('❌ Failed to fetch Solana broker balance:', error);
      throw error;
    }
  }

  /**
   * Facilitate P2P NFT transfer with broker fee
   * 
   * Process:
   * 1. Buyer sends SOL to broker
   * 2. Seller transfers NFT to buyer
   * 3. Broker sends SOL to seller (minus fee)
   */
  async facilitateP2PTransfer(
    sellerKeypair: Keypair,
    buyerAddress: string,
    nftMintAddress: string,
    priceSOL: number
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const buyerPubkey = new PublicKey(buyerAddress);
      const nftMint = new PublicKey(nftMintAddress);
      
      const brokerFee = SOLANA_BROKER_FEE_CONFIG.calculateBrokerFee(priceSOL);
      const sellerPayment = priceSOL - brokerFee;

      console.log(`🤝 [SOLANA P2P] Facilitating NFT transfer:`);
      console.log(`   Seller: ${sellerKeypair.publicKey.toString()}`);
      console.log(`   Buyer: ${buyerAddress}`);
      console.log(`   NFT Mint: ${nftMintAddress}`);
      console.log(`   Price: ${priceSOL} SOL`);
      console.log(`   Broker Fee: ${brokerFee} SOL`);

      // Step 1: Verify buyer has sent payment to broker
      const brokerBalance = await this.connection.getBalance(this.publicKey);
      const expectedPayment = Math.floor(priceSOL * LAMPORTS_PER_SOL);
      
      if (brokerBalance < expectedPayment) {
        return {
          success: false,
          error: `Insufficient payment. Buyer must send ${priceSOL} SOL to broker first`
        };
      }

      // Step 2: Get token accounts for NFT transfer
      const sellerTokenAccount = await getAssociatedTokenAddress(
        nftMint,
        sellerKeypair.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const buyerTokenAccount = await getAssociatedTokenAddress(
        nftMint,
        buyerPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Step 3: Check if buyer token account exists, create if not
      const buyerTokenAccountInfo = await this.connection.getAccountInfo(buyerTokenAccount);
      
      const transaction = new Transaction();
      
      if (!buyerTokenAccountInfo) {
        console.log('📦 Creating associated token account for buyer...');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.publicKey, // Payer (broker)
            buyerTokenAccount,
            buyerPubkey,
            nftMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Step 4: Transfer NFT from seller to buyer
      transaction.add(
        createTransferInstruction(
          sellerTokenAccount,
          buyerTokenAccount,
          sellerKeypair.publicKey,
          1, // NFTs have amount = 1
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Sign with seller
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.publicKey;
      transaction.partialSign(sellerKeypair);
      transaction.partialSign(this.keypair);

      const nftTransferSig = await this.connection.sendRawTransaction(transaction.serialize());
      await this.connection.confirmTransaction({
        signature: nftTransferSig,
        blockhash,
        lastValidBlockHeight
      });
      
      console.log(`✅ NFT transferred: ${nftTransferSig}`);

      // Step 5: Send payment to seller (minus broker fee)
      const paymentTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.publicKey,
          toPubkey: sellerKeypair.publicKey,
          lamports: Math.floor(sellerPayment * LAMPORTS_PER_SOL)
        })
      );

      const paymentSig = await sendAndConfirmTransaction(
        this.connection,
        paymentTx,
        [this.keypair]
      );
      
      console.log(`💰 Payment sent to seller: ${paymentSig}`);
      console.log(`💰 Broker fee collected: ${brokerFee} SOL`);

      return {
        success: true,
        signature: nftTransferSig
      };
    } catch (error) {
      console.error('❌ [SOLANA P2P] Transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create escrow for NFT sale
   * Buyer sends SOL to broker, broker holds until seller confirms NFT transfer
   */
  async createEscrow(
    buyerKeypair: Keypair,
    priceSOL: number
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: buyerKeypair.publicKey,
          toPubkey: this.publicKey,
          lamports: Math.floor(priceSOL * LAMPORTS_PER_SOL)
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [buyerKeypair]
      );

      console.log(`✅ Escrow created: ${signature}`);
      console.log(`💰 ${priceSOL} SOL deposited to broker`);

      return {
        success: true,
        signature
      };
    } catch (error) {
      console.error('❌ Failed to create escrow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Release escrow payment to seller
   */
  async releaseEscrow(
    sellerAddress: string,
    priceSOL: number
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const sellerPubkey = new PublicKey(sellerAddress);
      const brokerFee = SOLANA_BROKER_FEE_CONFIG.calculateBrokerFee(priceSOL);
      const sellerPayment = priceSOL - brokerFee;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.publicKey,
          toPubkey: sellerPubkey,
          lamports: Math.floor(sellerPayment * LAMPORTS_PER_SOL)
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair]
      );

      console.log(`✅ Escrow released: ${signature}`);
      console.log(`💰 ${sellerPayment} SOL sent to seller`);
      console.log(`💰 ${brokerFee} SOL broker fee collected`);

      return {
        success: true,
        signature
      };
    } catch (error) {
      console.error('❌ Failed to release escrow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

let solanaBrokerInstance: SolanaBrokerService | null = null;

export function initializeSolanaBrokerService(): SolanaBrokerService {
  const brokerKey = process.env.SOLANA_BROKER_PRIVATE_KEY;

  if (!brokerKey) {
    throw new Error('SOLANA_BROKER_PRIVATE_KEY environment variable is not set');
  }

  if (!solanaBrokerInstance) {
    solanaBrokerInstance = new SolanaBrokerService({
      privateKey: brokerKey
    });
  }

  return solanaBrokerInstance;
}

export function getSolanaBrokerService(): SolanaBrokerService {
  if (!solanaBrokerInstance) {
    return initializeSolanaBrokerService();
  }
  return solanaBrokerInstance;
}
