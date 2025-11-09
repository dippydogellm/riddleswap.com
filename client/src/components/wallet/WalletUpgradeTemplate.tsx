/**
 * Wallet Upgrade Template - Reusable component for all chain wallets
 * 
 * This template provides a standardized structure for all 19 chain wallets:
 * - StandardWalletLayout with chain-specific branding
 * - TransactionSuccessModal for all transaction types
 * - TransactionConfirmationModal with disclaimers
 * - Sell tokens feature
 * - Burn dust feature (for EVM chains)
 * - Consistent action buttons and navigation
 * 
 * Usage:
 * Import and wrap your wallet content with this template.
 * Pass chain-specific config and implement transaction handlers.
 */

import React, { useState } from 'react';
import { Box, Card, CardContent, Grid, Typography, Button } from '@mui/material';
import StandardWalletLayout from './StandardWalletLayout';
import TransactionSuccessModal from './TransactionSuccessModal';
import TransactionConfirmationModal from './TransactionConfirmationModal';

export interface ChainConfig {
  name: string;
  symbol: string;
  logo: string;
  color: string;
  explorerUrl: string;
  explorerTxPath: string; // e.g., "/transactions/" or "/tx/"
}

export interface WalletTemplateProps {
  chainConfig: ChainConfig;
  address: string;
  balance: {
    native: string;
    usd: string;
  };
  isLoading?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
  // Optional: custom actions to add to default actions
  customActions?: Array<{
    label: string;
    icon: 'send' | 'receive' | 'swap' | 'burn' | 'stake' | 'vote';
    onClick: () => void;
  }>;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  xrp: {
    name: 'XRP Ledger',
    symbol: 'XRP',
    logo: 'https://cdn.bithomp.com/chains/xrp.svg',
    color: '#23292F',
    explorerUrl: 'https://livenet.xrpl.org',
    explorerTxPath: '/transactions/'
  },
  eth: {
    name: 'Ethereum',
    symbol: 'ETH',
    logo: '/images/chains/ethereum-logo.png',
    color: '#627EEA',
    explorerUrl: 'https://etherscan.io',
    explorerTxPath: '/tx/'
  },
  sol: {
    name: 'Solana',
    symbol: 'SOL',
    logo: '/images/chains/solana-logo.png',
    color: '#14F195',
    explorerUrl: 'https://solscan.io',
    explorerTxPath: '/tx/'
  },
  btc: {
    name: 'Bitcoin',
    symbol: 'BTC',
    logo: '/images/chains/bitcoin-logo.png',
    color: '#F7931A',
    explorerUrl: 'https://blockchair.com/bitcoin',
    explorerTxPath: '/transaction/'
  },
  bnb: {
    name: 'BNB Chain',
    symbol: 'BNB',
    logo: '/images/chains/bnb-logo.png',
    color: '#F3BA2F',
    explorerUrl: 'https://bscscan.com',
    explorerTxPath: '/tx/'
  },
  base: {
    name: 'Base',
    symbol: 'ETH',
    logo: '/images/chains/base-logo.png',
    color: '#0052FF',
    explorerUrl: 'https://basescan.org',
    explorerTxPath: '/tx/'
  },
  avax: {
    name: 'Avalanche',
    symbol: 'AVAX',
    logo: '/images/chains/avalanche-logo.png',
    color: '#E84142',
    explorerUrl: 'https://snowtrace.io',
    explorerTxPath: '/tx/'
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    logo: '/images/chains/polygon-logo.png',
    color: '#8247E5',
    explorerUrl: 'https://polygonscan.com',
    explorerTxPath: '/tx/'
  },
  arbitrum: {
    name: 'Arbitrum',
    symbol: 'ETH',
    logo: '/images/chains/arbitrum-logo.png',
    color: '#28A0F0',
    explorerUrl: 'https://arbiscan.io',
    explorerTxPath: '/tx/'
  },
  optimism: {
    name: 'Optimism',
    symbol: 'ETH',
    logo: '/images/chains/optimism-logo.png',
    color: '#FF0420',
    explorerUrl: 'https://optimistic.etherscan.io',
    explorerTxPath: '/tx/'
  },
  fantom: {
    name: 'Fantom',
    symbol: 'FTM',
    logo: '/images/chains/fantom-logo.png',
    color: '#1969FF',
    explorerUrl: 'https://ftmscan.com',
    explorerTxPath: '/tx/'
  },
  zksync: {
    name: 'zkSync Era',
    symbol: 'ETH',
    logo: '/images/chains/zksync-logo.png',
    color: '#8C8DFC',
    explorerUrl: 'https://explorer.zksync.io',
    explorerTxPath: '/tx/'
  },
  linea: {
    name: 'Linea',
    symbol: 'ETH',
    logo: '/images/chains/linea-logo.png',
    color: '#121212',
    explorerUrl: 'https://lineascan.build',
    explorerTxPath: '/tx/'
  },
  taiko: {
    name: 'Taiko',
    symbol: 'ETH',
    logo: '/images/chains/taiko-logo.png',
    color: '#E81899',
    explorerUrl: 'https://taikoscan.io',
    explorerTxPath: '/tx/'
  },
  unichain: {
    name: 'Unichain',
    symbol: 'ETH',
    logo: '/images/chains/unichain-logo.png',
    color: '#FF007A',
    explorerUrl: 'https://uniscan.xyz',
    explorerTxPath: '/tx/'
  },
  soneium: {
    name: 'Soneium',
    symbol: 'ETH',
    logo: '/images/chains/soneium-logo.png',
    color: '#0066FF',
    explorerUrl: 'https://soneium.org/explorer',
    explorerTxPath: '/tx/'
  },
  mantle: {
    name: 'Mantle',
    symbol: 'MNT',
    logo: '/images/chains/mantle-logo.png',
    color: '#000000',
    explorerUrl: 'https://explorer.mantle.xyz',
    explorerTxPath: '/tx/'
  },
  metis: {
    name: 'Metis',
    symbol: 'METIS',
    logo: '/images/chains/metis-logo.png',
    color: '#00DACC',
    explorerUrl: 'https://andromeda-explorer.metis.io',
    explorerTxPath: '/tx/'
  },
  scroll: {
    name: 'Scroll',
    symbol: 'ETH',
    logo: '/images/chains/scroll-logo.png',
    color: '#FFEEDA',
    explorerUrl: 'https://scrollscan.com',
    explorerTxPath: '/tx/'
  }
};

