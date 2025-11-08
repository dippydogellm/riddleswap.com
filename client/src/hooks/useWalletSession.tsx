import { useState, useEffect, createContext, useContext } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface WalletSession {
  isConnected: boolean;
  wallet?: string;
  sessionToken?: string;
  handle?: string;
  chainType?: string;
}

interface WalletSessionContextType {
  session: WalletSession;
  connectWallet: (walletAddress: string, sessionToken: string, handle?: string, chainType?: string) => void;
  disconnectWallet: () => void;
  isLoading: boolean;
}

const WalletSessionContext = createContext<WalletSessionContextType | null>(null);

export function WalletSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WalletSession>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedSession = localStorage.getItem('wallet-session');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        if (parsedSession.wallet && parsedSession.sessionToken) {
          setSession({
            isConnected: true,
            ...parsedSession
          });
        }
      } catch (error) {
        console.error('❌ Error parsing saved session:', error);
        localStorage.removeItem('wallet-session');
      }
    }
    setIsLoading(false);
  }, []);

  const connectWallet = (walletAddress: string, sessionToken: string, handle?: string, chainType?: string) => {
    const newSession = {
      isConnected: true,
      wallet: walletAddress,
      sessionToken,
      handle,
      chainType
    };
    
    setSession(newSession);
    localStorage.setItem('wallet-session', JSON.stringify(newSession));
  };

  const disconnectWallet = () => {
    setSession({ isConnected: false });
    localStorage.removeItem('wallet-session');
  };

  return (
    <WalletSessionContext.Provider value={{
      session,
      connectWallet,
      disconnectWallet,
      isLoading
    }}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession() {
  const context = useContext(WalletSessionContext);
  if (!context) {
    throw new Error('useWalletSession must be used within a WalletSessionProvider');
  }
  return context;
}

// Hook for chat-specific functionality
export function useChatSession() {
  const { session } = useWalletSession();
  
  // For demo purposes, provide fallback data if no session exists
  const chatSession = session.isConnected ? {
    wallet: session.wallet!,
    sessionToken: session.sessionToken!,
    handle: session.handle || `${session.wallet?.slice(0, 6)}...${session.wallet?.slice(-4)}`
  } : {
    // Demo fallback data
    wallet: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Demo wallet address
    sessionToken: 'demo-session-token',
    handle: 'Demo User'
  };

  return chatSession;
}
