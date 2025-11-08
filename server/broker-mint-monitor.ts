import { Client, Wallet } from 'xrpl';
import { db } from './db';
import { brokerMintEscrow, nftProjects } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';

const BROKER_WALLET_SEED = process.env.BROKER_WALLET_SEED;
const BROKER_WALLET_ADDRESS = process.env.RIDDLE_BROKER_ADDRESS || process.env.BROKER_WALLET_ADDRESS || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';
// Allow multiple endpoints for resilience; prefer env override
const XRPL_ENDPOINTS: string[] = (
  process.env.XRPL_RPC_URL
    ? process.env.XRPL_RPC_URL.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        'wss://s1.ripple.com',            // mainnet
        'wss://xrplcluster.com',          // public cluster
        'wss://xrpl.ws',                  // public endpoint
        'wss://s2.ripple.com',            // backup mainnet
        'wss://xls20.rippletest.net:51233' // testnet (as last resort)
      ]
);
const XRPL_CONNECTION_TIMEOUT = Number(process.env.XRPL_CONNECTION_TIMEOUT_MS) || 15000;
const XRPL_DISABLE_MONITOR = String(process.env.XRPL_DISABLE_MINT_MONITOR || '').toLowerCase() === 'true';

// Encryption helpers
if (!process.env.SESSION_SECRET) {
  throw new Error('🔴 CRITICAL: SESSION_SECRET must be configured for secure private key decryption');
}
const ENCRYPTION_KEY = process.env.SESSION_SECRET;

function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * BROKER MINT ESCROW MONITOR
 * 
 * Monitors XRPL blockchain for mint escrow payments and automatically:
 * 1. Validates payment
 * 2. Mints NFT using appropriate credentials
 * 3. Creates 0 XRP sell offer to buyer
 * 4. Distributes payment to creator
 */

class BrokerMintMonitor {
  private client: Client | null = null;
  private wallet: Wallet | null = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private nextEndpointIndex = 0;
  private backoffMs = 3000; // start at 3s
  private readonly maxBackoffMs = 60000; // cap at 60s

  constructor() {
    if (!BROKER_WALLET_SEED) {
      throw new Error('🔴 CRITICAL: BROKER_WALLET_SEED must be configured for mint escrow automation');
    }

    this.wallet = Wallet.fromSeed(BROKER_WALLET_SEED);
    if (XRPL_DISABLE_MONITOR) {
      console.warn('⏸️  [MINT MONITOR] Disabled via XRPL_DISABLE_MINT_MONITOR=true');
      return;
    }
    this.rotateClient();
    this.startMonitoring();
  }

  private getCurrentEndpoint(): string {
    if (this.nextEndpointIndex >= XRPL_ENDPOINTS.length) this.nextEndpointIndex = 0;
    return XRPL_ENDPOINTS[this.nextEndpointIndex];
  }

  private rotateClient() {
    try {
      if (this.client) {
        this.client.removeAllListeners();
        // Don't await disconnect to avoid hanging
        this.client.disconnect().catch(() => {});
      }
    } catch {}
    const endpoint = this.getCurrentEndpoint();
    console.log(`🌐 [MINT MONITOR] Using XRPL endpoint: ${endpoint}`);
    this.client = new Client(endpoint, { connectionTimeout: XRPL_CONNECTION_TIMEOUT });
  }

