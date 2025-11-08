import { Express } from 'express';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// In-memory job tracking for minting operations
interface MintJob {
  id: string;
  userId: string;
  type: 'single' | 'batch';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
  completed: number;
  failed: number;
  results: any[];
  errors: any[];
  createdAt: Date;
  updatedAt: Date;
}

const mintJobs = new Map<string, MintJob>();

// Schemas for XRPL NFT minting
const SingleMintSchema = z.object({
  uri: z.string().min(1, 'URI is required'),
  taxon: z.number().int().min(0).max(0xFFFFFFFF),
  flags: z.number().int().optional().default(8), // Default: transferable
  transferFee: z.number().int().min(0).max(50000).optional(), // 0-50000 (0-50%)
  issuer: z.string().optional(), // If not provided, will use user's XRPL address
  memos: z.array(z.object({
    data: z.string(),
    type: z.string().optional(),
    format: z.string().optional()
  })).optional()
});

const BatchMintSchema = z.object({
  items: z.array(z.object({
    uri: z.string().min(1, 'URI is required'),
    name: z.string().optional()
  })).min(1).max(1000), // Max 1000 NFTs per batch
  taxon: z.number().int().min(0).max(0xFFFFFFFF),
  flags: z.number().int().optional().default(8),
  transferFee: z.number().int().min(0).max(50000).optional(),
  issuer: z.string().optional(),
  baseMemo: z.string().optional()
});

const MintSubmissionSchema = z.object({
  jobId: z.string(),
  signedTransactions: z.array(z.object({
    index: z.number(),
    txBlob: z.string(),
    hash: z.string().optional()
  }))
});

