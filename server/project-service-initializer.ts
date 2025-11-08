/**
 * Enhanced Project Service Initializer
 * 
 * Handles initialization of all relevant services when a project is claimed.
 * This includes NFT marketplace integration, collection tracking, price monitoring,
 * and wallet linking preparation.
 * 
 * Enhanced with:
 * - Comprehensive error handling and retry mechanisms
 * - Detailed logging and monitoring
 * - Idempotency checks to prevent duplicate initialization
 * - Rollback mechanisms for failed initialization
 * - Validation and testing capabilities
 */

import { storage } from "./storage";
import { getBithompCollection } from "./bithomp-api-v2";

interface ServiceInitializationResult {
  success: boolean;
  initializedServices: string[];
  errors: string[];
  warnings: string[];
  retryAttempts: Record<string, number>;
  rollbackPerformed: boolean;
  validationResults: ValidationResult[];
  executionTime: number;
  timestamp: string;
}

interface ValidationResult {
  service: string;
  isValid: boolean;
  validationErrors: string[];
  checks: Record<string, boolean>;
}

interface ServiceRetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

export interface ProjectServiceConfig {
  projectId: string;
  issuerWallet: string;
  taxon?: number;
  chain: string;
  projectType: 'token' | 'nft';
}

/**
 * Initialize all relevant services for a claimed project with enhanced error handling
 */
