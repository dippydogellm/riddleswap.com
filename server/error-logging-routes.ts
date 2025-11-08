import { Router } from 'express';
import { z } from 'zod';
import { db } from './db';
import { errorLogs } from '../shared/schema';
import { eq, desc, and, gte, lte, ilike, count } from 'drizzle-orm';

export const errorLoggingRoutes = Router();

// Validation schemas
const logErrorSchema = z.object({
  error_message: z.string().min(1).max(1000),
  stack_trace: z.string().optional(),
  component_stack: z.string().optional(),
  page_url: z.string().url(),
  user_agent: z.string().optional(),
  error_type: z.enum(['react_error', 'api_error', 'network_error', 'validation_error', 'auth_error']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  component_name: z.string().optional(),
  api_endpoint: z.string().optional(),
  browser_info: z.record(z.any()).optional(),
  error_context: z.record(z.any()).optional()
});

const reportErrorSchema = z.object({
  description: z.string().min(1).max(2000),
  reproductionSteps: z.string().max(2000).optional(),
  expectedBehavior: z.string().max(1000).optional(),
  actualBehavior: z.string().max(1000).optional(),
  contact: z.string().email().optional(),
  errorDetails: z.record(z.any()).optional(),
  timestamp: z.string(),
  url: z.string().url(),
  userAgent: z.string().optional()
});

const updateErrorSchema = z.object({
  resolved: z.boolean().optional(),
  resolution_notes: z.string().max(1000).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

// Log error endpoint (public - doesn't require authentication to avoid blocking error logging)
errorLoggingRoutes.post('/log', async (req, res) => {
  try {
    const validatedData = logErrorSchema.parse(req.body);
    
    // Get user info from session if available (optional)
    let userInfo = {};
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (sessionToken) {
      try {
        // Try to get user info but don't fail if we can't
        // This is optional context, not required
        const sessionKey = `session:${sessionToken}`;
        // Add user context if available, but don't block error logging
        userInfo = {
          user_id: 'unknown', // We'll implement this if needed
          user_handle: 'unknown'
        };
      } catch {
        // Ignore session errors - we don't want error logging to fail due to auth issues
      }
    }

    const errorLogData = {
      ...validatedData,
      ...userInfo,
      created_at: new Date()
    };

    const result = await db.insert(errorLogs).values(errorLogData as any).returning();
    
    console.log('Error logged:', {
      id: result[0].id,
      type: validatedData.error_type,
      severity: validatedData.severity,
      message: validatedData.error_message.substring(0, 100)
    });

    res.status(201).json({
      success: true,
      errorId: result[0].id,
      message: 'Error logged successfully'
    });
  } catch (error) {
    console.error('Failed to log error:', error);
    // Return success even if logging fails - we don't want to break the user's experience
    res.status(200).json({
      success: false,
      message: 'Error logging failed, but your session is safe'
    });
  }
});

// Report error endpoint (public - for user reports)
errorLoggingRoutes.post('/report', async (req, res) => {
  try {
    const validatedData = reportErrorSchema.parse(req.body);
    
    // Create an error log entry for the user report
    const errorLogData = {
      error_message: `User Report: ${validatedData.description}`,
      stack_trace: `User Report Details:\nReproduction Steps: ${validatedData.reproductionSteps || 'Not provided'}\nExpected: ${validatedData.expectedBehavior || 'Not provided'}\nActual: ${validatedData.actualBehavior || 'Not provided'}\nContact: ${validatedData.contact || 'Not provided'}`,
      page_url: validatedData.url,
      user_agent: validatedData.userAgent,
      error_type: 'user_report' as any, // Extend enum for user reports
      severity: 'medium' as const,
      component_name: 'User Report',
      error_context: {
        report_type: 'user_submitted',
        description: validatedData.description,
        reproductionSteps: validatedData.reproductionSteps,
        expectedBehavior: validatedData.expectedBehavior,
        actualBehavior: validatedData.actualBehavior,
        contact: validatedData.contact,
        errorDetails: validatedData.errorDetails,
        submitted_at: validatedData.timestamp
      },
      created_at: new Date()
    };

    const result = await db.insert(errorLogs).values(errorLogData as any).returning();
    
    console.log('User error report submitted:', {
      id: result[0].id,
      description: validatedData.description.substring(0, 100),
      contact: validatedData.contact || 'No contact provided'
    });

    res.status(201).json({
      success: true,
      reportId: result[0].id,
      message: 'Error report submitted successfully'
    });
  } catch (error) {
    console.error('Failed to submit error report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit error report'
    });
  }
});

// Admin endpoints (require authentication)
errorLoggingRoutes.get('/admin/logs', async (req, res) => {
  try {
    // Simple admin check - in a real app you'd have proper role-based auth
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      page = '1',
      limit = '50',
      severity,
      error_type,
      resolved,
      search,
      start_date,
      end_date
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build filters
    const filters = [];
    
    if (severity) {
      filters.push(eq(errorLogs.severity, severity as any));
    }
    
    if (error_type) {
      filters.push(eq(errorLogs.error_type, error_type as any));
    }
    
    if (resolved !== undefined) {
      filters.push(eq(errorLogs.resolved, resolved === 'true'));
    }
    
    if (search) {
      filters.push(ilike(errorLogs.error_message, `%${search}%`));
    }
    
    if (start_date) {
      filters.push(gte(errorLogs.created_at, new Date(start_date)));
    }
    
    if (end_date) {
      filters.push(lte(errorLogs.created_at, new Date(end_date)));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(errorLogs)
      .where(filters.length > 0 ? and(...filters) : undefined);

    // Get paginated results
    const logs = await db
      .select()
      .from(errorLogs)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(errorLogs.created_at))
      .limit(limitNum)
      .offset(offset);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limitNum)
      }
    });
  } catch (error) {
    console.error('Failed to fetch error logs:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Get error log details
errorLoggingRoutes.get('/admin/logs/:id', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    const [errorLog] = await db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.id, id));

    if (!errorLog) {
      return res.status(404).json({ error: 'Error log not found' });
    }

    res.json(errorLog);
  } catch (error) {
    console.error('Failed to fetch error log:', error);
    res.status(500).json({ error: 'Failed to fetch error log' });
  }
});

