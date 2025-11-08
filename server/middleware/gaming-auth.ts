// Gaming Authentication Middleware
// Integrates with existing Riddle Wallet and External Wallet authentication systems
// Provides unified player identification for The Trolls Inquisition gaming system

import { Request, Response, NextFunction } from 'express';
import { getActiveSession } from '../riddle-wallet-auth';
import { getExternalWalletSession } from '../auth-routes';
import { gamingStorage } from '../gaming-storage';
import { GamePlayer, GamePlayerWallet } from '../../shared/schema';

// Enhanced request interface with gaming player data
export interface GamingRequest extends Request {
  player?: {
    playerId: string;
    handle?: string;
    userId?: string;
    primaryChain: string;
    primaryAddress: string;
    wallets: Array<{
      chain: string;
      address: string;
      isPrimary: boolean;
    }>;
    isAuthenticated: boolean;
    sessionType: 'riddle' | 'external';
  };
}

// Gaming authentication middleware - integrates with existing auth systems
export async function gamingAuth(req: GamingRequest, res: Response, next: NextFunction) {
  try {
    let playerData: any = null;
    let sessionType: 'riddle' | 'external' = 'riddle';

    // Extract authorization token from headers
    const authHeader = req.headers.authorization;
    
    // First try Bearer token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Try Riddle wallet session authentication
      const riddleSession = getActiveSession(token);
      if (riddleSession) {
        sessionType = 'riddle';
        playerData = {
          handle: riddleSession.handle,
          primaryChain: 'xrpl', // Default to XRPL for Riddle wallets
          primaryAddress: riddleSession.walletData?.xrpAddress,
          wallets: [
            { chain: 'xrpl', address: riddleSession.walletData?.xrpAddress, isPrimary: true },
            { chain: 'ethereum', address: riddleSession.walletData?.ethAddress, isPrimary: false },
            { chain: 'polygon', address: riddleSession.walletData?.ethAddress, isPrimary: false }, // Reuse ETH address for Polygon
            { chain: 'solana', address: riddleSession.walletData?.solAddress, isPrimary: false },
            { chain: 'bitcoin', address: riddleSession.walletData?.btcAddress, isPrimary: false }
          ].filter(w => w.address) // Remove wallets without addresses
        };
      } else {
        // Try external wallet session authentication
        const externalSession = getExternalWalletSession(token);
        if (externalSession) {
          sessionType = 'external';
          playerData = {
            userId: externalSession.userId,
            primaryChain: externalSession.chain === 'ethereum' ? 'ethereum' : 
                          externalSession.chain === 'solana' ? 'solana' : 'xrpl',
            primaryAddress: externalSession.walletAddress,
            wallets: [
              { 
                chain: externalSession.chain === 'eth' ? 'ethereum' : externalSession.chain, 
                address: externalSession.walletAddress, 
                isPrimary: true 
              }
            ]
          };
        }
      }
    }

    // Fallback: Check regular session authentication (cookies)
    if (!playerData) {
      const sessionUser = (req as any).user || (req as any).session?.user;
      if (sessionUser && sessionUser.handle) {
        console.log(`🎮 Gaming auth fallback: Using session for ${sessionUser.handle}`);
        
        // Need to get wallet data from database for session users
        // For now, we'll set up basic player data and get addresses from database lookup
        sessionType = 'riddle';
        playerData = {
          handle: sessionUser.handle,
          primaryChain: 'xrpl', // Default to XRPL for Riddle wallets
          primaryAddress: null, // Will be populated from database
          wallets: [] // Will be populated from database
        };
      }
    }

    if (!playerData) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token or log in via session'
      });
    }


    // Get or create gaming player record
    try {
      let gamePlayer: GamePlayer | null = null;

      // Try to find existing game player
      if (playerData.handle) {
        gamePlayer = await gamingStorage.getGamePlayerByHandle(playerData.handle);
      } else if (playerData.userId) {
        gamePlayer = await gamingStorage.getGamePlayerByUserId(playerData.userId);
      }

      // If player doesn't exist, create new game player
      if (!gamePlayer) {
        const newPlayerData = {
          handle: playerData.handle,
          userId: playerData.userId,
          primaryChain: playerData.primaryChain,
          primaryAddress: playerData.primaryAddress
        };

        gamePlayer = await gamingStorage.createGamePlayer(newPlayerData);

        // Create associated wallet records
        for (const wallet of playerData.wallets) {
          await gamingStorage.createGamePlayerWallet({
            playerId: gamePlayer.id,
            chain: wallet.chain,
            address: wallet.address,
            isPrimary: wallet.isPrimary
          });
        }

        console.log(`🎮 Created new game player: ${gamePlayer.id} (${sessionType} session)`);
      } else {
        // Update last activity for existing player
        await gamingStorage.updateGamePlayerActivity(gamePlayer.id);
      }

      // Populate req.player with unified gaming identity
      req.player = {
        playerId: gamePlayer.id,
        handle: gamePlayer.handle || undefined,
        userId: gamePlayer.userId || undefined,
        primaryChain: gamePlayer.primaryChain,
        primaryAddress: gamePlayer.primaryAddress,
        wallets: playerData.wallets,
        isAuthenticated: true,
        sessionType
      };

      console.log(`🎮 Gaming auth success: Player ${req.player.playerId} (${sessionType})`);
      next();

    } catch (storageError) {
      console.error('🎮 Gaming auth storage error:', storageError);
      return res.status(500).json({
        error: 'Gaming authentication failed',
        message: 'Could not initialize game player data'
      });
    }

  } catch (error) {
    console.error('🎮 Gaming auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
}

// Optional middleware for gaming routes that don't require authentication
export function optionalGamingAuth(req: GamingRequest, res: Response, next: NextFunction) {
  // Try to authenticate, but don't fail if no token provided
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth provided - continue without player data
    req.player = undefined;
    return next();
  }

  // If auth header is provided, use full authentication
  return gamingAuth(req, res, next);
}

// Rate limiting for gaming actions
export function gamingRateLimit(actionsPerMinute: number = 30) {
  const attempts = new Map<string, number[]>();

  return (req: GamingRequest, res: Response, next: NextFunction) => {
    if (!req.player) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const playerId = req.player.playerId;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    // Clean old attempts
    const playerAttempts = attempts.get(playerId) || [];
    const recentAttempts = playerAttempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= actionsPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many gaming actions. Limit: ${actionsPerMinute} per minute`,
        retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
      });
    }
    
    // Record this attempt
    recentAttempts.push(now);
    attempts.set(playerId, recentAttempts);
    
    next();
  };
}