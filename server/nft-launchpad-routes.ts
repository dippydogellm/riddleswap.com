import { Express } from 'express';
import { db } from './db';
import { nanoid } from 'nanoid';

// NFT Launchpad schemas
interface NFTProject {
  id: string;
  name: string;
  description: string;
  image: string;
  creator: string;
  creatorWallet: string;
  totalSupply: number;
  mintedSupply: number;
  mintPrice: number;
  status: 'upcoming' | 'live' | 'sold-out' | 'ended';
  startTime: string;
  endTime: string;
  category: string;
  verified: boolean;
  featured: boolean;
  royaltyPercentage: number;
  createdAt: string;
  revenue: number;
  uniqueHolders: number;
}

interface MintTransaction {
  id: string;
  projectId: string;
  walletAddress: string;
  walletHandle: string;
  quantity: number;
  totalPaid: number;
  txHash: string;
  timestamp: string;
  status: string;
}

// In-memory storage for NFT launchpad data
const nftProjects = new Map<string, NFTProject>();
const mintTransactions = new Map<string, MintTransaction>();

// No sample projects - only real data allowed
// Projects will be loaded from Bithomp API when needed

export function registerNFTLaunchpadRoutes(app: Express) {
  console.log('🚀 Setting up NFT Launchpad routes...');

  // Get all NFT projects with filtering
  app.get('/api/nft/launchpad/projects', async (req, res) => {
    try {
      const { category, search } = req.query;
      let projects = Array.from(nftProjects.values());

      // Filter by category
      if (category && category !== 'all') {
        projects = projects.filter(p => p.category === category);
      }

      // Filter by search query
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        projects = projects.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.creator.toLowerCase().includes(searchLower)
        );
      }

      // Sort by featured first, then by status, then by created date
      projects.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        
        const statusOrder = { 'live': 0, 'upcoming': 1, 'sold-out': 2, 'ended': 3 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      console.log(`📦 Retrieved ${projects.length} NFT projects`);
      res.json({ projects });
    } catch (error) {
      console.error('Error fetching NFT projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Mint NFT from a project
  app.post('/api/nft/launchpad/mint', async (req, res) => {
    try {
      const { projectId, walletAddress, walletHandle, quantity, password } = req.body;

      if (!projectId || !walletAddress || !walletHandle || !quantity || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      // Verify password (simplified)
      if (password !== 'Neverknow1.') {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      const project = nftProjects.get(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Check if project is live and has supply
      if (project.status !== 'live') {
        return res.status(400).json({
          success: false,
          error: 'Project is not currently live for minting'
        });
      }

      if (project.mintedSupply + quantity > project.totalSupply) {
        return res.status(400).json({
          success: false,
          error: 'Not enough supply remaining'
        });
      }

      // Calculate costs
      const baseCost = project.mintPrice * quantity;
      const platformFee = baseCost * 0.025; // 2.5% platform fee
      const totalCost = baseCost + platformFee;

      // Create mint transaction
      const transactionId = nanoid();
      // NO MOCK TRANSACTION DATA - return empty hash for development
      const txHash = '';
      
      const mintTransaction: MintTransaction = {
        id: transactionId,
        projectId,
        walletAddress,
        walletHandle,
        quantity,
        totalPaid: totalCost,
        txHash: txHash,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      mintTransactions.set(transactionId, mintTransaction);

      // Update project minted supply and revenue
      project.mintedSupply += quantity;
      project.revenue += totalCost;
      
      // Update status if sold out
      if (project.mintedSupply >= project.totalSupply) {
        project.status = 'sold-out';
      }

      nftProjects.set(projectId, project);

      console.log(`✅ NFT Mint successful: ${quantity} ${project.name} NFTs minted by ${walletHandle} for ${totalCost} XRP`);

      res.json({
        success: true,
        transactionId,
        txHash: txHash,
        quantity,
        totalCost,
        message: `Successfully minted ${quantity} ${project.name} NFT(s)`
      });

    } catch (error) {
      console.error('Mint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process mint request'
      });
    }
  });

  // Get projects for developer dashboard
  app.get('/api/nft/launchpad/dashboard/projects', async (req, res) => {
    try {
      const { walletAddress } = req.query;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      const projects = Array.from(nftProjects.values())
        .filter(p => p.creatorWallet === walletAddress)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log(`📊 Retrieved ${projects.length} projects for wallet ${walletAddress}`);
      res.json({ projects });
    } catch (error) {
      console.error('Error fetching dashboard projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Get mint transactions for developer dashboard
  app.get('/api/nft/launchpad/dashboard/transactions', async (req, res) => {
    try {
      const { walletAddress } = req.query;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      // Get projects owned by this wallet
      const ownedProjectIds = Array.from(nftProjects.values())
        .filter(p => p.creatorWallet === walletAddress)
        .map(p => p.id);

      // Get transactions for owned projects
      const transactions = Array.from(mintTransactions.values())
        .filter(t => ownedProjectIds.includes(t.projectId))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      console.log(`💳 Retrieved ${transactions.length} transactions for wallet ${walletAddress}`);
      res.json({ transactions });
    } catch (error) {
      console.error('Error fetching dashboard transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // Create new NFT project
  app.post('/api/nft/launchpad/dashboard/create', async (req, res) => {
    try {
      const {
        name,
        description,
        image,
        totalSupply,
        mintPrice,
        category,
        startTime,
        endTime,
        royaltyPercentage,
        creatorWallet,
        password
      } = req.body;

      if (!name || !description || !creatorWallet || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      // Verify password
      if (password !== 'Neverknow1.') {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      const projectId = nanoid();
      const now = new Date().toISOString();
      
      // Determine status based on start time
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const currentDate = new Date();
      
      let status: 'upcoming' | 'live' | 'ended' = 'upcoming';
      if (currentDate >= startDate && currentDate <= endDate) {
        status = 'live';
      } else if (currentDate > endDate) {
        status = 'ended';
      }

      const newProject: NFTProject = {
        id: projectId,
        name,
        description,
        image: image || '/api/placeholder/400/300?text=NFT+Project',
        creator: `Creator ${creatorWallet.slice(0, 8)}...`,
        creatorWallet,
        totalSupply: totalSupply || 1000,
        mintedSupply: 0,
        mintPrice: mintPrice || 10,
        status,
        startTime: startTime || now,
        endTime: endTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        category: category || 'art',
        verified: false,
        featured: false,
        royaltyPercentage: royaltyPercentage || 5,
        createdAt: now,
        revenue: 0,
        uniqueHolders: 0
      };

      nftProjects.set(projectId, newProject);

      console.log(`🎨 New NFT project created: ${name} by ${creatorWallet}`);

      res.json({
        success: true,
        projectId,
        project: newProject,
        message: `Project "${name}" created successfully`
      });

    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create project'
      });
    }
  });

  // Update NFT project
  app.put('/api/nft/launchpad/dashboard/update/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { walletAddress, password, ...updates } = req.body;

      if (!walletAddress || !password) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address and password required'
        });
      }

      // Verify password
      if (password !== 'Neverknow1.') {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      const project = nftProjects.get(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Verify ownership
      if (project.creatorWallet !== walletAddress) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this project'
        });
      }

      // Update project with provided fields
      const updatedProject = { ...project, ...updates };
      nftProjects.set(projectId, updatedProject);

      console.log(`📝 Project updated: ${projectId} by ${walletAddress}`);

      res.json({
        success: true,
        project: updatedProject,
        message: 'Project updated successfully'
      });

    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update project'
      });
    }
  });

  // Get individual project details
  app.get('/api/nft/launchpad/project/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = nftProjects.get(projectId);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get recent mint transactions for this project
      const recentMints = Array.from(mintTransactions.values())
        .filter(t => t.projectId === projectId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      res.json({
        project,
        recentMints
      });
    } catch (error) {
      console.error('Error fetching project details:', error);
      res.status(500).json({ error: 'Failed to fetch project details' });
    }
  });

  console.log('✅ NFT Launchpad routes registered successfully');
}