import { Client } from 'xrpl';
import { swapAnnouncementService } from './swap-announcement-service';
import { db } from './db';
import { eq } from 'drizzle-orm';

/**
 * XRPL Swap Monitor
 * Monitors XRPL for RDL token swaps and triggers announcements
 */
class SwapMonitor {
  private client: Client | null = null;
  private isMonitoring = false;
  private lastLedgerIndex: number | null = null;
  
  // RDL Token issuer on XRPL
  private readonly RDL_ISSUER = 'rMD8GvvdEYpYDFVQrMQqLBqiHWd8KE97fY'; // RiddleSwap RDL issuer
  private readonly RDL_CURRENCY = 'RDL';

  constructor() {
    console.log('📊 [SWAP-MONITOR] Initializing swap monitor...');
  }

  /**
   * Start monitoring XRPL for swaps
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ [SWAP-MONITOR] Monitor already running');
      return;
    }

    try {
      console.log('🔌 [SWAP-MONITOR] Connecting to XRPL...');
      this.client = new Client('wss://xrplcluster.com');
      await this.client.connect();
      
      console.log('✅ [SWAP-MONITOR] Connected to XRPL');
      this.isMonitoring = true;

      // Start monitoring
      this.monitorSwaps();
    } catch (error: any) {
      console.error('❌ [SWAP-MONITOR] Failed to start:', error.message);
      this.isMonitoring = false;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    console.log('🛑 [SWAP-MONITOR] Stopping monitor...');
    this.isMonitoring = false;
    
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
    }
    
    console.log('✅ [SWAP-MONITOR] Monitor stopped');
  }

  /**
   * Monitor XRPL for RDL swaps
   */
  private async monitorSwaps(): Promise<void> {
    if (!this.client || !this.isMonitoring) {
      return;
    }

    try {
      // Get current ledger index
      const ledgerInfo = await this.client.request({
        command: 'ledger',
        ledger_index: 'validated',
      });

      const currentLedger = ledgerInfo.result.ledger_index;

      // Initialize or update last ledger
      if (!this.lastLedgerIndex) {
        this.lastLedgerIndex = currentLedger - 10; // Check last 10 ledgers on first run
      }

      // Scan ledgers from last checked to current
      for (let ledgerIndex = this.lastLedgerIndex + 1; ledgerIndex <= currentLedger; ledgerIndex++) {
        await this.scanLedger(ledgerIndex);
      }

      this.lastLedgerIndex = currentLedger;

    } catch (error: any) {
      console.error('❌ [SWAP-MONITOR] Error monitoring swaps:', error.message);
    }

    // Schedule next check (every 10 seconds)
    if (this.isMonitoring) {
      setTimeout(() => this.monitorSwaps(), 10000);
    }
  }

  /**
   * Scan a specific ledger for RDL swaps
   */
  private async scanLedger(ledgerIndex: number): Promise<void> {
    if (!this.client) return;

    try {
      const ledger = await this.client.request({
        command: 'ledger',
        ledger_index: ledgerIndex,
        transactions: true,
        expand: true,
      });

      const transactions = ledger.result.ledger.transactions;
      
      if (!transactions || !Array.isArray(transactions)) {
        return;
      }

      // Process each transaction
      // When expand: true, XRPL returns { tx_json, meta } objects
      for (const txWrapper of transactions) {
        if (typeof txWrapper === 'object' && txWrapper !== null) {
          const tx = (txWrapper as any).tx_json || txWrapper;
          if (tx) {
            await this.processTransaction(tx);
          }
        }
      }

    } catch (error: any) {
      // Silently skip errors (ledger might not be available yet)
    }
  }

  /**
   * Process a transaction looking for RDL swaps
   */
  private async processTransaction(tx: any): Promise<void> {
    try {
      // Look for Payment or OfferCreate transactions involving RDL
      if (tx.TransactionType !== 'Payment' && tx.TransactionType !== 'OfferCreate') {
        return;
      }

      // Check if transaction involves RDL token
      const involvesRDL = this.checkInvolvesRDL(tx);
      
      if (!involvesRDL) {
        return;
      }

      // Extract swap details
      const swapData = await this.extractSwapData(tx);
      
      if (swapData) {
        console.log(`💱 [SWAP-MONITOR] Detected ${swapData.swapType} swap: ${swapData.amountOut} ${swapData.tokenOut}`);
        
        // Process through announcement service
        await swapAnnouncementService.processSwap(swapData);
      }

    } catch (error: any) {
      console.error('❌ [SWAP-MONITOR] Error processing transaction:', error.message);
    }
  }