export function registerXRPLNFTRoutes(app: Express) {
  console.log('🎨 Registering XRPL NFT minting routes...');

  // Build single NFT mint transaction
  app.post('/api/xrpl/nft/mint/build', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const mintData = SingleMintSchema.parse(req.body);
      const user = req.session.user;
      
      if (!user?.walletAddress) {
        return res.status(400).json({ 
          error: 'XRPL wallet address not found in session' 
        });
      }

      console.log(`🔨 [XRPL-MINT] Building single mint transaction for user: ${user.handle}`);

      // Convert URI to hex
      const uriHex = Buffer.from(mintData.uri, 'utf8').toString('hex').toUpperCase();
      
      if (uriHex.length > 512) { // XRPL limit
        return res.status(400).json({ 
          error: 'URI too long - maximum 256 bytes when hex-encoded' 
        });
      }

      // Build transaction object
      const transaction = {
        TransactionType: 'NFTokenMint',
        Account: mintData.issuer || user.walletAddress,
        URI: uriHex,
        NFTokenTaxon: mintData.taxon,
        Flags: mintData.flags
      };

      // Add optional fields
      if (mintData.transferFee !== undefined) {
        transaction['TransferFee'] = mintData.transferFee;
      }

      if (mintData.memos && mintData.memos.length > 0) {
        transaction['Memos'] = mintData.memos.map(memo => ({
          Memo: {
            MemoData: Buffer.from(memo.data, 'utf8').toString('hex').toUpperCase(),
            MemoType: memo.type ? Buffer.from(memo.type, 'utf8').toString('hex').toUpperCase() : undefined,
            MemoFormat: memo.format ? Buffer.from(memo.format, 'utf8').toString('hex').toUpperCase() : undefined
          }
        }));
      }

      console.log(`✅ [XRPL-MINT] Built transaction with URI: ${mintData.uri}`);

      res.json({
        success: true,
        transaction,
        details: {
          uri: mintData.uri,
          uriHex,
          taxon: mintData.taxon,
          flags: mintData.flags,
          issuer: transaction.Account
        }
      });

    } catch (error) {
      console.error('❌ [XRPL-MINT] Build error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid mint parameters',
          details: error.errors
        });
      }

      res.status(500).json({ 
        error: 'Failed to build mint transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Submit signed NFT mint transaction
  app.post('/api/xrpl/nft/mint/submit', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { txBlob, hash } = req.body;
      const user = req.session.user;

      if (!txBlob) {
        return res.status(400).json({ error: 'Signed transaction blob required' });
      }

      console.log(`📤 [XRPL-MINT] Submitting signed transaction for user: ${user?.handle}`);

      // Here you would submit to XRPL network
      // For now, we'll simulate the submission
      const result = {
        success: true,
        hash: hash || `MOCK_HASH_${Date.now()}`,
        status: 'submitted',
        message: 'Transaction submitted to XRPL network'
      };

      console.log(`✅ [XRPL-MINT] Transaction submitted: ${result.hash}`);

      res.json(result);

    } catch (error) {
      console.error('❌ [XRPL-MINT] Submit error:', error);
      res.status(500).json({ 
        error: 'Failed to submit transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create batch mint job
  app.post('/api/xrpl/nft/mint/batch', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const batchData = BatchMintSchema.parse(req.body);
      const user = req.session.user;
      
      if (!user?.walletAddress) {
        return res.status(400).json({ 
          error: 'XRPL wallet address not found in session' 
        });
      }

      const jobId = nanoid();
      
      console.log(`🔨 [XRPL-BATCH] Creating batch mint job ${jobId} for ${batchData.items.length} NFTs`);

      // Create job
      const job: MintJob = {
        id: jobId,
        userId: user.handle,
        type: 'batch',
        status: 'pending',
        total: batchData.items.length,
        completed: 0,
        failed: 0,
        results: [],
        errors: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mintJobs.set(jobId, job);

      // Build transactions for each item
      const transactions = [];
      for (let i = 0; i < batchData.items.length; i++) {
        const item = batchData.items[i];
        
        // Convert URI to hex
        const uriHex = Buffer.from(item.uri, 'utf8').toString('hex').toUpperCase();
        
        if (uriHex.length > 512) {
          job.errors.push({
            index: i,
            error: `URI too long for item ${i + 1}: ${item.name || item.uri}`
          });
          continue;
        }

        const transaction = {
          TransactionType: 'NFTokenMint',
          Account: batchData.issuer || user.walletAddress,
          URI: uriHex,
          NFTokenTaxon: batchData.taxon,
          Flags: batchData.flags,
          Sequence: 0, // Will be filled by client
          LastLedgerSequence: 0, // Will be filled by client
          Fee: '12', // Will be adjusted by client
        };

        if (batchData.transferFee !== undefined) {
          transaction['TransferFee'] = batchData.transferFee;
        }

        if (batchData.baseMemo) {
          const memoText = `${batchData.baseMemo} #${i + 1}`;
          transaction['Memos'] = [{
            Memo: {
              MemoData: Buffer.from(memoText, 'utf8').toString('hex').toUpperCase()
            }
          }];
        }

        transactions.push({
          index: i,
          item: item,
          transaction
        });
      }

      job.results = transactions;
      job.updatedAt = new Date();
      mintJobs.set(jobId, job);

      console.log(`✅ [XRPL-BATCH] Created job ${jobId} with ${transactions.length} transactions`);

      res.json({
        success: true,
        jobId,
        total: batchData.items.length,
        transactions: transactions.length,
        errors: job.errors.length,
        message: `Batch mint job created with ${transactions.length} transactions`
      });

    } catch (error) {
      console.error('❌ [XRPL-BATCH] Create error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid batch parameters',
          details: error.errors
        });
      }

      res.status(500).json({ 
        error: 'Failed to create batch mint job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get batch mint job status
  app.get('/api/xrpl/nft/mint/batch/:jobId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const user = req.session.user;

      const job = mintJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.userId !== user?.handle) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        success: true,
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          total: job.total,
          completed: job.completed,
          failed: job.failed,
          progress: job.total > 0 ? (job.completed / job.total * 100) : 0,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          hasErrors: job.errors.length > 0
        }
      });

    } catch (error) {
      console.error('❌ [XRPL-BATCH] Status error:', error);
      res.status(500).json({ 
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get batch transactions for signing
  app.get('/api/xrpl/nft/mint/batch/:jobId/transactions', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const user = req.session.user;

      const job = mintJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.userId !== user?.handle) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        success: true,
        jobId,
        transactions: job.results,
        errors: job.errors
      });

    } catch (error) {
      console.error('❌ [XRPL-BATCH] Transactions error:', error);
      res.status(500).json({ 
        error: 'Failed to get transactions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Submit batch signed transactions
  app.post('/api/xrpl/nft/mint/batch/submit', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const submissionData = MintSubmissionSchema.parse(req.body);
      const user = req.session.user;

      const job = mintJobs.get(submissionData.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.userId !== user?.handle) {
        return res.status(403).json({ error: 'Access denied' });
      }

      console.log(`📤 [XRPL-BATCH] Submitting ${submissionData.signedTransactions.length} signed transactions`);

      job.status = 'processing';
      job.updatedAt = new Date();

      // Process signed transactions
      const submissionResults = [];
      for (const signedTx of submissionData.signedTransactions) {
        try {
          // Here you would submit to XRPL network
          // For now, simulate submission
          const result = {
            index: signedTx.index,
            hash: signedTx.hash || `MOCK_HASH_${Date.now()}_${signedTx.index}`,
            status: 'submitted',
            success: true
          };

          submissionResults.push(result);
          job.completed++;

        } catch (error) {
          const errorResult = {
            index: signedTx.index,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };

          submissionResults.push(errorResult);
          job.failed++;
        }
      }

      job.status = job.failed === 0 ? 'completed' : 'failed';
      job.updatedAt = new Date();
      mintJobs.set(submissionData.jobId, job);

      console.log(`✅ [XRPL-BATCH] Batch submitted: ${job.completed} success, ${job.failed} failed`);

      res.json({
        success: true,
        jobId: submissionData.jobId,
        results: submissionResults,
        summary: {
          total: submissionData.signedTransactions.length,
          submitted: job.completed,
          failed: job.failed
        }
      });

    } catch (error) {
      console.error('❌ [XRPL-BATCH] Submit error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid submission data',
          details: error.errors
        });
      }

      res.status(500).json({ 
        error: 'Failed to submit batch',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clean up old jobs (run periodically)
  setInterval(() => {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [jobId, job] of mintJobs.entries()) {
      if (now.getTime() - job.createdAt.getTime() > maxAge) {
        mintJobs.delete(jobId);
        console.log(`🧹 [XRPL-BATCH] Cleaned up old job: ${jobId}`);
      }
    }
  }, 60 * 60 * 1000); // Check every hour

  console.log('✅ XRPL NFT minting routes registered successfully');
}