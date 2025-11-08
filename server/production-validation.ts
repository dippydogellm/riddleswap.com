/**
 * Production Environment Validation
 * 
 * This module validates that all critical environment variables are set
 * before allowing the application to start in production mode.
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingCritical: string[];
}

interface EnvironmentRequirement {
  name: string;
  required: boolean;
  production: boolean;
  description: string;
  validator?: (value: string) => boolean;
  defaultValue?: string;
}

// Define all environment requirements
const ENVIRONMENT_REQUIREMENTS: EnvironmentRequirement[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    production: true,
    description: 'PostgreSQL database connection string'
  },
  
  // RiddlePad Configuration
  {
    name: 'RIDDLEPAD_BANK_WALLET',
    required: false,
    production: true,
    description: 'XRPL wallet address for RiddlePad fee collection',
    validator: (value: string) => value.startsWith('r') && value.length >= 25
  },
  {
    name: 'RIDDLEPAD_COLLECTION_PRIVATE_KEY',
    required: false,
    production: true,
    description: 'Private key for RiddlePad on-chain operations (when enabled)'
  },
  {
    name: 'ONCHAIN_SETTLEMENT_ENABLED',
    required: false,
    production: false,
    description: 'Enable on-chain settlement for RiddlePad fees',
    defaultValue: 'false'
  },
  {
    name: 'FEE_ACCOUNTING_ENABLED',
    required: false,
    production: false,
    description: 'Enable fee accounting system',
    defaultValue: 'true'
  },
  
  // External API Keys
  {
    name: 'BITHOMP_API_KEY',
    required: false,
    production: true,
    description: 'Bithomp API key for XRPL data (recommended for production)'
  },
  {
    name: 'COINGECKO_API_KEY',
    required: false,
    production: false,
    description: 'CoinGecko API key for price data'
  },
  
  // RPC URLs for multi-chain support
  {
    name: 'ETHEREUM_RPC_URL',
    required: false,
    production: true,
    description: 'Ethereum RPC endpoint for EVM operations'
  },
  {
    name: 'SOLANA_RPC_URL',
    required: false,
    production: false,
    description: 'Solana RPC endpoint',
    defaultValue: 'https://api.mainnet-beta.solana.com'
  },
  {
    name: 'XRPL_RPC_URL',
    required: false,
    production: false,
    description: 'XRPL WebSocket endpoint',
    defaultValue: 'wss://s1.ripple.com'
  },
  
  // Session and Security
  {
    name: 'SESSION_SECRET',
    required: true,
    production: true,
    description: 'Secret key for session encryption',
    validator: (value: string) => value.length >= 32
  },
  {
    name: 'NODE_ENV',
    required: true,
    production: true,
    description: 'Application environment',
    validator: (value: string) => ['development', 'production', 'test'].includes(value)
  }
];

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    missingCritical: []
  };

  const isProduction = process.env.NODE_ENV === 'production';
  const onchainEnabled = process.env.ONCHAIN_SETTLEMENT_ENABLED === 'true';

  console.log(`🔍 [ENV VALIDATION] Validating environment for: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`🔍 [ENV VALIDATION] On-chain settlement: ${onchainEnabled ? 'ENABLED' : 'DISABLED'}`);

  for (const requirement of ENVIRONMENT_REQUIREMENTS) {
    const value = process.env[requirement.name];
    const hasValue = value !== undefined && value !== '';

    // Check if this variable is required
    let isRequired = requirement.required;
    
    // Special cases for conditional requirements
    if (requirement.name === 'RIDDLEPAD_BANK_WALLET' && onchainEnabled) {
      isRequired = true;
    }
    if (requirement.name === 'RIDDLEPAD_COLLECTION_PRIVATE_KEY' && onchainEnabled) {
      isRequired = true;
    }

    if (!hasValue) {
      if (isRequired) {
        result.errors.push(`Missing required environment variable: ${requirement.name} - ${requirement.description}`);
        result.missingCritical.push(requirement.name);
        result.isValid = false;
      } else if (requirement.production && isProduction) {
        result.warnings.push(`Missing recommended production variable: ${requirement.name} - ${requirement.description}`);
      } else if (requirement.defaultValue) {
        console.log(`📝 [ENV VALIDATION] Using default for ${requirement.name}: ${requirement.defaultValue}`);
      }
    } else {
      // Validate the value if a validator is provided
      if (requirement.validator && !requirement.validator(value)) {
        result.errors.push(`Invalid value for ${requirement.name}: ${requirement.description}`);
        result.isValid = false;
      } else {
        console.log(`✅ [ENV VALIDATION] ${requirement.name}: CONFIGURED`);
      }
    }
  }

  // RiddlePad-specific validation
  if (onchainEnabled) {
    if (!process.env.RIDDLEPAD_BANK_WALLET) {
      result.errors.push('RIDDLEPAD_BANK_WALLET is required when ONCHAIN_SETTLEMENT_ENABLED=true');
      result.isValid = false;
    }
    if (!process.env.RIDDLEPAD_COLLECTION_PRIVATE_KEY) {
      result.errors.push('RIDDLEPAD_COLLECTION_PRIVATE_KEY is required when ONCHAIN_SETTLEMENT_ENABLED=true');
      result.isValid = false;
    }
  }

  // Production-specific validations
  if (isProduction) {
    if (!process.env.BITHOMP_API_KEY) {
      result.warnings.push('BITHOMP_API_KEY not set - this may cause rate limiting issues in production');
    }
    if (!process.env.ETHEREUM_RPC_URL) {
      result.warnings.push('ETHEREUM_RPC_URL not set - EVM functionality will be limited');
    }
  }

  return result;
}

/**
 * Print validation results and optionally exit if critical errors exist
 */
