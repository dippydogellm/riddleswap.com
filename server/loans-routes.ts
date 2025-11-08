import { Router } from 'express';
import { db } from './db';
import { 
  loans, loanEvents, bankWallets, messagingLinks,
  type Loan, type LoanEvent, type InsertLoan, type InsertLoanEvent
} from '../shared/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { validateSession } from './middleware/security';

const router = Router();

// Input validation schemas
const createLoanSchema = z.object({
  chain: z.string().min(1),
  principalToken: z.string().min(1),
  principalAmount: z.string().min(1),
  interestRate: z.string().min(0.1).max(100),
  durationDays: z.number().min(1).max(365),
  nftChain: z.string().min(1),
  nftContract: z.string().min(1),
  nftTokenId: z.string().min(1),
  nftEstimatedValue: z.string().optional(),
  description: z.string().optional()
});

const fundLoanSchema = z.object({
  loanId: z.string().min(1),
  fundingTransactionHash: z.string().min(1)
});

const repayLoanSchema = z.object({
  loanId: z.string().min(1),
  amount: z.string().min(1),
  repaymentTransactionHash: z.string().min(1)
});

const liquidateLoanSchema = z.object({
  loanId: z.string().min(1),
  liquidationTransactionHash: z.string().min(1)
});

// ============== LOAN MARKETPLACE ==============

// GET /api/loans - Get loan listings with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, chain, borrower, lender, limit = 50 } = req.query;
    console.log(`💰 [LOANS] Fetching loans with filters:`, { status, chain, borrower, lender, limit });

    let query = db
      .select()
      .from(loans)
      .orderBy(desc(loans.createdAt));

    // Apply filters
    const conditions = [];
    
    if (status && typeof status === 'string') {
      conditions.push(eq(loans.status, status));
    }
    
    if (chain && typeof chain === 'string') {
      conditions.push(eq(loans.chain, chain));
    }
    
    if (borrower && typeof borrower === 'string') {
      conditions.push(eq(loans.borrowerHandle, borrower));
    }
    
    if (lender && typeof lender === 'string') {
      conditions.push(eq(loans.lenderHandle, lender));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const loanLimit = Math.min(parseInt(limit as string) || 50, 100);
    const allLoans = await query.limit(loanLimit);

    // Enhance loans with calculated fields
    const enhancedLoans = allLoans.map(loan => {
      const now = new Date();
      const principal = parseFloat(loan.principalAmount);
      const rate = parseFloat(loan.interestRate);
      const totalRepayment = principal * (1 + (rate / 100) * (loan.durationDays / 365));
      
      let daysRemaining = 0;
      if (loan.dueAt) {
        daysRemaining = Math.max(0, Math.ceil((loan.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const isOverdue = loan.dueAt && now > loan.dueAt && loan.status === 'active';
      
      return {
        ...loan,
        totalRepaymentAmount: totalRepayment.toFixed(8),
        daysRemaining,
        isOverdue: !!isOverdue,
        interestAmount: (totalRepayment - principal).toFixed(8)
      };
    });

    console.log(`✅ [LOANS] Retrieved ${allLoans.length} loans`);
    res.json({
      success: true,
      loans: enhancedLoans
    });

  } catch (error) {
    console.error('❌ [LOANS] Error fetching loans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loans'
    });
  }
});

// GET /api/loans/:id - Get specific loan details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`💰 [LOAN DETAIL] Fetching loan: ${id}`);

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id));

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    // Get loan events history
    const events = await db
      .select()
      .from(loanEvents)
      .where(eq(loanEvents.loanId, id))
      .orderBy(desc(loanEvents.createdAt));

    // Calculate loan details
    const principal = parseFloat(loan.principalAmount);
    const rate = parseFloat(loan.interestRate);
    const totalRepayment = principal * (1 + (rate / 100) * (loan.durationDays / 365));
    
    let daysRemaining = 0;
    if (loan.dueAt) {
      daysRemaining = Math.max(0, Math.ceil((loan.dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    const enhancedLoan = {
      ...loan,
      totalRepaymentAmount: totalRepayment.toFixed(8),
      interestAmount: (totalRepayment - principal).toFixed(8),
      daysRemaining,
      isOverdue: loan.dueAt && new Date() > loan.dueAt && loan.status === 'active',
      events
    };

    console.log(`✅ [LOAN DETAIL] Retrieved loan details`);
    res.json({
      success: true,
      loan: enhancedLoan
    });

  } catch (error) {
    console.error('❌ [LOAN DETAIL] Error fetching loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loan details'
    });
  }
});

