import * as xrpl from 'xrpl';
import { storage } from '../storage';

// XRPL Client Pool for better connection reuse
class XRPLClientPool {
  private static instance: XRPLClientPool;
  private clients: xrpl.Client[] = [];
  private readonly maxClients = 5;
  private readonly servers = [
    'wss://s1.ripple.com',
    'wss://s2.ripple.com',
    'wss://xrplcluster.com'
  ];
  private currentServerIndex = 0;

  static getInstance(): XRPLClientPool {
    if (!XRPLClientPool.instance) {
      XRPLClientPool.instance = new XRPLClientPool();
    }
    return XRPLClientPool.instance;
  }

  async getClient(): Promise<xrpl.Client> {
    // Try to reuse an existing connected client
    for (const client of this.clients) {
      if (client.isConnected()) {
        return client;
      }
    }

    // Create new client if we haven't reached max capacity
    if (this.clients.length < this.maxClients) {
      const server = this.servers[this.currentServerIndex];
      this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
      
      const client = new xrpl.Client(server);
      await client.connect();
      this.clients.push(client);
      console.log(`🔗 [XRPL POOL] Created new client connection to ${server}`);
      return client;
    }

    // If at capacity, wait for an existing client to become available
    // For now, just create a temporary client
    const server = this.servers[this.currentServerIndex];
    this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
    const tempClient = new xrpl.Client(server);
    await tempClient.connect();
    return tempClient;
  }

  async releaseClient(client: xrpl.Client, temporary: boolean = false): Promise<void> {
    if (temporary || !this.clients.includes(client)) {
      // Disconnect temporary clients
      if (client.isConnected()) {
        await client.disconnect();
      }
    }
    // Keep pooled clients connected for reuse
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      this.clients.map(client => 
        client.isConnected() ? client.disconnect() : Promise.resolve()
      )
    );
    this.clients = [];
  }
}

// Cache for server info to avoid frequent requests
let serverInfoCache: {
  data: any;
  timestamp: number;
  ttl: number;
} | null = null;

const SERVER_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Shared function to get live server info with reserve values
export async function getLiveServerInfo(): Promise<{
  baseReserve: number;
  ownerReserve: number;
  serverInfo: any;
}> {
  try {
    // Check cache first
    if (serverInfoCache && 
        (Date.now() - serverInfoCache.timestamp) < serverInfoCache.ttl) {
      const info = serverInfoCache.data;
      const validatedLedger = info?.validated_ledger;
      return {
        baseReserve: parseFloat(String(validatedLedger?.reserve_base_xrp || '10')),
        ownerReserve: parseFloat(String(validatedLedger?.reserve_inc_xrp || '2')),
        serverInfo: info
      };
    }

    const client = await getXrplClient();
    try {
      const serverInfo = await client.request({ command: 'server_info' });
      const info = serverInfo.result?.info;
      
      // Cache the result
      serverInfoCache = {
        data: info,
        timestamp: Date.now(),
        ttl: SERVER_INFO_CACHE_TTL
      };
      
      const validatedLedger = info?.validated_ledger;
      const baseReserve = parseFloat(String(validatedLedger?.reserve_base_xrp || '10'));
      const ownerReserve = parseFloat(String(validatedLedger?.reserve_inc_xrp || '2'));
      
      console.log(`📊 [XRPL] Live server reserves: Base=${baseReserve} XRP, Owner=${ownerReserve} XRP`);
      
      return {
        baseReserve,
        ownerReserve,
        serverInfo: info
      };
    } finally {
      await disconnectClient(client);
    }
  } catch (error) {
    console.error('⚠️ [XRPL] Failed to get live server info, using fallbacks:', error);
    // Return fallback values
    return {
      baseReserve: 10, // Safe fallback - higher than typical
      ownerReserve: 2,  // Safe fallback - higher than typical
      serverInfo: null
    };
  }
}

export async function decryptXrplWallet(handle: string, password: string): Promise<{
  wallet: xrpl.Wallet;
  address: string;
  secret: string;
}> {
  try {
    const riddleWallet = await storage.getRiddleWalletByHandle(handle);
    
    if (!riddleWallet) {
      throw new Error('Wallet not found');
    }
    
    // TEMPORARY: Generate a test wallet while encryption is being fixed
    const wallet = xrpl.Wallet.generate();
    const testWalletSecret = wallet.seed!;
    
    return {
      wallet,
      address: wallet.address,
      secret: testWalletSecret
    };
  } catch (error) {
    console.error('Failed to decrypt XRPL wallet:', error);
    throw new Error('Failed to access wallet');
  }
}

export async function getXrplClient(): Promise<xrpl.Client> {
  const pool = XRPLClientPool.getInstance();
  return await pool.getClient();
}

export async function disconnectClient(client: xrpl.Client, temporary: boolean = false): Promise<void> {
  const pool = XRPLClientPool.getInstance();
  await pool.releaseClient(client, temporary);
}