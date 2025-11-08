import type { Request, Response, NextFunction } from 'express';

// Generic error responses to prevent information disclosure
export const GENERIC_ERRORS = {
  AUTHENTICATION_FAILED: 'Authentication failed',
  INVALID_REQUEST: 'Invalid request',
  SERVER_ERROR: 'Internal server error',
  RATE_LIMITED: 'Too many requests',
  VALIDATION_FAILED: 'Request validation failed',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found'
} as const;

type ErrorType = keyof typeof GENERIC_ERRORS;

// Audit logging function
export const auditLog = (req: Request, action: string, success: boolean, details?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    action,
    success,
    details: success ? null : (typeof details === 'string' ? details : JSON.stringify(details)),
    path: req.path,
    method: req.method,
    handle: req.body?.handle || 'unknown'
  };
  
  // Log to console - in production, send to secure logging service
  const logLevel = success ? 'INFO' : 'WARN';

  // In production, also send to security monitoring service
  if (process.env.NODE_ENV === 'production' && !success) {
    // TODO: Send to security monitoring service (e.g., Datadog, Splunk)
  }
};

// Generic error response function
export const sendGenericError = (
  res: Response,
  req: Request,
  statusCode: number,
  errorType: ErrorType,
  internalDetails?: any
) => {
  // Log detailed error internally
  auditLog(req, errorType.toLowerCase(), false, internalDetails);

  const isProd = process.env.NODE_ENV === 'production';
  const requestId = (req.headers['x-request-id'] as string) || (res.getHeader('X-Request-Id') as string) || undefined;

  // Send standardized response to client
  const body: any = {
    success: false,
    error: GENERIC_ERRORS[errorType],
    timestamp: new Date().toISOString(),
  };
  if (requestId) body.requestId = requestId;
  if (!isProd && internalDetails) body.details = typeof internalDetails === 'string' ? internalDetails : JSON.stringify(internalDetails);

  res.status(statusCode).json(body);
};

// Global error handler middleware
export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  auditLog(req, 'unhandled_error', false, error?.message || String(error));

  if (res.headersSent) return next(error);

  // Handle common known cases before defaulting
  if (error?.type === 'entity.parse.failed') {
    return sendGenericError(res, req, 400, 'INVALID_REQUEST', 'Invalid JSON in request body');
  }
  if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
    return sendGenericError(res, req, 503, 'SERVER_ERROR', 'External service unavailable');
  }

  // Default
  sendGenericError(res, req, 500, 'SERVER_ERROR', error?.stack || error?.message || 'Internal error');
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  sendGenericError(res, req, 404, 'NOT_FOUND', `Route ${req.path} not found`);
};