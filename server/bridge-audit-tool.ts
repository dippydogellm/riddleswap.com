// CRITICAL Bridge Transaction Verification Tool
// Checks database status against actual XRPL blockchain data
import { Client as XRPLClient } from 'xrpl';
import { db } from './db';
import { bridgePayloads } from '../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

interface VerificationResult {
  transactionId: string;
  databaseStatus: string;
  xrplVerified: boolean;
  actualStatus: 'success' | 'failed' | 'not_found';
  discrepancy: boolean;
  errorDetails?: string;
}

export class BridgeAuditTool {
  private client: XRPLClient;

  constructor() {
    this.client = new XRPLClient('wss://s1.ripple.com');
  }

  async verifyTransaction(txHash: string): Promise<{ success: boolean; status: string; error?: string }> {
    try {
      await this.client.connect();
      
      const response = await this.client.request({
        command: 'tx',
        transaction: txHash
      });

      if (response.result) {
        const txResult = response.result as any;
        
        if (txResult.validated && txResult.meta) {
          // Check if transaction succeeded
          const success = txResult.meta.TransactionResult === 'tesSUCCESS';
          return {
            success,
            status: success ? 'success' : 'failed',
            error: success ? undefined : txResult.meta.TransactionResult
          };
        } else {
          return {
            success: false,
            status: 'not_validated',
            error: 'Transaction not validated'
          };
        }
      } else {
        return {
          success: false,
          status: 'not_found',
          error: 'Transaction not found on XRPL'
        };
      }
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      if (this.client.isConnected()) {
        await this.client.disconnect();
      }
    }
  }

  async auditAllBridgeTransactions(): Promise<VerificationResult[]> {
    console.log('🔍 [AUDIT] Starting comprehensive bridge transaction audit...');
    
    // Get all completed transactions with XRP transactions
    const completedTransactions = await db
      .select()
      .from(bridgePayloads)
      .where(
        and(
          eq(bridgePayloads.status, 'completed'),
          isNotNull(bridgePayloads.txhash),
          eq(bridgePayloads.fromcurrency, 'XRP')
        )
      );

    console.log(`🔍 [AUDIT] Found ${completedTransactions.length} completed XRP bridge transactions to verify`);
    
    const results: VerificationResult[] = [];
    
    for (const transaction of completedTransactions.slice(0, 10)) { // Audit first 10 for testing
      console.log(`🔍 [AUDIT] Verifying transaction: ${transaction.transaction_id}`);
      
      if (transaction.txhash) {
        const verification = await this.verifyTransaction(transaction.txhash);
        
        const result: VerificationResult = {
          transactionId: transaction.transaction_id || 'unknown',
          databaseStatus: transaction.status || 'unknown',
          xrplVerified: verification.success,
          actualStatus: verification.status as any,
          discrepancy: transaction.status === 'completed' && verification.status !== 'success',
          errorDetails: verification.error
        };

        results.push(result);
        
        if (result.discrepancy) {
          console.log(`❌ [AUDIT] DISCREPANCY FOUND: ${transaction.transaction_id}`);
          console.log(`   Database: ${result.databaseStatus} | XRPL: ${result.actualStatus}`);
          console.log(`   Error: ${result.errorDetails}`);
        }
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  async generateAuditReport(results: VerificationResult[]): Promise<string> {
    const discrepancies = results.filter(r => r.discrepancy);
    const totalVerified = results.filter(r => r.xrplVerified).length;
    
    const report = `
🔍 BRIDGE TRANSACTION AUDIT REPORT
=====================================

📊 SUMMARY:
- Total Transactions Audited: ${results.length}
- Successfully Verified: ${totalVerified}
- Discrepancies Found: ${discrepancies.length}
- Accuracy Rate: ${((totalVerified / results.length) * 100).toFixed(2)}%

🚨 DISCREPANCIES:
${discrepancies.map(d => `
   Transaction: ${d.transactionId}
   Database Status: ${d.databaseStatus}
   Actual XRPL Status: ${d.actualStatus}
   Error: ${d.errorDetails || 'N/A'}
`).join('')}

🔧 RECOMMENDATIONS:
${discrepancies.length > 0 ? `
1. Fix verification logic in bridge system
2. Update incorrect database statuses
3. Implement real-time XRPL verification
4. Add retry mechanism for failed transactions
` : `
✅ No discrepancies found in audited transactions
`}
`;

    return report;
  }
}

// Export audit function for use in routes
export async function runBridgeAudit(): Promise<string> {
  const auditTool = new BridgeAuditTool();
  const results = await auditTool.auditAllBridgeTransactions();
  return await auditTool.generateAuditReport(results);
}