// POST /api/loans - Create new loan listing
router.post('/', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('💰 [CREATE LOAN] Creating new loan listing');

    const validation = createLoanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid loan data',
        details: validation.error.errors
      });
    }

    const {
      chain, principalToken, principalAmount, interestRate,
      durationDays, nftChain, nftContract, nftTokenId,
      nftEstimatedValue, description
    } = validation.data;

    // Get user handle from session
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(db.riddleWalletSessions.sessionToken, sessionToken),
      with: { wallet: true }
    });

    if (!sessionResult?.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const borrowerHandle = sessionResult.wallet.handle;
    const borrowerWallet = sessionResult.wallet.xrpAddress || sessionResult.wallet.ethAddress || '';

    // Calculate origination fee (5% of principal)
    const principal = parseFloat(principalAmount);
    const originationFee = principal * 0.05; // 5% fee

    // Get available bank wallet for NFT escrow
    const [availableBankWallet] = await db
      .select()
      .from(bankWallets)
      .where(
        and(
          eq(bankWallets.chain, nftChain),
          eq(bankWallets.isActive, true)
        )
      )
      .limit(1);

    if (!availableBankWallet) {
      return res.status(500).json({
        success: false,
        error: 'No escrow wallet available for this chain'
      });
    }

    const loanData: InsertLoan = {
      borrowerHandle,
      borrowerWallet,
      chain,
      principalToken,
      principalAmount,
      interestRate,
      durationDays,
      originationFeePct: '5.0',
      originationFeeAmount: originationFee.toString(),
      nftChain,
      nftContract,
      nftTokenId,
      nftEstimatedValue: nftEstimatedValue || '0',
      status: 'listed',
      escrowRef: availableBankWallet.id
    };

    await db.transaction(async (tx) => {
      // Create the loan
      const [loan] = await tx
        .insert(loans)
        .values(loanData as any)
        .returning();

      // Create loan event
      const eventData: InsertLoanEvent = {
        loanId: loan.id,
        eventType: 'listed',
        eventDescription: `Loan listed for ${principalAmount} ${principalToken}`,
        userHandle: borrowerHandle,
        eventData: {
          nftContract,
          nftTokenId,
          nftChain,
          description
        }
      };

      await tx
        .insert(loanEvents)
        .values(eventData as any);

      // Create messaging link for this loan
      await tx
        .insert(messagingLinks)
        .values({
          targetType: 'loan',
          targetId: loan.id,
          ownerHandle: borrowerHandle,
          ownerWallet: borrowerWallet,
          title: `Loan: ${principalAmount} ${principalToken}`,
          description: `NFT Collateral: ${nftContract}#${nftTokenId}`
        } as any);

      console.log(`✅ [CREATE LOAN] Created loan: ${loan.id}`);
      return loan;
    });

    res.status(201).json({
      success: true,
      message: 'Loan created successfully'
    });

  } catch (error) {
    console.error('❌ [CREATE LOAN] Error creating loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create loan'
    });
  }
});

// POST /api/loans/:id/fund - Fund a loan (lender action)
router.post('/:id/fund', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    console.log(`💰 [FUND LOAN] Funding loan: ${id}`);

    const validation = fundLoanSchema.safeParse({ loanId: id, ...req.body });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid funding data',
        details: validation.error.errors
      });
    }

    const { fundingTransactionHash } = validation.data;

    // Get user handle from session
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(db.riddleWalletSessions.sessionToken, sessionToken),
      with: { wallet: true }
    });

    if (!sessionResult?.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const lenderHandle = sessionResult.wallet.handle;
    const lenderWallet = sessionResult.wallet.xrpAddress || sessionResult.wallet.ethAddress || '';

    // Get the loan
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id));

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    if (loan.status !== 'listed') {
      return res.status(400).json({
        success: false,
        error: 'Loan is not available for funding'
      });
    }

    if (loan.borrowerHandle === lenderHandle) {
      return res.status(400).json({
        success: false,
        error: 'Cannot fund your own loan'
      });
    }

    // Calculate loan terms
    const principal = parseFloat(loan.principalAmount);
    const rate = parseFloat(loan.interestRate);
    const totalRepayment = principal * (1 + (rate / 100) * (loan.durationDays / 365));
    const startDate = new Date();
    const dueDate = new Date(startDate.getTime() + loan.durationDays * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      // Update loan with lender and timing
      await tx
        .update(loans)
        .set({ 
          lenderHandle,
          lenderWallet,
          status: 'funded',
          fundedAt: startDate,
          startedAt: startDate,
          dueAt: dueDate,
          totalRepaymentAmount: totalRepayment.toString(),
          fundingTransactionHash,
          updatedAt: new Date()
         } as any)
        .where(eq(loans.id, id));

      // Create loan event
      const eventData: InsertLoanEvent = {
        loanId: id,
        eventType: 'funded',
        eventDescription: `Loan funded by ${lenderHandle}`,
        amount: loan.principalAmount,
        transactionHash: fundingTransactionHash,
        userHandle: lenderHandle,
        eventData: {
          dueDate: dueDate.toISOString(),
          totalRepayment: totalRepayment.toString()
        }
      };

      await tx
        .insert(loanEvents)
        .values(eventData as any);

      console.log(`✅ [FUND LOAN] Loan funded: ${id} by ${lenderHandle}`);
    });

    res.json({
      success: true,
      message: 'Loan funded successfully',
      dueDate,
      totalRepayment: totalRepayment.toString()
    });

  } catch (error) {
    console.error('❌ [FUND LOAN] Error funding loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fund loan'
    });
  }
});

