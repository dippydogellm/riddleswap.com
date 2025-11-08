// External Wallet NFT Routes - Unsigned Transaction Preparation for All EVM Chains
// Works with MetaMask, Trust Wallet, Coinbase Wallet - client-side signing

import { Express } from 'express';
import { ethers } from 'ethers';
import { CHAIN_CONFIGS, type ChainKey } from '../bridge/multi-chain-bridge-routes';
import { dualWalletAuth } from '../middleware/dual-wallet-auth';

const ERC721_ABI = [
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function approve(address to, uint256 tokenId)',
  'function burn(uint256 tokenId)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

const ERC1155_ABI = [
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function setApprovalForAll(address operator, bool approved)',
  'function burn(address account, uint256 id, uint256 amount)',
  'function uri(uint256 id) view returns (string)'
];

function getEVMProvider(chainKey: ChainKey) {
  const chainConfig = CHAIN_CONFIGS[chainKey];
  if (!('chainId' in chainConfig)) {
    throw new Error(`${chainKey} is not an EVM chain`);
  }
  return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
}

export function registerExternalWalletNFTRoutes(app: Express) {
  console.log('🎨 Registering external wallet NFT routes...');

  // ==================================================
  // EVM CHAINS - PREPARE NFT TRANSFER (unsigned ERC-721)
  // ==================================================
  app.post("/api/external/nft/:chain/prepare-transfer", dualWalletAuth, async (req, res) => {
    const { chain } = req.params;
    const { walletAddress, toAddress, nftAddress, tokenId, standard = 'ERC721' } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const provider = getEVMProvider(chainKey);
      const nonce = await provider.getTransactionCount(walletAddress);
      const gasPrice = await provider.getFeeData();

      let data: string;
      
      if (standard === 'ERC1155') {
        const iface = new ethers.Interface(ERC1155_ABI);
        data = iface.encodeFunctionData('safeTransferFrom', [
          walletAddress,
          toAddress,
          tokenId,
          1,
          '0x'
        ]);
      } else {
        const iface = new ethers.Interface(ERC721_ABI);
        data = iface.encodeFunctionData('safeTransferFrom', [
          walletAddress,
          toAddress,
          tokenId
        ]);
      }

      const unsignedTx = {
        to: nftAddress,
        data,
        nonce,
        chainId: chainConfig.chainId,
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        gasLimit: 150000,
        type: 2
      };

      console.log(`✅ [${chainKey.toUpperCase()}] Prepared NFT transfer for external wallet`);

      return res.json({
        success: true,
        transaction: unsignedTx,
        chain: chainConfig.name,
        operation: 'transfer',
        tokenId,
        message: `NFT transfer prepared - sign with ${walletAddress.slice(0, 8)}...`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Prepare NFT transfer error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare NFT transfer'
      });
    }
  });

  // ==================================================
  // EVM CHAINS - PREPARE NFT BURN (unsigned)
  // ==================================================
  app.post("/api/external/nft/:chain/prepare-burn", dualWalletAuth, async (req, res) => {
    const { chain } = req.params;
    const { walletAddress, nftAddress, tokenId, standard = 'ERC721', amount = 1 } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const provider = getEVMProvider(chainKey);
      const nonce = await provider.getTransactionCount(walletAddress);
      const gasPrice = await provider.getFeeData();

      let data: string;
      
      if (standard === 'ERC1155') {
        const iface = new ethers.Interface(ERC1155_ABI);
        data = iface.encodeFunctionData('burn', [walletAddress, tokenId, amount]);
      } else {
        const iface = new ethers.Interface(ERC721_ABI);
        data = iface.encodeFunctionData('burn', [tokenId]);
      }

      const unsignedTx = {
        to: nftAddress,
        data,
        nonce,
        chainId: chainConfig.chainId,
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        gasLimit: 100000,
        type: 2
      };

      console.log(`✅ [${chainKey.toUpperCase()}] Prepared NFT burn for external wallet`);

      return res.json({
        success: true,
        transaction: unsignedTx,
        chain: chainConfig.name,
        operation: 'burn',
        tokenId,
        message: `NFT burn prepared - sign with ${walletAddress.slice(0, 8)}...`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Prepare NFT burn error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare NFT burn'
      });
    }
  });

  // ==================================================
  // EVM CHAINS - PREPARE NFT APPROVE (unsigned)
  // ==================================================
  app.post("/api/external/nft/:chain/prepare-approve", dualWalletAuth, async (req, res) => {
    const { chain } = req.params;
    const { walletAddress, nftAddress, spenderAddress, tokenId, standard = 'ERC721', approveAll = false } = req.body;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const provider = getEVMProvider(chainKey);
      const nonce = await provider.getTransactionCount(walletAddress);
      const gasPrice = await provider.getFeeData();

      let data: string;
      
      if (standard === 'ERC1155' || approveAll) {
        const iface = new ethers.Interface(ERC1155_ABI);
        data = iface.encodeFunctionData('setApprovalForAll', [spenderAddress, true]);
      } else {
        const iface = new ethers.Interface(ERC721_ABI);
        data = iface.encodeFunctionData('approve', [spenderAddress, tokenId]);
      }

      const unsignedTx = {
        to: nftAddress,
        data,
        nonce,
        chainId: chainConfig.chainId,
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        gasLimit: 80000,
        type: 2
      };

      console.log(`✅ [${chainKey.toUpperCase()}] Prepared NFT approve for external wallet`);

      return res.json({
        success: true,
        transaction: unsignedTx,
        chain: chainConfig.name,
        operation: 'approve',
        message: `NFT approval prepared - sign with ${walletAddress.slice(0, 8)}...`
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Prepare NFT approve error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare NFT approval'
      });
    }
  });

  // ==================================================
  // EVM CHAINS - GET NFT METADATA (read-only, no signing)
  // ==================================================
  app.get("/api/external/nft/:chain/metadata", async (req, res) => {
    const { chain } = req.params;
    const { nftAddress, tokenId, standard = 'ERC721' } = req.query;

    try {
      const chainKey = chain as ChainKey;
      const chainConfig = CHAIN_CONFIGS[chainKey];
      
      if (!chainConfig || !('chainId' in chainConfig)) {
        return res.status(400).json({
          success: false,
          error: `Invalid or unsupported chain: ${chain}`
        });
      }

      const provider = getEVMProvider(chainKey);
      const abi = standard === 'ERC1155' ? ERC1155_ABI : ERC721_ABI;
      const nftContract = new ethers.Contract(nftAddress as string, abi, provider);

      let tokenURI: string;
      
      if (standard === 'ERC1155') {
        tokenURI = await nftContract.uri(tokenId);
      } else {
        tokenURI = await nftContract.tokenURI(tokenId);
      }

      const metadataResponse = await fetch(tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/'));
      const metadata = await metadataResponse.json();

      console.log(`✅ [${chainKey.toUpperCase()}] Fetched NFT metadata for token ${tokenId}`);

      return res.json({
        success: true,
        chain: chainConfig.name,
        tokenId,
        tokenURI,
        metadata
      });

    } catch (error) {
      console.error(`❌ [${chain.toUpperCase()}] Get NFT metadata error:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch NFT metadata'
      });
    }
  });

  console.log('✅ External wallet NFT routes registered successfully');
  console.log('   🎨 Operations: prepare-transfer, prepare-burn, prepare-approve, metadata');
  console.log('   ⟠ All 14 EVM chains supported');
  console.log('   📦 Standards: ERC-721, ERC-1155');
}
