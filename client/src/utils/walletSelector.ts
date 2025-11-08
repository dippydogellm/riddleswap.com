export type WalletType = 'riddle' | 'joey' | 'xaman';

export interface WalletOption {
  type: WalletType;
  name: string;
  icon: string;
  isConnected: boolean;
  address?: string;
}

export class WalletSelector {
  static getAvailableWallets(): WalletOption[] {
    const riddleWallet = this.getRiddleWallet();
    const joeyWallet = this.getJoeyWallet();
    const xamanWallet = this.getXamanWallet();

    return [riddleWallet, joeyWallet, xamanWallet].filter(Boolean) as WalletOption[];
  }

  static getRiddleWallet(): WalletOption | null {
    const sessionData = localStorage.getItem('walletData');
    if (!sessionData) return null;

    try {
      const data = JSON.parse(sessionData);
      return {
        type: 'riddle',
        name: 'Riddle Wallet',
        icon: '🔐',
        isConnected: !!data.xrpAddress,
        address: data.xrpAddress
      };
    } catch {
      return null;
    }
  }

  static getJoeyWallet(): WalletOption | null {
    const joeyAddress = localStorage.getItem('joey_xrp_address');
    
    return {
      type: 'joey',
      name: 'Joey Wallet',
      icon: '🦘',
      isConnected: !!joeyAddress,
      address: joeyAddress || undefined
    };
  }

  static getXamanWallet(): WalletOption | null {
    const xamanAddress = localStorage.getItem('xaman_address');
    
    return {
      type: 'xaman',
      name: 'Xaman Wallet',
      icon: '🔷',
      isConnected: !!xamanAddress,
      address: xamanAddress || undefined
    };
  }

  static getPreferredWallet(): WalletOption | null {
    const wallets = this.getAvailableWallets();
    const connectedWallets = wallets.filter(w => w.isConnected);

    if (connectedWallets.length === 0) {
      return this.getRiddleWallet();
    }

    const preferred = localStorage.getItem('preferred_xrp_wallet');
    if (preferred) {
      const wallet = connectedWallets.find(w => w.type === preferred);
      if (wallet) return wallet;
    }

    return connectedWallets[0];
  }

  static setPreferredWallet(type: WalletType): void {
    localStorage.setItem('preferred_xrp_wallet', type);
  }

  static hasMultipleWallets(): boolean {
    const wallets = this.getAvailableWallets();
    return wallets.filter(w => w.isConnected).length > 1;
  }
}