  private async startMonitoring() {
    try {
      if (!this.client || !this.wallet) {
        throw new Error('Client or wallet not initialized');
      }

      await this.client.connect();
      this.isConnected = true;
      // Reset backoff upon successful connect
      this.backoffMs = 3000;

      console.log('🔍 [MINT MONITOR] Connected to XRPL');
      console.log(`📍 [MINT MONITOR] Monitoring broker wallet: ${this.wallet.classicAddress}`);

      // Start heartbeat
      this.startHeartbeat();

      // Subscribe to broker wallet transactions
      await this.client.request({
        command: 'subscribe',
        accounts: [this.wallet.classicAddress]
      });

      // Listen for transactions
      this.client.on('transaction', async (tx: any) => {
        await this.handleTransaction(tx);
      });

      // Handle disconnection
      this.client.on('disconnected', () => {
        console.log('❌ [MINT MONITOR] Disconnected from XRPL');
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('❌ [MINT MONITOR] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(async () => {
      if (this.client && this.isConnected) {
        try {
          await this.client.request({ command: 'ping' });
        } catch (error) {
          console.error('❌ [MINT MONITOR] Heartbeat failed:', error);
        }
      }
    }, 30000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Exponential backoff with jitter; rotate endpoint each attempt
    const delay = Math.min(this.backoffMs, this.maxBackoffMs);
    const jitter = Math.floor(Math.random() * 500);
    console.log(`🔄 [MINT MONITOR] Attempting to reconnect in ${(delay + jitter) / 1000}s...`);
    this.reconnectTimeout = setTimeout(() => {
      this.nextEndpointIndex = (this.nextEndpointIndex + 1) % XRPL_ENDPOINTS.length;
      this.rotateClient();
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.startMonitoring();
    }, delay + jitter);
  }

  private async handleTransaction(tx: any) {
    try {
      const startTime = Date.now();

      // Only process validated transactions
      if (!tx.validated || tx.engine_result !== 'tesSUCCESS') {
        return;
      }

      const transaction = tx.transaction;

      // Ensure transaction object exists
      if (!transaction || typeof transaction !== 'object') {
        return;
      }

      // Only process payments to broker wallet
      if (transaction.TransactionType !== 'Payment' || transaction.Destination !== this.wallet?.classicAddress) {
        return;
      }

      console.log(`💰 [MINT MONITOR] Received payment: ${transaction.hash}`);

      // Extract memo
      if (!transaction.Memos || transaction.Memos.length === 0) {
        console.log('⚠️ [MINT MONITOR] Payment has no memo, skipping');
        return;
      }

      const memoData = Buffer.from(transaction.Memos[0].Memo.MemoData, 'hex').toString('utf8');
      const memo = JSON.parse(memoData);

      // Check if this is a mint escrow payment
      if (!memo.escrowId || !memo.platformType) {
        return;
      }

      const amountDrops = parseInt(transaction.Amount);

      console.log(`🎯 [MINT MONITOR] Mint escrow payment detected: ${memo.escrowId} (${memo.platformType})`);

      // Get escrow record
      const [escrow] = await db
        .select()
        .from(brokerMintEscrow)
        .where(eq(brokerMintEscrow.id, memo.escrowId))
        .limit(1);

      if (!escrow) {
        console.log(`❌ [MINT MONITOR] Escrow ${memo.escrowId} not found`);
        return;
      }

      // Validate payment amount
      const expectedAmount = parseInt(escrow.totalAmount);
      if (amountDrops < expectedAmount) {
        console.log(`❌ [MINT MONITOR] Insufficient payment: ${amountDrops} < ${expectedAmount}`);
        await db.update(brokerMintEscrow)
          .set({
            status: 'failed',
            failureReason: `Insufficient payment: received ${amountDrops}, expected ${expectedAmount}`,
            updatedAt: new Date()
          } as any)
          .where(eq(brokerMintEscrow.id, escrow.id));
        return;
      }

      // Update escrow with payment info
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'payment_received',
          paymentTxHash: transaction.hash,
          paymentValidated: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));

      console.log(`✅ [MINT MONITOR] Payment validated for escrow ${escrow.id}`);

      // Process minting based on platform type
      if (escrow.platformType === 'external') {
        await this.processExternalMint(escrow);
      } else if (escrow.platformType === 'devtools') {
        await this.processDevToolsMint(escrow);
      }

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ [MINT MONITOR] Processed transaction in ${processingTime}ms`);

    } catch (error) {
      console.error('❌ [MINT MONITOR] Transaction processing error:', error);
    }
  }

  private async processExternalMint(escrow: any) {
    try {
      console.log(`🏭 [EXTERNAL MINT] Processing mint for escrow ${escrow.id}`);

      if (!this.client || !this.wallet) {
        throw new Error('Client or wallet not initialized');
      }

      // Decrypt issuer private key
      const issuerPrivateKey = decrypt(escrow.issuerPrivateKey);
      const issuerWallet = Wallet.fromSeed(issuerPrivateKey);

      console.log(`🔑 [EXTERNAL MINT] Using issuer wallet: ${issuerWallet.classicAddress}`);

      // Create NFTokenMint transaction
      const mintTx: any = {
        TransactionType: 'NFTokenMint',
        Account: issuerWallet.classicAddress,
        NFTokenTaxon: parseInt(escrow.taxon || '0'),
        Flags: 8, // Transferable
        URI: escrow.nftMetadataUri ? Buffer.from(escrow.nftMetadataUri).toString('hex') : undefined,
        TransferFee: 0
      };

      // Prepare transaction
      const prepared = await this.client.autofill(mintTx as any);
      const signed = issuerWallet.sign(prepared);

      // Submit transaction
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error(`Mint failed: ${result.result.meta.TransactionResult}`);
        }
      }

      // Extract NFT token ID from metadata
      const nftTokenId = this.extractNFTokenID(result.result.meta);

      if (!nftTokenId) {
        throw new Error('Failed to extract NFT token ID');
      }

      console.log(`🎨 [EXTERNAL MINT] NFT minted: ${nftTokenId}`);

      // Update escrow
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'minted',
          mintTxHash: result.result.hash,
          mintedNftId: nftTokenId,
          mintedAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));

      // Create sell offer (0 XRP) to buyer
      await this.createBuyerOffer(escrow, nftTokenId, issuerWallet.classicAddress);

      // Distribute payment to creator
      await this.distributePayment(escrow, issuerWallet.classicAddress);

    } catch (error) {
      console.error('❌ [EXTERNAL MINT] Minting error:', error);
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Minting failed',
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));
    }
  }

  private async processDevToolsMint(escrow: any) {
    try {
      console.log(`🏭 [DEVTOOLS MINT] Processing mint for escrow ${escrow.id}`);

      if (!this.client || !this.wallet) {
        throw new Error('Client or wallet not initialized');
      }

      // Get project details
      const [project] = await db
        .select()
        .from(nftProjects)
        .where(eq(nftProjects.id, escrow.projectId))
        .limit(1);

      if (!project) {
        throw new Error('Project not found');
      }

      // Use broker wallet to mint (project should have authorized broker as minter)
      console.log(`🔑 [DEVTOOLS MINT] Using broker wallet to mint for project: ${project.projectName}`);

      // Create NFTokenMint transaction
      const mintTx: any = {
        TransactionType: 'NFTokenMint',
        Account: this.wallet.classicAddress,
        Issuer: project.creatorWallet,
        NFTokenTaxon: parseInt((project.taxon || 0).toString()),
        Flags: 8, // Transferable
        URI: escrow.nftMetadataUri ? Buffer.from(escrow.nftMetadataUri).toString('hex') : undefined,
        TransferFee: parseInt((project.royaltyPercentage || '0').toString()) * 1000 // Convert % to bps
      };

      // Prepare transaction
      const prepared = await this.client.autofill(mintTx as any);
      const signed = this.wallet.sign(prepared);

      // Submit transaction
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error(`Mint failed: ${result.result.meta.TransactionResult}`);
        }
      }

      // Extract NFT token ID
      const nftTokenId = this.extractNFTokenID(result.result.meta);

      if (!nftTokenId) {
        throw new Error('Failed to extract NFT token ID');
      }

      console.log(`🎨 [DEVTOOLS MINT] NFT minted: ${nftTokenId}`);

      // Update escrow
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'minted',
          mintTxHash: result.result.hash,
          mintedNftId: nftTokenId,
          mintedAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));

      // Create sell offer (0 XRP) to buyer
      await this.createBuyerOffer(escrow, nftTokenId, this.wallet.classicAddress);

      // Distribute payment to project creator
      await this.distributePayment(escrow, project.creatorWallet);

    } catch (error) {
      console.error('❌ [DEVTOOLS MINT] Minting error:', error);
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Minting failed',
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));
    }
  }

  private async createBuyerOffer(escrow: any, nftTokenId: string, nftOwner: string) {
    try {
      if (!this.client || !this.wallet) {
        throw new Error('Client or wallet not initialized');
      }

      console.log(`📝 [MINT MONITOR] Creating 0 XRP sell offer to buyer ${escrow.buyerAddress}`);

      // Create sell offer (0 XRP) to buyer
      const offerTx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: nftOwner,
        NFTokenID: nftTokenId,
        Amount: '0', // Free transfer
        Destination: escrow.buyerAddress,
        Flags: 1 // Sell offer
      };

      // If nftOwner is not broker, we need to use issuer wallet
      let signingWallet = this.wallet;
      if (nftOwner !== this.wallet.classicAddress) {
        const issuerPrivateKey = decrypt(escrow.issuerPrivateKey);
        signingWallet = Wallet.fromSeed(issuerPrivateKey);
      }

      const prepared = await this.client.autofill(offerTx as any);
      const signed = signingWallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error(`Offer creation failed: ${result.result.meta.TransactionResult}`);
        }
      }

      // Extract offer index
      const offerIndex = this.extractOfferIndex(result.result.meta);

      console.log(`✅ [MINT MONITOR] Sell offer created: ${offerIndex}`);

      // Update escrow
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'offer_created',
          offerIndex,
          offerTxHash: result.result.hash,
          offerAmount: '0',
          offerCreatedAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));

    } catch (error) {
      console.error('❌ [MINT MONITOR] Offer creation error:', error);
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Offer creation failed',
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));
    }
  }

  private async distributePayment(escrow: any, creatorAddress: string) {
    try {
      if (!this.client || !this.wallet) {
        throw new Error('Client or wallet not initialized');
      }

      const mintCostDrops = parseInt(escrow.mintCost);
      const brokerFeeDrops = parseInt(escrow.brokerFee);

      console.log(`💸 [MINT MONITOR] Distributing ${(mintCostDrops / 1_000_000).toFixed(6)} XRP to creator ${creatorAddress}`);

      // Send mint cost to creator
      const paymentTx: any = {
        TransactionType: 'Payment',
        Account: this.wallet.classicAddress,
        Destination: creatorAddress,
        Amount: mintCostDrops.toString()
      };

      const prepared = await this.client.autofill(paymentTx as any);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error(`Payment failed: ${result.result.meta.TransactionResult}`);
        }
      }

      console.log(`✅ [MINT MONITOR] Creator payment sent: ${result.result.hash}`);
      console.log(`💰 [MINT MONITOR] Broker fee retained: ${(brokerFeeDrops / 1_000_000).toFixed(6)} XRP`);

      // Update escrow
      await db.update(brokerMintEscrow)
        .set({ 
          status: 'distributed',
          creatorPaymentTxHash: result.result.hash,
          creatorPaymentAmount: mintCostDrops.toString(),
          creatorPaidAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(brokerMintEscrow.id, escrow.id));

    } catch (error) {
      console.error('❌ [MINT MONITOR] Payment distribution error:', error);
      // Don't fail the escrow, just log the error
    }
  }

  private extractNFTokenID(meta: any): string | null {
    try {
      if (meta.AffectedNodes) {
        for (const node of meta.AffectedNodes) {
          if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
            const nfts = node.CreatedNode.NewFields?.NFTokens;
            if (nfts && nfts.length > 0) {
              return nfts[0].NFToken.NFTokenID;
            }
          }
          if (node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
            const nfts = node.ModifiedNode.FinalFields?.NFTokens;
            if (nfts && nfts.length > 0) {
              return nfts[nfts.length - 1].NFToken.NFTokenID;
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting NFTokenID:', error);
      return null;
    }
  }

  private extractOfferIndex(meta: any): string | null {
    try {
      if (meta.AffectedNodes) {
        for (const node of meta.AffectedNodes) {
          if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
            return node.CreatedNode.LedgerIndex;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting offer index:', error);
      return null;
    }
  }

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.client) {
      this.client.disconnect().catch(() => {});
    }
  }
}

// Initialize monitor
let mintMonitor: BrokerMintMonitor | null = null;

export function startBrokerMintMonitor() {
  if (XRPL_DISABLE_MONITOR) {
    console.warn('⏸️  [MINT MONITOR] Not starting (disabled by env)');
    return null;
  }
  if (!mintMonitor) {
    try {
      mintMonitor = new BrokerMintMonitor();
    } catch (e) {
      console.error('❌ [MINT MONITOR] Failed to initialize:', e);
      mintMonitor = null;
    }
  }
  return mintMonitor;
}

export function stopBrokerMintMonitor() {
  if (mintMonitor) {
    mintMonitor.stop();
    mintMonitor = null;
  }
}