// POST /api/loans/:id/repay - Repay a loan (borrower action)
router.post('/:id/repay', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    console.log(`💰 [REPAY LOAN] Repaying loan: ${id}`);

    const validation = repayLoanSchema.safeParse({ loanId: id, ...req.body });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid repayment data',
        details: validation.error.errors
      });
    }

    const { amount, repaymentTransactionHash } = validation.data;

    // Get user handle from session
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(db.riddleWalletSessions.sessionToken, sessionToken),
      with: { wallet: true }
    });

    if (!sessionResult?.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = sessionResult.wallet.handle;

    // Get the loan
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id));

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    if (loan.borrowerHandle !== userHandle) {
      return res.status(403).json({
        success: false,
        error: 'Only the borrower can repay this loan'
      });
    }

    if (loan.status !== 'funded' && loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Loan is not in a repayable state'
      });
    }

    const repayAmount = parseFloat(amount);
    const currentlyOwed = parseFloat(loan.totalRepaymentAmount || '0');
    const alreadyPaid = parseFloat(loan.amountRepaid);
    const remainingOwed = currentlyOwed - alreadyPaid;

    if (repayAmount > remainingOwed) {
      return res.status(400).json({
        success: false,
        error: 'Repayment amount exceeds remaining debt'
      });
    }

    const newAmountRepaid = alreadyPaid + repayAmount;
    const isFullyRepaid = newAmountRepaid >= currentlyOwed;

    await db.transaction(async (tx) => {
      // Update loan repayment
      await tx
        .update(loans)
        .set({ 
          amountRepaid: newAmountRepaid.toString(),
          status: isFullyRepaid ? 'repaid' : 'active',
          repaymentTransactionHash: isFullyRepaid ? repaymentTransactionHash : loan.repaymentTransactionHash,
          completedAt: isFullyRepaid ? new Date() : undefined,
          updatedAt: new Date()
         } as any)
        .where(eq(loans.id, id));

      // Create loan event
      const eventData: InsertLoanEvent = {
        loanId: id,
        eventType: isFullyRepaid ? 'repaid' : 'partial_repayment',
        eventDescription: `${isFullyRepaid ? 'Full' : 'Partial'} repayment of ${repayAmount}`,
        amount,
        transactionHash: repaymentTransactionHash,
        userHandle,
        eventData: {
          totalRepaid: newAmountRepaid.toString(),
          remainingDebt: isFullyRepaid ? '0' : (remainingOwed - repayAmount).toString()
        }
      };

      await tx
        .insert(loanEvents)
        .values(eventData as any);

      console.log(`✅ [REPAY LOAN] ${isFullyRepaid ? 'Full' : 'Partial'} repayment: ${id}`);
    });

    res.json({
      success: true,
      message: isFullyRepaid ? 'Loan fully repaid' : 'Partial payment recorded',
      amountRepaid: newAmountRepaid.toString(),
      remainingDebt: isFullyRepaid ? '0' : (remainingOwed - repayAmount).toString(),
      isFullyRepaid
    });

  } catch (error) {
    console.error('❌ [REPAY LOAN] Error repaying loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to repay loan'
    });
  }
});