  /**
   * Check if transaction involves RDL
   * Must match BOTH currency code AND issuer address
   */
  private checkInvolvesRDL(tx: any): boolean {
    // Check Amount field
    if (typeof tx.Amount === 'object' && 
        tx.Amount.currency === this.RDL_CURRENCY &&
        tx.Amount.issuer === this.RDL_ISSUER) {
      return true;
    }

    // Check SendMax field (for cross-currency payments)
    if (typeof tx.SendMax === 'object' && 
        tx.SendMax.currency === this.RDL_CURRENCY &&
        tx.SendMax.issuer === this.RDL_ISSUER) {
      return true;
    }

    // Check TakerGets and TakerPays for OfferCreate
    if (typeof tx.TakerGets === 'object' && 
        tx.TakerGets.currency === this.RDL_CURRENCY &&
        tx.TakerGets.issuer === this.RDL_ISSUER) {
      return true;
    }
    
    if (typeof tx.TakerPays === 'object' && 
        tx.TakerPays.currency === this.RDL_CURRENCY &&
        tx.TakerPays.issuer === this.RDL_ISSUER) {
      return true;
    }

    return false;
  }

  /**
   * Extract swap data from transaction
   */
  private async extractSwapData(tx: any): Promise<any> {
    try {
      let tokenIn = '';
      let tokenOut = '';
      let amountIn = '0';
      let amountOut = '0';
      let swapType: 'buy' | 'sell' = 'buy';

      // For Payment transactions
      if (tx.TransactionType === 'Payment') {
        const amount = tx.Amount;
        const sendMax = tx.SendMax || amount;

        // Determine what was sent and received
        if (typeof amount === 'object' && amount.currency === this.RDL_CURRENCY) {
          // Receiving RDL = BUY
          tokenOut = 'RDL';
          amountOut = amount.value;
          swapType = 'buy';
          
          if (typeof sendMax === 'string') {
            tokenIn = 'XRP';
            amountIn = (parseInt(sendMax) / 1000000).toString(); // Convert drops to XRP
          } else {
            tokenIn = sendMax.currency;
            amountIn = sendMax.value;
          }
        } else if (typeof sendMax === 'object' && sendMax.currency === this.RDL_CURRENCY) {
          // Sending RDL = SELL
          tokenIn = 'RDL';
          amountIn = sendMax.value;
          swapType = 'sell';
          
          if (typeof amount === 'string') {
            tokenOut = 'XRP';
            amountOut = (parseInt(amount) / 1000000).toString();
          } else {
            tokenOut = amount.currency;
            amountOut = amount.value;
          }
        }
      }

      // For OfferCreate transactions
      if (tx.TransactionType === 'OfferCreate') {
        const takerGets = tx.TakerGets;
        const takerPays = tx.TakerPays;

        if (typeof takerGets === 'object' && takerGets.currency === this.RDL_CURRENCY) {
          // Offering RDL = SELL
          tokenIn = 'RDL';
          amountIn = takerGets.value;
          swapType = 'sell';
          
          if (typeof takerPays === 'string') {
            tokenOut = 'XRP';
            amountOut = (parseInt(takerPays) / 1000000).toString();
          } else {
            tokenOut = takerPays.currency;
            amountOut = takerPays.value;
          }
        } else if (typeof takerPays === 'object' && takerPays.currency === this.RDL_CURRENCY) {
          // Requesting RDL = BUY
          tokenOut = 'RDL';
          amountOut = takerPays.value;
          swapType = 'buy';
          
          if (typeof takerGets === 'string') {
            tokenIn = 'XRP';
            amountIn = (parseInt(takerGets) / 1000000).toString();
          } else {
            tokenIn = takerGets.currency;
            amountIn = takerGets.value;
          }
        }
      }

      // Calculate USD value (rough estimate based on XRP)
      let usdValue: number | undefined;
      
      if (tokenIn === 'XRP' || tokenOut === 'XRP') {
        const xrpAmount = tokenIn === 'XRP' ? parseFloat(amountIn) : parseFloat(amountOut);
        const xrpPrice = 2.5; // Rough estimate, ideally fetch from API
        usdValue = xrpAmount * xrpPrice;
      }

      // Get trader handle if available
      const traderAddress = tx.Account;
      const traderHandle = await this.getTraderHandle(traderAddress);

      return {
        txHash: tx.hash,
        chain: 'xrpl',
        swapType,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        usdValue,
        traderAddress,
        traderHandle,
        timestamp: new Date(tx.date ? (tx.date + 946684800) * 1000 : Date.now()), // Ripple epoch to Unix
      };

    } catch (error: any) {
      console.error('❌ [SWAP-MONITOR] Error extracting swap data:', error.message);
      return null;
    }
  }

  /**
   * Get trader's RiddleHandle if they have one
   * Note: RiddleHandle integration can be added later
   */
  private async getTraderHandle(address: string): Promise<string | undefined> {
    // TODO: Add RiddleHandle lookup once the handle registry is available
    // For now, return undefined - announcements will still work without handles
    return undefined;
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      isConnected: this.client?.isConnected() || false,
      lastLedgerIndex: this.lastLedgerIndex,
    };
  }
}

export const swapMonitor = new SwapMonitor();