// Update error log (mark as resolved, add notes, etc.)
errorLoggingRoutes.patch('/admin/logs/:id', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const validatedData = updateErrorSchema.parse(req.body);

    const updateData: any = { ...validatedData };
    
    if (validatedData.resolved === true && !updateData.resolved_at) {
      updateData.resolved_at = new Date();
    }

    const [updatedLog] = await db
      .update(errorLogs)
      .set(updateData)
      .where(eq(errorLogs.id, id))
      .returning();

    if (!updatedLog) {
      return res.status(404).json({ error: 'Error log not found' });
    }

    res.json({
      success: true,
      message: 'Error log updated successfully',
      log: updatedLog
    });
  } catch (error) {
    console.error('Failed to update error log:', error);
    res.status(500).json({ error: 'Failed to update error log' });
  }
});

// Get error statistics
errorLoggingRoutes.get('/admin/stats', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { days = '7' } = req.query as Record<string, string>;
    const daysNum = parseInt(days);
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // Get total counts
    const [totalCount] = await db
      .select({ count: count() })
      .from(errorLogs);

    const [recentCount] = await db
      .select({ count: count() })
      .from(errorLogs)
      .where(gte(errorLogs.created_at, since));

    const [unresolvedCount] = await db
      .select({ count: count() })
      .from(errorLogs)
      .where(eq(errorLogs.resolved, false));

    // Get counts by severity
    const severityCounts = await db
      .select({
        severity: errorLogs.severity,
        count: count()
      })
      .from(errorLogs)
      .where(gte(errorLogs.created_at, since))
      .groupBy(errorLogs.severity);

    // Get counts by error type
    const typeCounts = await db
      .select({
        error_type: errorLogs.error_type,
        count: count()
      })
      .from(errorLogs)
      .where(gte(errorLogs.created_at, since))
      .groupBy(errorLogs.error_type);

    res.json({
      total: totalCount.count,
      recent: recentCount.count,
      unresolved: unresolvedCount.count,
      bySevetiry: severityCounts,
      byType: typeCounts,
      period: `Last ${daysNum} days`
    });
  } catch (error) {
    console.error('Failed to fetch error statistics:', error);
    res.status(500).json({ error: 'Failed to fetch error statistics' });
  }
});

export default errorLoggingRoutes;