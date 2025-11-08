import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
// Import will be added after errorHandler is implemented

// Validation middleware
export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {

        return res.status(400).json({
          error: 'Request validation failed',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      req.body = result.data;
      next();
    } catch (error) {

      res.status(400).json({ error: 'Request validation failed' });
    }
  };
};

// Sanitize string inputs to prevent XSS
export const sanitizeStrings = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Basic XSS prevention - remove script tags and normalize
      return obj.trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .slice(0, 1000); // Limit length
    }
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      const sanitized: any = {};
      Object.keys(obj).forEach(key => {
        sanitized[key] = sanitize(obj[key]);
      });
      return sanitized;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    }
    return obj;
  };
  
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

// Validate request size
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = req.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit

    return res.status(413).json({ error: 'Request too large' });
  }
  next();
};