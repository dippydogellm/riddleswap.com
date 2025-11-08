// Deployment Configuration Validator
// Ensures wallet connections work properly when deployed

interface DeploymentConfig {
  walletConnectProjectId: string;
  feeWalletEvm: string;
  connectionTimeout: number;
  oneInchApiKey?: string;
  environment: 'development' | 'production';
}

export class DeploymentValidator {
  private config: DeploymentConfig;
  
  constructor() {
    const { getWalletConnectProjectId } = require('@/lib/wallet-env');
    this.config = {
      walletConnectProjectId: getWalletConnectProjectId(),
      feeWalletEvm: import.meta.env.VITE_FEE_WALLET_EVM || '0x9211346f428628d7C84CE1338C0b51FDdf2E8461',
      connectionTimeout: parseInt(import.meta.env.VITE_WALLET_CONNECTION_TIMEOUT || '600'),
      oneInchApiKey: import.meta.env.VITE_ONEINCH_API_KEY,
      environment: import.meta.env.VITE_REPLIT_DEPLOYMENT ? 'production' : 'development'
    };
  }

  validateConfiguration(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check critical wallet connection variables
    if (!this.config.walletConnectProjectId || this.config.walletConnectProjectId === 'fa5ebbd9b00cc684a0662cd09406ed00') {
      if (this.config.environment === 'production') {
        issues.push('VITE_WALLETCONNECT_PROJECT_ID should be set to your own project ID for production');
      }
    }

    if (!this.config.feeWalletEvm) {
      issues.push('VITE_FEE_WALLET_EVM is required for DEX swap functionality');
    }

    if (this.config.connectionTimeout < 30) {
      issues.push('VITE_WALLET_CONNECTION_TIMEOUT should be at least 30 seconds');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  getConfig(): DeploymentConfig {
    return { ...this.config };
  }

  logStatus(): void {
    const validation = this.validateConfiguration();
    
    console.log('🔧 [DEPLOYMENT] Configuration Status:');
    console.log(`   Environment: ${this.config.environment}`);
    console.log(`   WalletConnect Project ID: ${this.config.walletConnectProjectId.substring(0, 8)}...`);
    console.log(`   Fee Wallet: ${this.config.feeWalletEvm}`);
    console.log(`   Connection Timeout: ${this.config.connectionTimeout}s`);
    console.log(`   1inch API Key: ${this.config.oneInchApiKey ? 'SET' : 'NOT SET'}`);
    
    if (validation.isValid) {
      console.log('✅ [DEPLOYMENT] All wallet connection requirements met');
    } else {
      console.warn('⚠️ [DEPLOYMENT] Configuration issues:');
      validation.issues.forEach(issue => console.warn(`   - ${issue}`));
    }
  }

  // Check if wallet connections should work in current environment
  isWalletConnectionReady(): boolean {
    const validation = this.validateConfiguration();
    return validation.isValid;
  }
}

export const deploymentValidator = new DeploymentValidator();

// Auto-validate on import for debugging
if (typeof window !== 'undefined') {
  deploymentValidator.logStatus();
}