export async function initializeProjectServices(config: ProjectServiceConfig): Promise<ServiceInitializationResult> {
  const startTime = Date.now();
  const result: ServiceInitializationResult = {
    success: false,
    initializedServices: [],
    errors: [],
    warnings: [],
    retryAttempts: {},
    rollbackPerformed: false,
    validationResults: [],
    executionTime: 0,
    timestamp: new Date().toISOString()
  };

  // Check for duplicate initialization (idempotency)
  if (await checkExistingInitialization(config.projectId)) {
    result.warnings.push('Services already initialized - performing validation check');
    const validation = await validateExistingServices(config.projectId);
    result.validationResults = validation;
    
    if (validation.every(v => v.isValid)) {
      result.success = true;
      result.initializedServices = validation.map(v => v.service);
      result.executionTime = Date.now() - startTime;
      return result;
    } else {
      result.warnings.push('Existing services validation failed - reinitializing');
    }
  }

  try {
    console.log(`🚀 Initializing services for project ${config.projectId}...`);

    // Initialize core services based on project type
    if (config.projectType === 'nft') {
      await initializeNFTServices(config, result);
    } else {
      await initializeTokenServices(config, result);
    }

    // Initialize common services for all projects
    await initializeCommonServices(config, result);

    // Initialize wallet linking
    await initializeWalletLinking(config, result);

    // Initialize monitoring and tracking
    await initializeMonitoring(config, result);

    // Validate all initialized services
    console.log(`🔍 Validating initialized services for project ${config.projectId}...`);
    const validationResults = await validateInitializedServices(config.projectId, result.initializedServices);
    result.validationResults = validationResults;
    
    // Check if validation passed
    const validationPassed = validationResults.every(v => v.isValid);
    if (!validationPassed) {
      const failedServices = validationResults.filter(v => !v.isValid).map(v => v.service);
      result.errors.push(`Service validation failed for: ${failedServices.join(', ')}`);
      
      // Attempt rollback for failed services
      console.log(`🔄 Attempting rollback for failed services: ${failedServices.join(', ')}`);
      await performServiceRollback(config.projectId, failedServices);
      result.rollbackPerformed = true;
    }

    result.success = result.errors.length === 0 && validationPassed;
    result.executionTime = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ Successfully initialized and validated ${result.initializedServices.length} services for project ${config.projectId} (${result.executionTime}ms)`);
    } else {
      console.log(`⚠️ Project initialization completed with ${result.errors.length} errors (${result.executionTime}ms)`);
      // Log detailed error information
      await logServiceInitializationError(config, result);
    }

  } catch (error) {
    console.error(`❌ Failed to initialize services for project ${config.projectId}:`, error);
    result.errors.push(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.executionTime = Date.now() - startTime;
    await logServiceInitializationError(config, result);
  }

  return result;
}

/**
 * Initialize NFT-specific services
 */
async function initializeNFTServices(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Enable NFT marketplace integration
    await enableProjectService(config.projectId, 'nft_marketplace', true);
    result.initializedServices.push('nft_marketplace');

    // Enable NFT collection tracking
    await enableProjectService(config.projectId, 'collection_tracking', true);
    result.initializedServices.push('collection_tracking');

    // Enable NFT offers system
    await enableProjectService(config.projectId, 'nft_offers', true);
    result.initializedServices.push('nft_offers');

    // Enable NFT analytics
    await enableProjectService(config.projectId, 'nft_analytics', true);
    result.initializedServices.push('nft_analytics');

    // For XRPL projects, enable XRPL-specific features
    if (config.chain === 'xrp' || config.chain === 'xrpl') {
      await enableProjectService(config.projectId, 'xrpl_nft_integration', true);
      result.initializedServices.push('xrpl_nft_integration');
    }

    console.log(`🎨 NFT services initialized for project ${config.projectId}`);

  } catch (error) {
    const errorMsg = `Failed to initialize NFT services: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Initialize token-specific services
 */
async function initializeTokenServices(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Enable token trading
    await enableProjectService(config.projectId, 'token_trading', true);
    result.initializedServices.push('token_trading');

    // Enable token analytics
    await enableProjectService(config.projectId, 'token_analytics', true);
    result.initializedServices.push('token_analytics');

    // Enable price monitoring
    await enableProjectService(config.projectId, 'price_monitoring', true);
    result.initializedServices.push('price_monitoring');

    console.log(`🪙 Token services initialized for project ${config.projectId}`);

  } catch (error) {
    const errorMsg = `Failed to initialize token services: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Initialize common services for all projects
 */
async function initializeCommonServices(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Enable API access
    await enableProjectService(config.projectId, 'api_access', true);
    result.initializedServices.push('api_access');

    // Enable webhooks
    await enableProjectService(config.projectId, 'webhooks', true);
    result.initializedServices.push('webhooks');

    // Enable data exports
    await enableProjectService(config.projectId, 'data_exports', true);
    result.initializedServices.push('data_exports');

    // Enable notifications
    await enableProjectService(config.projectId, 'notifications', true);
    result.initializedServices.push('notifications');

    console.log(`🔧 Common services initialized for project ${config.projectId}`);

  } catch (error) {
    const errorMsg = `Failed to initialize common services: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Initialize wallet linking capabilities
 */
async function initializeWalletLinking(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Create initial wallet link for the issuer/owner
    const existingLink = await storage.getWalletProjectLinkByWalletAndProject(config.issuerWallet, config.projectId);
    
    if (!existingLink) {
      await storage.createWalletProjectLink({
        walletAddress: config.issuerWallet,
        projectId: config.projectId,
        chain: config.chain,
        linkType: 'issuer',
        isActive: true
      });
      result.initializedServices.push('issuer_wallet_link');
      console.log(`🔗 Issuer wallet link created for ${config.issuerWallet}`);
    } else {
      result.warnings.push('Issuer wallet link already exists');
    }

    // Enable wallet management service
    await enableProjectService(config.projectId, 'wallet_management', true);
    result.initializedServices.push('wallet_management');

  } catch (error) {
    const errorMsg = `Failed to initialize wallet linking: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Initialize monitoring and tracking services
 */
async function initializeMonitoring(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Enable usage tracking
    await enableProjectService(config.projectId, 'usage_tracking', true);
    result.initializedServices.push('usage_tracking');

    // Enable performance monitoring
    await enableProjectService(config.projectId, 'performance_monitoring', true);
    result.initializedServices.push('performance_monitoring');

    // Enable error tracking
    await enableProjectService(config.projectId, 'error_tracking', true);
    result.initializedServices.push('error_tracking');

    // For NFT projects, enable collection monitoring
    if (config.projectType === 'nft' && config.taxon !== undefined) {
      await enableProjectService(config.projectId, 'collection_monitoring', true);
      result.initializedServices.push('collection_monitoring');
    }

    console.log(`📊 Monitoring services initialized for project ${config.projectId}`);

  } catch (error) {
    const errorMsg = `Failed to initialize monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Enable a specific service for a project with retry logic
 */
async function enableProjectService(projectId: string, serviceName: string, enabled: boolean): Promise<void> {
  const retryConfig: ServiceRetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      await storage.toggleProjectService(projectId, serviceName, enabled);
      console.log(`🔧 ${enabled ? 'Enabled' : 'Disabled'} ${serviceName} for project ${projectId}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`⚠️ Attempt ${attempt + 1} failed for ${serviceName}: ${lastError.message}`);
      
      if (attempt < retryConfig.maxRetries) {
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
        console.log(`⏳ Retrying ${serviceName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ Failed to toggle ${serviceName} for project ${projectId} after ${retryConfig.maxRetries + 1} attempts`);
  throw lastError || new Error(`Failed to ${enabled ? 'enable' : 'disable'} ${serviceName}`);
}

/**
 * Initialize project-specific configurations
 */
export async function initializeProjectConfigurations(config: ProjectServiceConfig): Promise<ServiceInitializationResult> {
  const result: ServiceInitializationResult = {
    success: false,
    initializedServices: [],
    errors: [],
    warnings: []
  };

  try {
    console.log(`⚙️ Initializing configurations for project ${config.projectId}...`);

    // Initialize chain configurations
    await initializeChainConfiguration(config, result);

    // Initialize API configurations
    await initializeAPIConfiguration(config, result);

    // Initialize monitoring configurations
    await initializeMonitoringConfiguration(config, result);

    result.success = result.errors.length === 0;

  } catch (error) {
    console.error(`❌ Failed to initialize configurations for project ${config.projectId}:`, error);
    result.errors.push(`Configuration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Initialize chain-specific configuration
 */
async function initializeChainConfiguration(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Check if chain configuration already exists
    const existingConfig = await storage.getChainConfigurationByProject(config.projectId, config.chain);
    
    if (!existingConfig) {
      const chainConfig = {
        projectId: config.projectId,
        chainId: config.chain,
        networkType: 'mainnet' as const,
        rpcEndpoints: getDefaultRPCEndpoints(config.chain),
        contractAddresses: {},
        monitoringEnabled: true,
        alertsEnabled: true
      };

      await storage.createChainConfiguration(chainConfig);
      result.initializedServices.push(`${config.chain}_chain_config`);
      console.log(`⛓️ Chain configuration created for ${config.chain}`);
    } else {
      result.warnings.push(`Chain configuration for ${config.chain} already exists`);
    }

  } catch (error) {
    const errorMsg = `Failed to initialize chain configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Initialize API configuration
 */
async function initializeAPIConfiguration(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    // Set up basic API configuration
    const apiConfig = {
      rateLimits: getDefaultRateLimits(config.projectType),
      endpoints: getDefaultEndpoints(config.projectType),
      authentication: {
        required: true,
        methods: ['api_key', 'signature']
      }
    };

    // Store API configuration in project
    await storage.updateDevtoolsProject(config.projectId, {
      chainConfigurations: {
        [config.chain]: {
          apiConfig: apiConfig
        }
      }
    });

    result.initializedServices.push('api_configuration');
    console.log(`🔌 API configuration initialized for project ${config.projectId}`);

  } catch (error) {
    const errorMsg = `Failed to initialize API configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Initialize monitoring configuration
 */
async function initializeMonitoringConfiguration(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  try {
    const monitoringConfig = {
      enabled: true,
      alertThresholds: {
        errorRate: 0.05, // 5% error rate
        responseTime: 2000, // 2 seconds
        requestVolume: 1000 // requests per minute
      },
      notifications: {
        email: true,
        webhook: true,
        dashboard: true
      }
    };

    // Store monitoring configuration
    await storage.updateDevtoolsProject(config.projectId, {
      chainConfigurations: {
        [config.chain]: {
          monitoringConfig: monitoringConfig
        }
      }
    });

    result.initializedServices.push('monitoring_configuration');
    console.log(`📊 Monitoring configuration initialized for project ${config.projectId}`);

  } catch (error) {
    const errorMsg = `Failed to initialize monitoring configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}

/**
 * Get default RPC endpoints for a chain
 */
function getDefaultRPCEndpoints(chain: string): string[] {
  const endpoints: Record<string, string[]> = {
    'xrp': ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/'],
    'xrpl': ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/'],
    'ethereum': ['https://cloudflare-eth.com/', 'https://ethereum.publicnode.com'],
    'solana': ['https://api.mainnet-beta.solana.com'],
    'bitcoin': ['https://blockstream.info/api'],
    'base': ['https://mainnet.base.org'],
    'arbitrum': ['https://arb1.arbitrum.io/rpc']
  };

  return endpoints[chain.toLowerCase()] || [];
}

/**
 * Get default rate limits based on project type
 */
function getDefaultRateLimits(projectType: 'token' | 'nft'): Record<string, number> {
  return {
    requestsPerMinute: projectType === 'nft' ? 100 : 60,
    requestsPerHour: projectType === 'nft' ? 5000 : 3000,
    requestsPerDay: projectType === 'nft' ? 100000 : 50000
  };
}

/**
 * Get default API endpoints based on project type
 */
function getDefaultEndpoints(projectType: 'token' | 'nft'): string[] {
  if (projectType === 'nft') {
    return [
      '/api/nft/collection',
      '/api/nft/tokens',
      '/api/nft/offers',
      '/api/nft/analytics'
    ];
  } else {
    return [
      '/api/token/info',
      '/api/token/price',
      '/api/token/analytics'
    ];
  }
}

/**
 * Check if services are already initialized for idempotency
 */
async function checkExistingInitialization(projectId: string): Promise<boolean> {
  try {
    const services = await storage.getProjectServices(projectId);
    return services.length > 0;
  } catch (error) {
    console.warn(`⚠️ Could not check existing services for project ${projectId}:`, error);
    return false;
  }
}

/**
 * Validate existing services for a project
 */
async function validateExistingServices(projectId: string): Promise<ValidationResult[]> {
  const services = await storage.getProjectServices(projectId);
  const results: ValidationResult[] = [];
  
  for (const service of services) {
    const validation = await validateSingleService(projectId, service.service);
    results.push(validation);
  }
  
  return results;
}

/**
 * Validate newly initialized services
 */
async function validateInitializedServices(projectId: string, serviceNames: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  for (const serviceName of serviceNames) {
    const validation = await validateSingleService(projectId, serviceName);
    results.push(validation);
  }
  
  return results;
}

/**
 * Validate a single service
 */
async function validateSingleService(projectId: string, serviceName: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    service: serviceName,
    isValid: true,
    validationErrors: [],
    checks: {}
  };

  try {
    // Check if service exists in database
    const serviceRecord = await storage.getProjectServiceByType(projectId, serviceName);
    result.checks.serviceExists = !!serviceRecord;
    result.checks.serviceEnabled = serviceRecord?.enabled || false;
    
    if (!serviceRecord) {
      result.isValid = false;
      result.validationErrors.push(`Service ${serviceName} not found in database`);
      return result;
    }

    if (!serviceRecord.enabled) {
      result.isValid = false;
      result.validationErrors.push(`Service ${serviceName} is disabled`);
    }

    // Service-specific validation
    switch (serviceName) {
      case 'nft_marketplace':
        result.checks.nftMarketplaceConfig = await validateNFTMarketplaceConfig(projectId);
        break;
      case 'wallet_management':
        result.checks.walletLinks = await validateWalletLinks(projectId);
        break;
      case 'api_access':
        result.checks.apiConfiguration = await validateAPIConfiguration(projectId);
        break;
      case 'xrpl_nft_integration':
        result.checks.xrplIntegration = await validateXRPLIntegration(projectId);
        break;
      default:
        result.checks.basicValidation = true;
    }

    // Check if any specific validation failed
    const failedChecks = Object.entries(result.checks).filter(([_, passed]) => !passed);
    if (failedChecks.length > 0) {
      result.isValid = false;
      result.validationErrors.push(`Failed checks: ${failedChecks.map(([check]) => check).join(', ')}`);
    }

  } catch (error) {
    result.isValid = false;
    result.validationErrors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.checks.validationError = true;
  }

  return result;
}

/**
 * Validate NFT Marketplace configuration
 */
async function validateNFTMarketplaceConfig(projectId: string): Promise<boolean> {
  try {
    // Check if project has NFT configuration
    const project = await storage.getDevtoolsProject(projectId);
    return !!(project && project.nft_token_taxon !== null);
  } catch {
    return false;
  }
}

/**
 * Validate wallet links
 */
async function validateWalletLinks(projectId: string): Promise<boolean> {
  try {
    const links = await storage.getWalletProjectLinksByProject(projectId);
    return links.length > 0 && links.some(link => link.linkType === 'issuer');
  } catch {
    return false;
  }
}

/**
 * Validate API configuration
 */
async function validateAPIConfiguration(projectId: string): Promise<boolean> {
  try {
    const project = await storage.getDevtoolsProject(projectId);
    return !!(project && project.chainConfigurations);
  } catch {
    return false;
  }
}

/**
 * Validate XRPL integration
 */
async function validateXRPLIntegration(projectId: string): Promise<boolean> {
  try {
    const project = await storage.getDevtoolsProject(projectId);
    return !!(project && (project.discovered_from_chain === 'xrp' || project.discovered_from_chain === 'xrpl'));
  } catch {
    return false;
  }
}

/**
 * Perform rollback for failed services
 */
async function performServiceRollback(projectId: string, failedServices: string[]): Promise<void> {
  console.log(`🔄 Rolling back services for project ${projectId}: ${failedServices.join(', ')}`);
  
  for (const serviceName of failedServices) {
    try {
      await storage.toggleProjectService(projectId, serviceName, false);
      console.log(`✅ Disabled ${serviceName} during rollback`);
    } catch (error) {
      console.error(`❌ Failed to rollback ${serviceName}:`, error);
    }
  }
}

/**
 * Log detailed error information for service initialization
 */
async function logServiceInitializationError(config: ProjectServiceConfig, result: ServiceInitializationResult): Promise<void> {
  const errorData = {
    projectId: config.projectId,
    issuerWallet: config.issuerWallet,
    chain: config.chain,
    projectType: config.projectType,
    taxon: config.taxon,
    errors: result.errors,
    warnings: result.warnings,
    initializedServices: result.initializedServices,
    retryAttempts: result.retryAttempts,
    rollbackPerformed: result.rollbackPerformed,
    executionTime: result.executionTime,
    timestamp: result.timestamp,
    validationResults: result.validationResults
  };

  console.error('📝 Service Initialization Error Details:', JSON.stringify(errorData, null, 2));
  
  // Store error in database if error logging system is available
  try {
    // This would use the error logging system from the schema if it exists
    // await storage.logError({
    //   error_message: `Service initialization failed for project ${config.projectId}`,
    //   error_type: 'service_initialization_error',
    //   severity: 'high',
    //   error_context: errorData
    // });
  } catch (error) {
    console.warn('⚠️ Could not log error to database:', error);
  }
}

export default {
  initializeProjectServices,
  initializeProjectConfigurations
};