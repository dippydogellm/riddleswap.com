import express, { Response } from 'express';
import multer from 'multer';
import { storage } from './storage';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';
import { getPinataService } from './pinata-ipfs-service';
import { Client as XRPLClient, Wallet as XRPLWallet, NFTokenMint, convertStringToHex, Payment } from 'xrpl';
import crypto from 'crypto';

const pinata = getPinataService();

// Riddle Bank wallet address for payments
const RIDDLE_BANK_XRP_ADDRESS = process.env.RIDDLE_BANK_XRP_ADDRESS || 'rGDJxq11nj6gstTrUKND3NtAaLtSUGqvDY';

// Payment configuration
const SETUP_FEE_XRP = '1'; // 1 XRP setup fee
const PER_NFT_FEE_XRP = '0.01'; // 0.01 XRP per NFT

//Encryption helper (matches session encryption)
function decryptPrivateKey(encryptedKey: string, sessionSecret: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(sessionSecret, 'salt', 32);
  
  const parts = encryptedKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  
  return decrypted.toString();
}

const router = express.Router();

// Multer setup for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

// ============== TAXON VALIDATION ==============
// Check if a taxon number is already used on XRPL
router.post('/api/nft-projects/validate-taxon', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taxon, walletAddress } = req.body;
    
    if (!taxon) {
      return res.status(400).json({ error: 'Taxon is required' });
    }

    const taxonNumber = parseInt(taxon);
    
    // Validate taxon is a valid 32-bit unsigned integer
    if (isNaN(taxonNumber) || taxonNumber < 0 || taxonNumber > 4294967295) {
      return res.json({ 
        available: false, 
        error: 'Taxon must be between 0 and 4294967295' 
      });
    }

    // Check if taxon exists in our database
    const existingProject = await storage.getNftProjectByTaxon(taxonNumber);
    if (existingProject) {
      return res.json({ 
        available: false, 
        error: 'Taxon already used in another project',
        existingProject: {
          name: existingProject.projectName,
          creator: existingProject.creatorWallet
        }
      });
    }

    // Check if taxon is used on XRPL blockchain
    try {
      const xrplClient = new XRPLClient('wss://xrplcluster.com');
      await xrplClient.connect();

      const useWalletAddress = walletAddress || req.session?.riddleWallet?.xrpAddress;
      
      if (!useWalletAddress) {
        await xrplClient.disconnect();
        return res.status(401).json({ error: 'No wallet address provided' });
      }

      // Query for NFTs with this taxon from this wallet
      const nfts = await xrplClient.request({
        command: 'account_nfts',
        account: useWalletAddress,
        limit: 400
      });

      await xrplClient.disconnect();

      // Check if any NFTs have this taxon
      const nftWithTaxon = nfts.result.account_nfts?.find((nft: any) => {
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === taxonNumber;
      });

      if (nftWithTaxon) {
        return res.json({ 
          available: false, 
          error: 'Taxon already used in your XRPL wallet',
          nftId: nftWithTaxon.NFTokenID
        });
      }

      // Taxon is available
      res.json({ available: true, taxon: taxonNumber });
    } catch (xrplError) {
      console.error('❌ XRPL validation error:', xrplError);
      // If XRPL check fails, just check database
      res.json({ 
        available: true, 
        taxon: taxonNumber,
        warning: 'Could not verify on blockchain, but available in database'
      });
    }
  } catch (error) {
    console.error('❌ Error validating taxon:', error);
    res.status(500).json({ error: 'Failed to validate taxon' });
  }
});

// Helper function to log NFT project actions
async function logProjectAction(
  projectId: number,
  action: string,
  status: 'success' | 'fail' | 'in_progress',
  details?: string,
  errorMessage?: string,
  metadata?: Record<string, any>
) {
  await storage.createNftProjectLog({
    projectId,
    action,
    status,
    details,
    errorMessage,
    metadata: metadata || {}
  });
}

