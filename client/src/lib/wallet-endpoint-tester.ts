/**
 * Wallet Endpoint Testing Utility
 * Comprehensive testing suite for all wallet endpoints across all chains
 */

export interface EndpointTestResult {
  chain: string;
  endpoint: string;
  success: boolean;
  status?: number;
  statusText?: string;
  data?: any;
  error?: string;
  responseTime?: number;
  timestamp: string;
}

export interface ChainTestResults {
  chain: string;
  address: string;
  results: EndpointTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    averageResponseTime: number;
  };
}

// All supported chains for testing
export const SUPPORTED_CHAINS = [
  'xrp', 'eth', 'sol', 'btc', 
  'arbitrum', 'base', 'polygon', 'optimism', 'bsc',
  'avalanche', 'fantom', 'linea', 'mantle', 'metis',
  'scroll', 'taiko', 'unichain', 'soneium', 'zksync'
] as const;

// Standard endpoints available for most chains
export const STANDARD_ENDPOINTS = [
  'balance',
  'tokens', 
  'nfts',
  'transactions',
  'portfolio'
] as const;

// Test wallet addresses for each chain (these should be real addresses with some data)
export const TEST_ADDRESSES: Record<string, string> = {
  xrp: 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo', // Known XRPL address with data
  eth: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F', // Known Ethereum address
  sol: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // Known Solana address  
  btc: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Genesis block address
  // EVM chains use same address as ETH
  arbitrum: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  base: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  polygon: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  optimism: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  bsc: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  avalanche: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  fantom: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  linea: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  mantle: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  metis: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  scroll: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  taiko: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  unichain: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  soneium: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F',
  zksync: '0x742C2ff85AF9c447fD56d9E8D68f12D81350f26F'
};

export class WalletEndpointTester {
  private sessionToken: string | null = null;
  private baseUrl = '';

  constructor(sessionToken?: string) {
    this.sessionToken = sessionToken || localStorage.getItem('sessionToken');
    this.baseUrl = window.location.origin;
  }