export function handleValidationResults(result: ValidationResult, exitOnError = true): void {
  if (result.errors.length > 0) {
    console.error('❌ [ENV VALIDATION] Critical environment validation errors:');
    result.errors.forEach(error => console.error(`   - ${error}`));
    
    if (exitOnError && process.env.NODE_ENV === 'production') {
      console.error('🚨 [ENV VALIDATION] Exiting due to critical configuration errors in production');
      process.exit(1);
    }
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ [ENV VALIDATION] Environment validation warnings:');
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  if (result.isValid) {
    console.log('✅ [ENV VALIDATION] Environment validation passed');
  } else {
    console.log('❌ [ENV VALIDATION] Environment validation failed');
  }
}

/**
 * Quick check for RiddlePad readiness
 */
export function checkRiddlePadReadiness(): {
  canAcceptContributions: boolean;
  canProcessFees: boolean;
  canSettleOnChain: boolean;
  message: string;
} {
  const feeAccountingEnabled = process.env.FEE_ACCOUNTING_ENABLED !== 'false';
  const onchainEnabled = process.env.ONCHAIN_SETTLEMENT_ENABLED === 'true';
  const hasBankWallet = !!process.env.RIDDLEPAD_BANK_WALLET;
  const hasPrivateKey = !!process.env.RIDDLEPAD_COLLECTION_PRIVATE_KEY;

  const canAcceptContributions = true; // Always possible
  const canProcessFees = feeAccountingEnabled;
  const canSettleOnChain = onchainEnabled && hasBankWallet && hasPrivateKey;

  let message = '';
  if (!canProcessFees) {
    message = 'Fee processing disabled - contributions will be tracked without fees';
  } else if (!canSettleOnChain && onchainEnabled) {
    message = 'On-chain settlement requested but not properly configured';
  } else if (!canSettleOnChain) {
    message = 'Operating in fee accounting mode only - on-chain settlement disabled';
  } else {
    message = 'RiddlePad fully operational with on-chain settlement';
  }

  return {
    canAcceptContributions,
    canProcessFees,
    canSettleOnChain,
    message
  };
}

/**
 * Generate environment configuration recommendations
 */
export function generateConfigRecommendations(): string[] {
  const recommendations: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !process.env.RIDDLEPAD_BANK_WALLET) {
    recommendations.push('Set RIDDLEPAD_BANK_WALLET for production fee collection');
  }

  if (!process.env.BITHOMP_API_KEY) {
    recommendations.push('Set BITHOMP_API_KEY for better XRPL data access');
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    recommendations.push('Set a strong SESSION_SECRET (32+ characters) for secure sessions');
  }

  if (isProduction && !process.env.ETHEREUM_RPC_URL) {
    recommendations.push('Set ETHEREUM_RPC_URL for EVM chain support');
  }

  return recommendations;
}