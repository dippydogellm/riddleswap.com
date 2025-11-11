// EMERGENCY Bridge Audit - Check ALL transactions for failed XRP with successful payouts
import { Client as XRPLClient } from 'xrpl';
import { db } from './db';
import { bridge_payloads } from '../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

export interface CriticalDiscrepancy {
  transactionId: string;
  xrpAmount: string;
  rdlAmount: string;
  xrpStatus: string;
  rdlStatus: string;
  xrpHash: string;
  rdlHash: string;
  financially_compromised: boolean;
}

export class EmergencyBridgeAudit {
  private client: XRPLClient;
  private discrepancies: CriticalDiscrepancy[] = [];

  constructor() {
    this.client = new XRPLClient('wss://s1.ripple.com');
  }

  async checkXRPLTransaction(txHash: string): Promise<{ success: boolean; status: string }> {
    try {
      await this.client.connect();
      
      const response = await this.client.request({
        command: 'tx',
        transaction: txHash
      });

      if (response.result?.meta) {
        const result = (response.result as any).meta.TransactionResult;
        return {
          success: result === 'tesSUCCESS',
          status: result
        };
      }
      
      return { success: false, status: 'not_found' };
    } catch (error) {
      return { success: false, status: 'error' };
    } finally {
      if (this.client.isConnected()) {
        await this.client.disconnect();
      }
    }
  }

  async auditCriticalTransactions(): Promise<void> {
    console.log('🚨 [EMERGENCY AUDIT] Starting critical bridge transaction audit...');
    
    // Get ALL completed XRP transactions with both hashes
    const suspiciousTransactions = await db
      .select()
      .from(bridge_payloads)
      .where(
        and(
          eq(bridge_payloads.status, 'completed'),
          eq(bridge_payloads.fromCurrency, 'XRP'), // corrected field name
          isNotNull(bridge_payloads.txHash),        // corrected field name
          isNotNull(bridge_payloads.step3TxHash)    // corrected field name
        )
      )
      .limit(50); // Audit first 50 for immediate assessment

    console.log(`🚨 [EMERGENCY AUDIT] Checking ${suspiciousTransactions.length} transactions...`);
    
    for (const transaction of suspiciousTransactions) {
      console.log(`🔍 Checking transaction: ${transaction.transaction_id}`);
      
  if (transaction.txHash && transaction.step3TxHash) {
        // Check XRP transaction status
  const xrpCheck = await this.checkXRPLTransaction(transaction.txHash);
        // Check RDL transaction status  
  const rdlCheck = await this.checkXRPLTransaction(transaction.step3TxHash);
        
        // Critical discrepancy: XRP failed but RDL succeeded
        if (!xrpCheck.success && rdlCheck.success) {
          const discrepancy: CriticalDiscrepancy = {
            transactionId: transaction.transaction_id || 'unknown',
            xrpAmount: transaction.amount?.toString() || '0',
            rdlAmount: transaction.outputAmount?.toString() || '0',
            xrpStatus: xrpCheck.status,
            rdlStatus: rdlCheck.status,
            xrpHash: transaction.txHash,
            rdlHash: transaction.step3TxHash,
            financially_compromised: true
          };
          
          this.discrepancies.push(discrepancy);
          
          console.log(`❌ CRITICAL DISCREPANCY: ${transaction.transaction_id}`);
          console.log(`   XRP: ${xrpCheck.status} | RDL: ${rdlCheck.status}`);
          console.log(`   Amount: ${transaction.amount} XRP → ${transaction.outputAmount} RDL`);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  generateEmergencyReport(): string {
    const totalCompromised = this.discrepancies.length;
    const totalXRPLost = this.discrepancies.reduce((sum, d) => sum + parseFloat(d.xrpAmount), 0);
    const totalRDLGiven = this.discrepancies.reduce((sum, d) => sum + parseFloat(d.rdlAmount), 0);

    return `
🚨 EMERGENCY BRIDGE AUDIT REPORT
================================

💥 CRITICAL SECURITY BREACH DETECTED!

📊 FINANCIAL DAMAGE:
- Compromised Transactions: ${totalCompromised}
- XRP Not Received: ${totalXRPLost.toFixed(2)} XRP
- RDL Tokens Given Away: ${totalRDLGiven.toLocaleString()} RDL
- Estimated Loss: $${(totalXRPLost * 3.08).toFixed(2)} USD equivalent

🚨 COMPROMISED TRANSACTIONS:
${this.discrepancies.map(d => `
Transaction: ${d.transactionId}
├─ XRP: ${d.xrpAmount} (Status: ${d.xrpStatus})
├─ RDL: ${d.rdlAmount} (Status: ${d.rdlStatus})
└─ Impact: FREE TOKENS GIVEN AWAY
`).join('')}

⚠️ IMMEDIATE ACTIONS REQUIRED:
1. STOP all bridge operations immediately
2. Fix verification logic before any new transactions
3. Consider reversing fraudulent RDL payouts
4. Implement proper XRPL transaction verification
5. Audit ALL bridge transactions in database

🔧 ROOT CAUSE:
Bridge system not properly verifying XRPL transaction success before issuing tokens.
`;
  }
}

// Export emergency audit function
export async function runEmergencyAudit(): Promise<string> {
  const audit = new EmergencyBridgeAudit();
  await audit.auditCriticalTransactions();
  return audit.generateEmergencyReport();
}