  /**
   * Test a single endpoint for a specific chain
   */
  async testEndpoint(
    chain: string, 
    endpoint: string, 
    address: string,
    timeout = 10000
  ): Promise<EndpointTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      console.log(`🧪 Testing ${chain}/${endpoint} for address: ${address}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseUrl}/api/wallets/${chain}/${endpoint}/${address}`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let data;
      try {
        data = await response.json() as any;
      } catch (jsonError) {
        data = await response.text();
      }

      return {
        chain,
        endpoint,
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        responseTime,
        timestamp
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        chain,
        endpoint,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        timestamp
      };
    }
  }

  /**
   * Test all endpoints for a specific chain
   */
  async testChain(chain: string, address?: string): Promise<ChainTestResults> {
    const testAddress = address || TEST_ADDRESSES[chain];
    
    if (!testAddress) {
      throw new Error(`No test address available for chain: ${chain}`);
    }

    console.log(`🔍 Testing all endpoints for ${chain.toUpperCase()} chain`);
    console.log(`📍 Using address: ${testAddress}`);

    const results: EndpointTestResult[] = [];
    
    // Test all standard endpoints
    for (const endpoint of STANDARD_ENDPOINTS) {
      const result = await this.testEndpoint(chain, endpoint, testAddress);
      results.push(result);
      
      // Add small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate summary statistics
    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;
    const totalResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);
    const averageResponseTime = totalResponseTime / results.length;

    return {
      chain,
      address: testAddress,
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        averageResponseTime: Math.round(averageResponseTime)
      }
    };
  }

  /**
   * Test all chains comprehensively
   */
  async testAllChains(onProgress?: (progress: { chain: string; completed: number; total: number }) => void): Promise<ChainTestResults[]> {
    console.log(`🚀 Starting comprehensive endpoint testing for ${SUPPORTED_CHAINS.length} chains`);
    
    const allResults: ChainTestResults[] = [];
    let completed = 0;

    for (const chain of SUPPORTED_CHAINS) {
      try {
        onProgress?.({ chain, completed, total: SUPPORTED_CHAINS.length });
        
        const chainResults = await this.testChain(chain);
        allResults.push(chainResults);
        
        console.log(`✅ ${chain.toUpperCase()}: ${chainResults.summary.passed}/${chainResults.summary.total} endpoints working`);
        
      } catch (error) {
        console.error(`❌ Failed to test ${chain}:`, error);
        
        // Add failed result
        allResults.push({
          chain,
          address: TEST_ADDRESSES[chain] || 'unknown',
          results: [],
          summary: { total: 0, passed: 0, failed: 1, averageResponseTime: 0 }
        });
      }
      
      completed++;
      
      // Add delay between chains to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return allResults;
  }

  /**
   * Generate test report
   */
  generateReport(results: ChainTestResults[]): string {
    const totalEndpoints = results.reduce((sum, chain) => sum + chain.summary.total, 0);
    const totalPassed = results.reduce((sum, chain) => sum + chain.summary.passed, 0);
    const totalFailed = results.reduce((sum, chain) => sum + chain.summary.failed, 0);
    const successRate = (totalPassed / totalEndpoints) * 100;

    let report = `# Wallet Endpoint Test Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n`;
    report += `- **Total Endpoints Tested:** ${totalEndpoints}\n`;
    report += `- **Passed:** ${totalPassed}\n`;
    report += `- **Failed:** ${totalFailed}\n`;
    report += `- **Success Rate:** ${successRate.toFixed(1)}%\n\n`;

    report += `## Chain Results\n\n`;

    for (const chain of results) {
      const { passed, failed, total, averageResponseTime } = chain.summary;
      const chainSuccessRate = total > 0 ? (passed / total) * 100 : 0;
      
      report += `### ${chain.chain.toUpperCase()}\n`;
      report += `- **Address:** \`${chain.address}\`\n`;
      report += `- **Success Rate:** ${chainSuccessRate.toFixed(1)}% (${passed}/${total})\n`;
      report += `- **Average Response Time:** ${averageResponseTime}ms\n`;
      
      if (failed > 0) {
        report += `- **Failed Endpoints:**\n`;
        for (const result of chain.results.filter(r => !r.success)) {
          report += `  - \`${result.endpoint}\`: ${result.error || result.statusText || 'Unknown error'}\n`;
        }
      }
      
      report += `\n`;
    }

    return report;
  }

  /**
   * Test specific endpoint types across all chains
   */
  async testEndpointType(endpoint: string): Promise<{ endpoint: string; results: EndpointTestResult[] }> {
    console.log(`🎯 Testing ${endpoint} endpoint across all chains`);
    
    const results: EndpointTestResult[] = [];
    
    for (const chain of SUPPORTED_CHAINS) {
      const address = TEST_ADDRESSES[chain];
      if (!address) continue;
      
      const result = await this.testEndpoint(chain, endpoint, address);
      results.push(result);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { endpoint, results };
  }

  /**
   * Validate response data structure
   */
  validateResponseData(result: EndpointTestResult): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!result.success) {
      issues.push('Request failed');
      return { valid: false, issues };
    }

    const { data } = result;
    
    // Basic structure validation
    if (!data || typeof data !== 'object') {
      issues.push('Response is not a valid JSON object');
      return { valid: false, issues };
    }

    // Check for success field
    if (typeof data.success !== 'boolean') {
      issues.push('Missing or invalid success field');
    }

    // Endpoint-specific validation
    switch (result.endpoint) {
      case 'balance':
        if (!data.balance && data.balance !== '0') {
          issues.push('Missing balance field');
        }
        if (!data.address) {
          issues.push('Missing address field');
        }
        break;
        
      case 'tokens':
        if (!Array.isArray(data.tokens) && !Array.isArray(data.data?.tokens)) {
          issues.push('Tokens should be an array');
        }
        break;
        
      case 'nfts':
        if (!Array.isArray(data.nfts) && !Array.isArray(data.data?.nfts)) {
          issues.push('NFTs should be an array');
        }
        break;
        
      case 'transactions':
        if (!Array.isArray(data.transactions) && !Array.isArray(data.data?.transactions)) {
          issues.push('Transactions should be an array');
        }
        break;
    }

    return { valid: issues.length === 0, issues };
  }
}

export default WalletEndpointTester;