// ============== STEP 1: CREATE NFT PROJECT ==============
// Save project details (name, description, logo, taxon, etc.)
router.post('/api/nft-projects', requireAuthentication, upload.single('logo'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, projectDescription, collectionName, collectionSymbol, chainType, taxon, totalSupply, mintPrice, royaltyPercentage } = req.body;
    const userHandle = req.session?.riddleWallet?.handle;
    const creatorWallet = req.session?.riddleWallet?.xrpAddress; // Default to XRP address

    if (!userHandle || !creatorWallet) {
      return res.status(401).json({ error: 'Unauthorized - no wallet session' });
    }

    let projectLogo = '';
    
    // Upload logo to IPFS if provided
    if (req.file) {
      console.log(`📤 Uploading project logo to IPFS: ${req.file.originalname}`);
      const logoResult = await pinata.uploadFile(req.file.buffer, req.file.originalname);
      projectLogo = `ipfs://${logoResult.hash}`;
      console.log(`✅ Logo uploaded to IPFS: ${logoResult.hash}`);
    }

    // Validate and parse taxon if provided
    let parsedTaxon = null;
    if (taxon) {
      parsedTaxon = parseInt(taxon);
      if (isNaN(parsedTaxon) || parsedTaxon < 0 || parsedTaxon > 4294967295) {
        return res.status(400).json({ error: 'Invalid taxon: must be between 0 and 4294967295' });
      }
    }

    const project = await storage.createNftProject({
      creatorWallet,
      creatorUserId: userHandle,
      projectName,
      projectDescription,
      projectLogo,
      collectionName,
      collectionSymbol,
      chainType,
      taxon: parsedTaxon,
      totalSupply: parseInt(totalSupply),
      mintPrice: mintPrice || '0',
      royaltyPercentage: royaltyPercentage || '0',
      status: 'draft'
    });

    await logProjectAction(project.id, 'save_details', 'success', 'Project created and saved to database');

    console.log(`✅ [NFT PROJECT] Created project #${project.id}: ${projectName} (${collectionName})`);

    res.json({ 
      success: true,
      projectId: project.id, 
      message: 'Project created and available on dashboard',
      project 
    });
  } catch (error) {
    console.error('❌ Error creating NFT project:', error);
    res.status(500).json({ 
      error: 'Failed to create NFT project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all projects for creator
router.get('/api/nft-projects', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    if (!creatorWallet) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await storage.getNftProjectsByCreator(creatorWallet);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Error fetching NFT projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/api/nft-projects/:id', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    res.json({ success: true, project });
  } catch (error) {
    console.error('❌ Error fetching NFT project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ============== STEP 2: UPLOAD ASSETS ==============
// Upload images and metadata for NFT collection
router.post('/api/nft-projects/:id/upload-assets', requireAuthentication, upload.array('files', 1000), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    await logProjectAction(projectId, 'upload_assets', 'in_progress', `Uploading ${files.length} files`);

    // Separate images and metadata files
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.originalname));
    const metadataFiles = files.filter(f => f.originalname.endsWith('.json'));

    console.log(`📤 [NFT PROJECT #${projectId}] Processing ${imageFiles.length} images and ${metadataFiles.length} metadata files`);

    // Store assets temporarily (in memory for now, or could save to temp DB table)
    // For now, we'll just validate and count them
    
    await storage.updateNftProject(projectId, {
      status: 'uploading',
      assetsUploaded: imageFiles.length
    });

    await logProjectAction(projectId, 'upload_assets', 'success', `${files.length} files uploaded successfully`);

    res.json({ 
      success: true,
      message: 'Assets uploaded successfully',
      imageCount: imageFiles.length,
      metadataCount: metadataFiles.length
    });
  } catch (error) {
    const projectId = parseInt(req.params.id);
    await logProjectAction(projectId, 'upload_assets', 'fail', undefined, error instanceof Error ? error.message : 'Unknown error');
    
    console.error('❌ Error uploading assets:', error);
    res.status(500).json({ error: 'Failed to upload assets' });
  }
});

// ============== STEP 3: VALIDATE ASSETS ==============
// Scan and validate all uploaded assets for compliance
router.post('/api/nft-projects/:id/validate', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const { assets } = req.body; // Array of {image, metadata} pairs
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    await logProjectAction(projectId, 'validate', 'in_progress', 'Starting validation');

    const errors: string[] = [];

    // Validate each asset
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      
      // Validate metadata structure
      if (!asset.name || !asset.description) {
        errors.push(`Asset ${i + 1}: Missing name or description`);
      }

      if (!asset.image) {
        errors.push(`Asset ${i + 1}: Missing image reference`);
      }

      // Validate attributes
      if (!asset.attributes || !Array.isArray(asset.attributes)) {
        errors.push(`Asset ${i + 1}: Invalid attributes structure`);
      }
    }

    if (errors.length > 0) {
      await storage.updateNftProject(projectId, {
        validationStatus: 'failed',
        validationErrors: errors
      });

      await logProjectAction(projectId, 'validate', 'fail', `Validation failed with ${errors.length} errors`, errors.join('; '));

      return res.status(400).json({ 
        success: false,
        error: 'Validation failed',
        errors 
      });
    }

    // Validation passed
    await storage.updateNftProject(projectId, {
      status: 'validated',
      validationStatus: 'passed',
      validationErrors: []
    });

    await logProjectAction(projectId, 'validate', 'success', `${assets.length} assets validated successfully`);

    console.log(`✅ [NFT PROJECT #${projectId}] Validation passed for ${assets.length} assets`);

    res.json({ 
      success: true,
      message: 'Validation passed',
      assetCount: assets.length
    });
  } catch (error) {
    const projectId = parseInt(req.params.id);
    await logProjectAction(projectId, 'validate', 'fail', undefined, error instanceof Error ? error.message : 'Unknown error');
    
    console.error('❌ Error validating assets:', error);
    res.status(500).json({ error: 'Failed to validate assets' });
  }
});

