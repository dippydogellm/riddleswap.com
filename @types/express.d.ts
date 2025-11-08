import 'express';

// Consolidated user interface for authenticated requests
interface AuthenticatedUser {
  id: string;
  handle: string;
  userHandle: string;
  walletAddress: string;
}

// Extended user interface with normalized user from unified auth
interface NormalizedUser {
  handle: string;
  walletAddress: string;
  source: 'session' | 'wallet';
}

// Extended interface for authenticated requests
interface ExtendedRequest extends Express.Request {
  user?: AuthenticatedUser;
  normalizedUser?: NormalizedUser;
  session?: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      normalizedUser?: NormalizedUser;
      session?: any; // For payment endpoints and wallet operations
    }
  }
}