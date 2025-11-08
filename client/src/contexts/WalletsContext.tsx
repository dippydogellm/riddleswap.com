import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sessionManager } from '@/utils/sessionManager';

export type WalletsState = {
  xrpl?: string; // r...
  evm?: string; // 0x...
};

export type WalletsContextType = {
  wallets: WalletsState;
  setXRPL(address?: string): void;
  setEVM(address?: string): void;
};

const WalletsContext = createContext<WalletsContextType | undefined>(undefined);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletsState>({});

  // Initialize from centralized session and keep in sync
  useEffect(() => {
    // Seed from current session
    const seedFromSession = () => {
      const s = sessionManager.getSession();
      const xrp = s.walletData?.xrpAddress || s.walletAddresses?.xrp || s.walletAddresses?.xrpAddress;
      const eth = s.walletData?.ethAddress || s.walletAddresses?.eth || s.walletAddresses?.ethAddress;
      setWallets(prev => ({
        xrpl: prev.xrpl ?? xrp ?? undefined,
        evm: prev.evm ?? eth ?? undefined
      }));
    };

    seedFromSession();
    // Subscribe to updates
    const unsub = sessionManager.subscribe(seedFromSession);
    return () => { unsub(); };
  }, []);

  const api: WalletsContextType = useMemo(() => ({
    wallets,
    setXRPL(address?: string) {
      if (address) {
        setWallets(prev => ({ ...prev, xrpl: address }));
      } else {
        const s = sessionManager.getSession();
        const xrp = s.walletData?.xrpAddress || s.walletAddresses?.xrp || s.walletAddresses?.xrpAddress;
        setWallets(prev => ({ ...prev, xrpl: xrp || undefined }));
      }
    },
    setEVM(address?: string) {
      if (address) {
        setWallets(prev => ({ ...prev, evm: address }));
      } else {
        const s = sessionManager.getSession();
        const eth = s.walletData?.ethAddress || s.walletAddresses?.eth || s.walletAddresses?.ethAddress;
        setWallets(prev => ({ ...prev, evm: eth || undefined }));
      }
    }
  }), [wallets]);

  return (
    <WalletsContext.Provider value={api}>{children}</WalletsContext.Provider>
  );
}

export function useWallets() {
  const ctx = useContext(WalletsContext);
  if (!ctx) throw new Error('useWallets must be used within WalletsProvider');
  return ctx;
}