// ============== STEP 4: PREVIEW ==============
// Generate preview data for frontend
router.get('/api/nft-projects/:id/preview', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    const assets = await storage.getNftAssetsByProject(projectId);

    const previews = assets.map(asset => ({
      name: asset.nftName,
      description: asset.nftDescription,
      image: asset.imageIpfsUrl || asset.imageIpfsHash,
      attributes: asset.attributes
    }));

    await logProjectAction(projectId, 'preview', 'success', `Generated ${previews.length} previews`);

    res.json({ success: true, previews });
  } catch (error) {
    const projectId = parseInt(req.params.id);
    await logProjectAction(projectId, 'preview', 'fail', undefined, error instanceof Error ? error.message : 'Unknown error');
    
    console.error('❌ Error generating previews:', error);
    res.status(500).json({ error: 'Failed to generate previews' });
  }
});

// ============== STEP 5: PIN TO IPFS ==============
// Upload all assets to IPFS via Pinata
router.post('/api/nft-projects/:id/pin-ipfs', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const { assets } = req.body; // Array of {imageBuffer, metadata}
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    if (project.validationStatus !== 'passed') {
      return res.status(400).json({ error: 'Please validate assets first' });
    }

    await logProjectAction(projectId, 'pin_ipfs', 'in_progress', `Pinning ${assets.length} assets to IPFS`);

    const metadataUris: string[] = [];
    const assetRecords = [];

    // Pin each asset (image + metadata) to IPFS
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      
      // Pin image
      const imageResult = await pinata.uploadFile(
        Buffer.from(asset.imageData, 'base64'),
        `${project.collectionName}_${i + 1}.png`
      );

      // Update metadata with IPFS image URL
      const metadata = {
        ...asset.metadata,
        image: `ipfs://${imageResult.hash}`
      };

      // Pin metadata JSON
      const metadataResult = await pinata.uploadNFTMetadata(metadata);
      metadataUris.push(`ipfs://${metadataResult.hash}`);

      // Store asset record in database
      assetRecords.push({
        projectId,
        assetIndex: i,
        imageFilename: asset.filename,
        imageIpfsHash: imageResult.hash,
        imageIpfsUrl: imageResult.url,
        nftName: metadata.name,
        nftDescription: metadata.description,
        attributes: metadata.attributes,
        metadataIpfsHash: metadataResult.hash,
        metadataIpfsUrl: metadataResult.url
      });
    }

    // Save all assets to database
    await storage.createNftAssets(assetRecords);

    // Update project with IPFS data
    await storage.updateNftProject(projectId, {
      status: 'pinned',
      ipfsMetadataCids: metadataUris,
      metadataGenerated: metadataUris.length
    });

    await logProjectAction(projectId, 'pin_ipfs', 'success', `Pinned ${metadataUris.length} assets to IPFS`);

    console.log(`✅ [NFT PROJECT #${projectId}] Pinned ${metadataUris.length} assets to IPFS`);

    res.json({ 
      success: true,
      message: 'Assets pinned to IPFS',
      uris: metadataUris,
      count: metadataUris.length
    });
  } catch (error) {
    const projectId = parseInt(req.params.id);
    await logProjectAction(projectId, 'pin_ipfs', 'fail', undefined, error instanceof Error ? error.message : 'Unknown error');
    
    console.error('❌ Error pinning to IPFS:', error);
    res.status(500).json({ error: 'Failed to pin to IPFS' });
  }
});

