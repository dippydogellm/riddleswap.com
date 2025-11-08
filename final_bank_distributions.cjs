// Final Bank Wallet Distributions - Solana & Ethereum
const { ethers } = require('ethers');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const bs58 = require('bs58');
require('dotenv').config();

// Bank wallet private keys from environment
const BANK_KEYS = {
  eth: process.env.BANK_ETH_PRIVATE_KEY,
  sol: process.env.BANK_SOL_PRIVATE_KEY
};

// Final distributions to user specified addresses
const distributions = [
  {
    chain: 'Solana',
    token: 'SOL',
    amount: '0.01',
    destination: '4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE',
    description: 'SOL to specified Solana address'
  },
  {
    chain: 'Ethereum',
    token: 'ETH', 
    amount: '0.0001',
    destination: '0x1819fB7F80582bC17b98264F5201192e344d76D2',
    description: 'ETH to specified Ethereum address'
  }
];

// Parse Solana private key - try multiple formats
function parseSolanaKey(keyString) {
  console.log(`🔑 Parsing SOL key (length: ${keyString.length})`);
  
  // Method 1: Try as base58 string
  try {
    const decoded = bs58.decode(keyString);
    if (decoded.length === 64) {
      console.log('✅ Parsed as base58 (64 bytes)');
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    console.log('❌ Not base58 format');
  }
  
  // Method 2: Try as hex string
  try {
    let hexKey = keyString;
    if (hexKey.startsWith('0x')) hexKey = hexKey.slice(2);
    
    const decoded = Buffer.from(hexKey, 'hex');
    if (decoded.length === 32) {
      // 32-byte seed, derive keypair
      console.log('✅ Parsed as 32-byte hex seed');
      return Keypair.fromSeed(decoded);
    } else if (decoded.length === 64) {
      // 64-byte secret key
      console.log('✅ Parsed as 64-byte hex key');
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    console.log('❌ Not hex format');
  }
  
  // Method 3: Try as JSON array
  try {
    const keyArray = JSON.parse(keyString);
    if (Array.isArray(keyArray)) {
      if (keyArray.length === 32) {
        console.log('✅ Parsed as 32-element JSON seed');
        return Keypair.fromSeed(new Uint8Array(keyArray));
      } else if (keyArray.length === 64) {
        console.log('✅ Parsed as 64-element JSON key');
        return Keypair.fromSecretKey(new Uint8Array(keyArray));
      }
    }
  } catch (e) {
    console.log('❌ Not JSON array format');
  }
  
  // Method 4: Try raw bytes if comma-separated
  try {
    if (keyString.includes(',')) {
      const bytes = keyString.split(',').map(s => parseInt(s.trim()));
      if (bytes.length === 32) {
        console.log('✅ Parsed as comma-separated 32 bytes');
        return Keypair.fromSeed(new Uint8Array(bytes));
      } else if (bytes.length === 64) {
        console.log('✅ Parsed as comma-separated 64 bytes');
        return Keypair.fromSecretKey(new Uint8Array(bytes));
      }
    }
  } catch (e) {
    console.log('❌ Not comma-separated format');
  }
  
  throw new Error('Unable to parse Solana private key - unsupported format');
}

// Execute Solana distribution
async function executeSolanaDistribution(dist) {
  try {
    console.log(`\n🟣 ${dist.description}`);
    console.log(`💰 Amount: ${dist.amount} ${dist.token}`);
    console.log(`📍 To: ${dist.destination}`);
    
    // Parse the private key
    const bankKeyPair = parseSolanaKey(BANK_KEYS.sol);
    console.log(`🏦 Bank Address: ${bankKeyPair.publicKey.toString()}`);
    
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const destinationPubkey = new PublicKey(dist.destination);
    
    // Check bank balance first
    const balance = await connection.getBalance(bankKeyPair.publicKey);
    const balanceSOL = balance / 1e9;
    console.log(`💰 Bank Balance: ${balanceSOL.toFixed(6)} SOL`);
    
    if (balanceSOL < parseFloat(dist.amount)) {
      throw new Error(`Insufficient balance: ${balanceSOL} SOL < ${dist.amount} SOL`);
    }
    
    const lamports = Math.floor(parseFloat(dist.amount) * 1e9);
    console.log(`📦 Sending ${lamports} lamports (${dist.amount} SOL)`);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: bankKeyPair.publicKey
    }).add(
      SystemProgram.transfer({
        fromPubkey: bankKeyPair.publicKey,
        toPubkey: destinationPubkey,
        lamports: lamports
      })
    );
    
    console.log('📤 Submitting Solana transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [bankKeyPair],
      { 
        commitment: 'confirmed',
        skipPreflight: false
      }
    );
    
    console.log(`✅ ${dist.token} distribution successful!`);
    console.log(`📋 Signature: ${signature}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}`);
    
    return {
      success: true,
      txHash: signature,
      amount: dist.amount,
      token: dist.token,
      destination: dist.destination
    };
  } catch (error) {
    console.error(`❌ ${dist.description} failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Execute Ethereum distribution
async function executeEthereumDistribution(dist) {
  try {
    console.log(`\n⚡ ${dist.description}`);
    console.log(`💰 Amount: ${dist.amount} ${dist.token}`);
    console.log(`📍 To: ${dist.destination}`);
    
    // Use multiple RPC providers for reliability
    const providers = [
      'https://ethereum.publicnode.com',
      'https://rpc.ankr.com/eth',
      'https://eth.llamarpc.com'
    ];
    
    let provider, bankWallet;
    for (const rpcUrl of providers) {
      try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        bankWallet = new ethers.Wallet(BANK_KEYS.eth, provider);
        
        // Test connection
        await provider.getNetwork();
        console.log(`✅ Connected to: ${rpcUrl}`);
        break;
      } catch (e) {
        console.log(`❌ Failed: ${rpcUrl}`);
        continue;
      }
    }
    
    if (!provider || !bankWallet) {
      throw new Error('No Ethereum RPC connection available');
    }
    
    console.log(`🏦 Bank Address: ${bankWallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(bankWallet.address);
    const balanceETH = ethers.formatEther(balance);
    console.log(`💰 Bank Balance: ${balanceETH} ETH`);
    
    if (parseFloat(balanceETH) < parseFloat(dist.amount)) {
      throw new Error(`Insufficient balance: ${balanceETH} ETH < ${dist.amount} ETH`);
    }
    
    // Get current fee data
    const feeData = await provider.getFeeData();
    console.log(`⛽ Gas Price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
    
    // Create transaction with proper gas settings
    const transaction = {
      to: dist.destination,
      value: ethers.parseEther(dist.amount),
      gasLimit: 21000n,
      gasPrice: feeData.gasPrice,
      nonce: await provider.getTransactionCount(bankWallet.address)
    };
    
    // Estimate gas to make sure transaction will succeed
    try {
      const gasEstimate = await provider.estimateGas({
        to: transaction.to,
        value: transaction.value,
        from: bankWallet.address
      });
      console.log(`⛽ Gas Estimate: ${gasEstimate.toString()}`);
    } catch (gasError) {
      console.log(`⚠️ Gas estimation failed: ${gasError.message}`);
    }
    
    console.log('📤 Submitting Ethereum transaction...');
    const tx = await bankWallet.sendTransaction(transaction);
    console.log(`📋 TX Hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait(1);
    
    if (receipt.status === 1) {
      console.log(`✅ ${dist.token} distribution successful!`);
      console.log(`🔗 Explorer: https://etherscan.io/tx/${receipt.hash}`);
      
      return {
        success: true,
        txHash: receipt.hash,
        amount: dist.amount,
        token: dist.token,
        destination: dist.destination
      };
    } else {
      throw new Error(`Transaction failed with status: ${receipt.status}`);
    }
    
  } catch (error) {
    console.error(`❌ ${dist.description} failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🏦 FINAL BANK WALLET DISTRIBUTIONS');
  console.log('===================================');
  console.log('Solana & Ethereum with correct details\n');
  
  const results = [];
  
  for (const dist of distributions) {
    let result;
    
    if (dist.chain === 'Solana') {
      result = await executeSolanaDistribution(dist);
    } else if (dist.chain === 'Ethereum') {
      result = await executeEthereumDistribution(dist);
    }
    
    results.push(result);
    
    // Wait between transactions
    if (result.success) {
      console.log('⏳ Waiting 5 seconds before next transaction...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('📊 FINAL SUMMARY:');
  console.log('==================');
  results.forEach((result, i) => {
    const status = result.success ? '✅' : '❌';
    const details = result.success 
      ? `${result.amount} ${result.token} → ${result.destination.substring(0,10)}...`
      : result.error;
    console.log(`${i + 1}. ${status} ${distributions[i].description}`);
    console.log(`   ${details}`);
    if (result.success && result.txHash) {
      if (distributions[i].chain === 'Solana') {
        console.log(`   🔗 https://explorer.solana.com/tx/${result.txHash}`);
      } else if (distributions[i].chain === 'Ethereum') {
        console.log(`   🔗 https://etherscan.io/tx/${result.txHash}`);
      }
    }
  });
  
  return results;
}

main().catch(console.error);