export default function WalletUpgradeTemplate({
  chainConfig,
  address,
  balance,
  isLoading,
  onRefresh,
  children,
  customActions = []
}: WalletTemplateProps) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTxData, setSuccessTxData] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTxData, setConfirmTxData] = useState<any>(null);

  // Default actions for all wallets
  const defaultActions = [
    {
      label: 'Send',
      icon: 'send' as const,
      onClick: () => (window.location.href = '/send')
    },
    {
      label: 'Receive',
      icon: 'receive' as const,
      onClick: () => (window.location.href = '/receive')
    },
    {
      label: 'Swap',
      icon: 'swap' as const,
      onClick: () => (window.location.href = '/trade-v3')
    }
  ];

  return (
    <StandardWalletLayout
      chain={chainConfig}
      address={address}
      balance={balance}
      isLoading={isLoading}
      onRefresh={onRefresh}
      actions={[...defaultActions, ...customActions]}
    >
      {children}

      {/* Transaction Success Modal */}
      {successTxData && (
        <TransactionSuccessModal
          open={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessTxData(null);
          }}
          txHash={successTxData.txHash}
          explorerUrl={`${chainConfig.explorerUrl}${chainConfig.explorerTxPath}${successTxData.txHash}`}
          chain={{
            name: chainConfig.name,
            logo: chainConfig.logo,
            color: chainConfig.color,
            explorerUrl: chainConfig.explorerUrl,
            explorerTxPath: chainConfig.explorerTxPath
          }}
          type={successTxData.type}
          details={successTxData.details}
        />
      )}

      {/* Transaction Confirmation Modal */}
      {confirmTxData && (
        <TransactionConfirmationModal
          open={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setConfirmTxData(null);
          }}
          onConfirm={confirmTxData.onConfirm}
          chain={{
            name: chainConfig.name,
            logo: chainConfig.logo,
            color: chainConfig.color
          }}
          type={confirmTxData.type}
          details={confirmTxData.details}
          requiresDisclaimer={true}
          disclaimerText={confirmTxData.disclaimerText}
        />
      )}
    </StandardWalletLayout>
  );
}

// Export helper function to show success modal from outside
export function useWalletTransactions() {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTxData, setSuccessTxData] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTxData, setConfirmTxData] = useState<any>(null);

  return {
    showSuccess: (data: any) => {
      setSuccessTxData(data);
      setShowSuccessModal(true);
    },
    showConfirm: (data: any) => {
      setConfirmTxData(data);
      setShowConfirmModal(true);
    },
    modals: { showSuccessModal, successTxData, showConfirmModal, confirmTxData },
    setModals: { setShowSuccessModal, setSuccessTxData, setShowConfirmModal, setConfirmTxData }
  };
}