// ============== STEP 5.5: PAYMENT ==============
// Process payment to Riddle Bank before launching
router.post('/api/nft-projects/:id/payment', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    // Check project is ready for payment
    if (project.status !== 'pinned') {
      return res.status(400).json({ error: 'Project must have pinned assets before payment' });
    }

    // Check if payment already made
    if (project.paymentStatus === 'completed') {
      return res.status(400).json({ error: 'Payment already completed for this project' });
    }

    // Calculate payment amount
    const totalSupply = project.totalSupply || 0;
    const setupFee = parseFloat(SETUP_FEE_XRP);
    const perNftFee = parseFloat(PER_NFT_FEE_XRP) * totalSupply;
    const totalAmount = setupFee + perNftFee;
    const totalAmountDrops = Math.floor(totalAmount * 1_000_000).toString(); // Convert to drops

    console.log(`💰 [PAYMENT] Project #${projectId}: ${totalSupply} NFTs = ${SETUP_FEE_XRP} XRP + (${PER_NFT_FEE_XRP} × ${totalSupply}) = ${totalAmount} XRP`);

    // Get encrypted private key from session
    const encryptedKey = req.session?.riddleWallet?.encryptedPrivateKeys?.xrp;
    const sessionSecret = req.session?.riddleWallet?.sessionSecret;

    if (!encryptedKey || !sessionSecret) {
      return res.status(401).json({ error: 'Wallet credentials not found in session. Please log in again.' });
    }

    // Decrypt private key
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(encryptedKey, sessionSecret);
    } catch (decryptError) {
      console.error('❌ Failed to decrypt private key:', decryptError);
      return res.status(500).json({ error: 'Failed to decrypt wallet credentials' });
    }

    // Connect to XRPL
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    try {
      // Create wallet from decrypted key
      const wallet = XRPLWallet.fromSeed(privateKey);

      // Verify wallet address matches
      if (wallet.address !== creatorWallet) {
        throw new Error('Wallet address mismatch');
      }

      // Check balance
      const accountInfo = await client.request({
        command: 'account_info',
        account: wallet.address,
        ledger_index: 'validated'
      });

      const balance = parseInt(accountInfo.result.account_data.Balance);
      const balanceXRP = balance / 1_000_000;
      const requiredXRP = totalAmount + 0.02; // Add 0.02 XRP for transaction fee buffer

      if (balanceXRP < requiredXRP) {
        return res.status(400).json({ 
          error: `Insufficient balance. Required: ${requiredXRP} XRP, Available: ${balanceXRP} XRP` 
        });
      }

      // Create payment transaction
      const paymentTx: Payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: RIDDLE_BANK_XRP_ADDRESS,
        Amount: totalAmountDrops,
        Memos: [{
          Memo: {
            MemoType: convertStringToHex('NFT_LAUNCHPAD_SETUP'),
            MemoData: convertStringToHex(`Project ${projectId} - ${project.projectName}`)
          }
        }]
      };

      console.log(`💸 [PAYMENT] Sending ${totalAmount} XRP to ${RIDDLE_BANK_XRP_ADDRESS}`);

      // Sign and submit transaction
      const prepared = await client.autofill(paymentTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      // Check transaction success
      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        const meta = result.result.meta as any;
        
        if (meta.TransactionResult === 'tesSUCCESS') {
          // Update project with payment details
          await storage.updateNftProject(projectId, {
            paymentStatus: 'completed',
            paymentAmount: totalAmount.toString(),
            paymentTxHash: result.result.hash,
            paymentVerifiedAt: new Date(),
            paymentDestination: RIDDLE_BANK_XRP_ADDRESS,
            status: 'paid' // Move to paid status
          });

          await logProjectAction(projectId, 'payment', 'success', `Paid ${totalAmount} XRP to Riddle Bank`);

          console.log(`✅ [PAYMENT] Project #${projectId} payment successful: ${result.result.hash}`);

          res.json({
            success: true,
            message: 'Payment completed successfully',
            amount: totalAmount,
            txHash: result.result.hash,
            destination: RIDDLE_BANK_XRP_ADDRESS
          });
        } else {
          throw new Error(`Transaction failed: ${meta.TransactionResult}`);
        }
      } else {
        throw new Error('Transaction result not found');
      }
    } finally {
      // Always disconnect XRPL client
      await client.disconnect();
    }
  } catch (error) {
    const projectId = parseInt(req.params.id);
    await logProjectAction(projectId, 'payment', 'fail', undefined, error instanceof Error ? error.message : 'Unknown error');
    
    console.error('❌ Error processing payment:', error);
    res.status(500).json({ 
      error: 'Payment failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============== STEP 6: MINT/LAUNCH ==============
// Mint NFTs on XRPL blockchain using broker wallet
router.post('/api/nft-projects/:id/launch', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const { transferFee } = req.body; // Royalty percentage (e.g., 500 = 5%)
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }

    // Check payment has been completed
    if (project.paymentStatus !== 'completed') {
      return res.status(400).json({ error: 'Please complete payment before launching' });
    }

    if (project.status !== 'paid') {
      return res.status(400).json({ error: 'Project must be in paid status before launching' });
    }

    const assets = await storage.getNftAssetsByProject(projectId);
    
    if (assets.length === 0) {
      return res.status(400).json({ error: 'No assets found to mint' });
    }

    await logProjectAction(projectId, 'mint', 'in_progress', `Starting mint for ${assets.length} NFTs`);
    await storage.updateNftProject(projectId, { status: 'minting' });

    // Connect to XRPL
    const client = new XRPLClient('wss://s1.ripple.com'); // Use testnet for dev
    await client.connect();

    // Get broker wallet from env
    const BROKER_SEED = process.env.BROKER_WALLET_SEED;
    if (!BROKER_SEED) {
      throw new Error('Broker wallet seed not configured');
    }

    const brokerWallet = XRPLWallet.fromSeed(BROKER_SEED);
    
    console.log(`🔗 [NFT MINT] Connected to XRPL, minting from ${brokerWallet.address}`);

    const mintTransactions = [];

    // Mint each NFT
    for (const asset of assets) {
      try {
        const mintTx: NFTokenMint = {
          TransactionType: 'NFTokenMint',
          Account: brokerWallet.address,
          NFTokenTaxon: project.taxon || 0,
          TransferFee: transferFee || 0, // Royalty as basis points (500 = 5%)
          URI: convertStringToHex(asset.metadataIpfsUrl || `ipfs://${asset.metadataIpfsHash}`),
          Flags: 8 // Transferable
        };

        const prepared = await client.autofill(mintTx);
        const signed = brokerWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
          const meta = result.result.meta as any;
          
          if (meta.TransactionResult === 'tesSUCCESS') {
            // Extract NFTokenID from metadata
            const nftId = meta.nft_id || meta.NFTokenID || 'unknown';
            
            mintTransactions.push({
              hash: result.result.hash,
              nftId,
              tokenId: nftId
            });

            // Update asset as minted
            await storage.updateNftAsset(asset.id, {
              minted: true,
              mintTransactionHash: result.result.hash,
              nftTokenId: nftId
            });

            console.log(`✅ Minted NFT: ${asset.nftName} (${nftId})`);
          }
        }
      } catch (mintError) {
        console.error(`❌ Failed to mint asset ${asset.id}:`, mintError);
      }
    }

    await client.disconnect();

    // Update project status
    await storage.updateNftProject(projectId, {
      status: 'launched',
      mintedCount: mintTransactions.length,
      mintTransactions,
      launchDate: new Date()
    });

    await logProjectAction(projectId, 'mint', 'success', `Minted ${mintTransactions.length} NFTs on XRPL`);

    console.log(`✅ [NFT PROJECT #${projectId}] Launched with ${mintTransactions.length} NFTs minted`);

    res.json({ 
      success: true,
      message: 'NFTs minted successfully',
      mintedCount: mintTransactions.length,
      transactions: mintTransactions
    });
  } catch (error) {
    const projectId = parseInt(req.params.id);
    await storage.updateNftProject(projectId, { status: 'failed' });
    await logProjectAction(projectId, 'mint', 'fail', undefined, error instanceof Error ? error.message : 'Unknown error');
    
    console.error('❌ Error minting NFTs:', error);
    res.status(500).json({ error: 'Failed to mint NFTs' });
  }
});

// Get project logs
router.get('/api/nft-projects/:id/logs', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const creatorWallet = req.session?.riddleWallet?.xrpAddress;
    
    const project = await storage.getNftProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.creatorWallet !== creatorWallet) {
      return res.status(403).json({ error: 'Unauthorized - you do not own this project' });
    }
    
    const logs = await storage.getNftProjectLogs(projectId, limit);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('❌ Error fetching project logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
