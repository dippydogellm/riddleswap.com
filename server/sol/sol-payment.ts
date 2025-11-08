import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { 
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { decryptSolanaWallet, getSolanaConnection } from './sol-wallet';

export async function sendSolanaPayment(
  handle: string,
  password: string,
  destination: string,
  amount: string,
  tokenMint?: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const { wallet } = await decryptSolanaWallet(handle, password);
    const connection = await getSolanaConnection();
    
    if (!tokenMint || tokenMint === 'SOL') {
      // SOL transfer
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(destination),
          lamports: parseFloat(amount) * LAMPORTS_PER_SOL
        })
      );
      
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet]
      );
      
      return {
        success: true,
        txHash: signature
      };
    } else {
      // SPL token transfer
      const tokenMintPubkey = new PublicKey(tokenMint);
      const destinationPubkey = new PublicKey(destination);

      // Get associated token addresses
      const senderTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        wallet.publicKey
      );

      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        destinationPubkey
      );

      // Check if recipient token account exists
      let recipientAccountExists = true;
      try {
        await getAccount(connection, recipientTokenAccount);
      } catch (error) {
        recipientAccountExists = false;
      }

      // Create transaction
      const transaction = new Transaction();

      // Add create recipient token account instruction if needed
      if (!recipientAccountExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            recipientTokenAccount,
            destinationPubkey,
            tokenMintPubkey
          )
        );
      }

      // Convert amount to raw token units (assuming provided amount is in token decimals)
      const transferAmount = Math.floor(parseFloat(amount));

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          wallet.publicKey,
          transferAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet]
      );

      return {
        success: true,
        txHash: signature
      };
    }
    
  } catch (error) {
    console.error('Payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    };
  }
}