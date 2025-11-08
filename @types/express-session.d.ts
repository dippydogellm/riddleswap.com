import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      handle: string;
      addresses: {
        eth: string;
        xrp: string;
        sol: string;
        btc: string;
      };
    };
  }
}

// Note: Express Request interface is extended in @types/express.d.ts to avoid conflicts