// POST /api/loans/:id/liquidate - Liquidate an overdue loan (lender action)
router.post('/:id/liquidate', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    console.log(`💰 [LIQUIDATE LOAN] Liquidating loan: ${id}`);

    const validation = liquidateLoanSchema.safeParse({ loanId: id, ...req.body });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid liquidation data',
        details: validation.error.errors
      });
    }

    const { liquidationTransactionHash } = validation.data;

    // Get user handle from session
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(db.riddleWalletSessions.sessionToken, sessionToken),
      with: { wallet: true }
    });

    if (!sessionResult?.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = sessionResult.wallet.handle;

    // Get the loan
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id));

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    if (loan.lenderHandle !== userHandle) {
      return res.status(403).json({
        success: false,
        error: 'Only the lender can liquidate this loan'
      });
    }

    if (loan.status !== 'active' && loan.status !== 'funded') {
      return res.status(400).json({
        success: false,
        error: 'Loan is not in a liquidatable state'
      });
    }

    // Check if loan is actually overdue
    if (!loan.dueAt || new Date() <= loan.dueAt) {
      return res.status(400).json({
        success: false,
        error: 'Loan is not overdue yet'
      });
    }

    await db.transaction(async (tx) => {
      // Update loan status to liquidated
      await tx
        .update(loans)
        .set({ 
          status: 'liquidated',
          liquidationTransactionHash,
          completedAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(loans.id, id));

      // Create loan event
      const eventData: InsertLoanEvent = {
        loanId: id,
        eventType: 'liquidated',
        eventDescription: `Loan liquidated due to default`,
        transactionHash: liquidationTransactionHash,
        userHandle,
        eventData: {
          daysOverdue: Math.ceil((Date.now() - loan.dueAt!.getTime()) / (1000 * 60 * 60 * 24)),
          nftContract: loan.nftContract,
          nftTokenId: loan.nftTokenId
        }
      };

      await tx
        .insert(loanEvents)
        .values(eventData as any);

      console.log(`✅ [LIQUIDATE LOAN] Loan liquidated: ${id}`);
    });

    res.json({
      success: true,
      message: 'Loan liquidated successfully'
    });

  } catch (error) {
    console.error('❌ [LIQUIDATE LOAN] Error liquidating loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to liquidate loan'
    });
  }
});

// POST /api/loans/:id/cancel - Cancel a loan listing (borrower action)
router.post('/:id/cancel', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    console.log(`💰 [CANCEL LOAN] Cancelling loan: ${id}`);

    // Get user handle from session
    const sessionResult = await db.query.riddleWalletSessions.findFirst({
      where: eq(db.riddleWalletSessions.sessionToken, sessionToken),
      with: { wallet: true }
    });

    if (!sessionResult?.wallet) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = sessionResult.wallet.handle;

    // Get the loan
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id));

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    if (loan.borrowerHandle !== userHandle) {
      return res.status(403).json({
        success: false,
        error: 'Only the borrower can cancel this loan'
      });
    }

    if (loan.status !== 'listed') {
      return res.status(400).json({
        success: false,
        error: 'Only listed loans can be cancelled'
      });
    }

    await db.transaction(async (tx) => {
      // Update loan status to cancelled
      await tx
        .update(loans)
        .set({ 
          status: 'cancelled',
          completedAt: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(loans.id, id));

      // Create loan event
      const eventData: InsertLoanEvent = {
        loanId: id,
        eventType: 'cancelled',
        eventDescription: `Loan listing cancelled by borrower`,
        userHandle,
        eventData: {
          reason: 'borrower_cancelled'
        }
      };

      await tx
        .insert(loanEvents)
        .values(eventData as any);

      console.log(`✅ [CANCEL LOAN] Loan cancelled: ${id}`);
    });

    res.json({
      success: true,
      message: 'Loan cancelled successfully'
    });

  } catch (error) {
    console.error('❌ [CANCEL LOAN] Error cancelling loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel loan'
    });
  }
});

// GET /api/loans/stats - Get loan marketplace statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 [LOAN STATS] Fetching loan statistics');

    // Get overall loan stats
    const [overallStats] = await db
      .select({
        totalLoans: sql<number>`count(*)`,
        activeLoans: sql<number>`count(*) filter (where status = 'active' or status = 'funded')`,
        totalVolume: sql<number>`sum(cast(principal_amount as decimal))`,
        averageAPY: sql<number>`avg(cast(interest_rate as decimal))`
      })
      .from(loans);

    // Get loans by status
    const statusStats = await db
      .select({
        status: loans.status,
        count: sql<number>`count(*)`
      })
      .from(loans)
      .groupBy(loans.status);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentActivity] = await db
      .select({
        newLoans: sql<number>`count(*) filter (where created_at >= ${thirtyDaysAgo})`,
        recentVolume: sql<number>`sum(cast(principal_amount as decimal)) filter (where created_at >= ${thirtyDaysAgo})`
      })
      .from(loans);

    // Get overdue loans count
    const [overdueStats] = await db
      .select({
        overdueCount: sql<number>`count(*)`
      })
      .from(loans)
      .where(
        and(
          eq(loans.status, 'active'),
          sql`due_at < now()`
        )
      );

    const stats = {
      totalLoans: overallStats?.totalLoans || 0,
      activeLoans: overallStats?.activeLoans || 0,
      totalVolume: overallStats?.totalVolume || '0',
      averageAPY: overallStats?.averageAPY || '0',
      overdueLoans: overdueStats?.overdueCount || 0,
      recentLoans: recentActivity?.newLoans || 0,
      recentVolume: recentActivity?.recentVolume || '0',
      statusBreakdown: statusStats.reduce((acc, stat) => {
        acc[stat.status] = stat.count;
        return acc;
      }, {} as Record<string, number>)
    };

    console.log('✅ [LOAN STATS] Retrieved statistics');
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ [LOAN STATS] Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loan statistics'
    });
  }
});

export default router;