// Bridge Verification Orchestrator

import { XRPVerifier } from './xrp-verifier';
import { ETHVerifier } from './eth-verifier';
import { SOLVerifier } from './sol-verifier';
import { BTCVerifier } from './btc-verifier';
import { ChainVerifier, VerificationRequest, VerificationResponse } from './types';
import { TOKEN_CHAIN_MAP } from '../bridge-handlers/types';

export class BridgeVerificationService {
  private verifiers: Map<string, ChainVerifier>;

  constructor() {
    this.verifiers = new Map();
    this.initializeVerifiers();
  }

  private initializeVerifiers() {
    // Initialize all chain verifiers
    this.verifiers.set('XRPL', new XRPVerifier());
    this.verifiers.set('XRP', new XRPVerifier());
    this.verifiers.set('ETH', new ETHVerifier('ETH'));
    this.verifiers.set('ETHEREUM', new ETHVerifier('ETH'));
    this.verifiers.set('BNB', new ETHVerifier('BNB'));
    this.verifiers.set('MATIC', new ETHVerifier('MATIC'));
    this.verifiers.set('BASE', new ETHVerifier('BASE'));
    this.verifiers.set('SOL', new SOLVerifier());
    this.verifiers.set('SOLANA', new SOLVerifier());
    this.verifiers.set('BTC', new BTCVerifier());
    this.verifiers.set('BITCOIN', new BTCVerifier());
  }

  async verifyTransaction(
    txHash: string,
    chain: string,
    expectedMemo?: string
  ): Promise<VerificationResponse> {
    console.log('🔍 Verifying', chain, 'transaction:', txHash);
    
    // Get the appropriate verifier
    const chainKey = this.getChainKey(chain);
    const verifier = this.verifiers.get(chainKey);

    if (!verifier) {
      console.log('❌ No verifier found for chain:', chain);
      return {
        verified: false,
        message: `No verifier available for chain: ${chain}`
      };
    }

    // Perform verification
    const request: VerificationRequest = {
      txHash,
      expectedMemo,
      chain: chainKey
    };

    return await verifier.verify(request);
  }

  async getConfirmations(txHash: string, chain: string): Promise<number> {
    const chainKey = this.getChainKey(chain);
    const verifier = this.verifiers.get(chainKey);

    if (!verifier) {
      return 0;
    }

    return await verifier.getConfirmations(txHash);
  }

  private getChainKey(tokenOrChain: string): string {
    const upper = tokenOrChain.toUpperCase();
    
    // Check if it's a token that maps to a chain
    if (TOKEN_CHAIN_MAP[upper]) {
      return TOKEN_CHAIN_MAP[upper];
    }
    
    // Otherwise, assume it's already a chain identifier
    return upper;
  }
}

// Export singleton instance
export const bridgeVerificationService = new BridgeVerificationService();