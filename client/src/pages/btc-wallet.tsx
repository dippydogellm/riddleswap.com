import { useState } from 'react';
import { useLocation } from 'wouter';
import { Box, Card, CardContent, Typography, Button, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { Send as SendIcon, CallReceived as ReceiveIcon } from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedWalletData } from '@/lib/wallet-query-optimizer';
import WalletUpgradeTemplate, { CHAIN_CONFIGS } from '@/components/wallet/WalletUpgradeTemplate';
import '@/styles/btc-wallet.css';

export default function BtcWallet() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(0);
  
  const { authData, isLoading: authLoading, isAuthenticated, walletData: authWalletData } = useAuth();
  const btcAddress = authData?.walletAddresses?.btc || authWalletData?.btcAddress;
  
  const walletData = useOptimizedWalletData('btc', btcAddress, {
    includeTokens: false,
    includeTransactions: true
  });

  const balance = (walletData.balance.data as any)?.balance || '0';
  const balanceUsd = (walletData.balance.data as any)?.balanceUsd || '0';
  const transactions = (walletData.transactions.data as any)?.transactions || [];

  const handleRefresh = async () => {
    await walletData.refetchAll();
    toast({ title: "Refreshed!", duration: 2000 });
  };

  if (authLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  }

  if (!isAuthenticated || !btcAddress) {
    return (
      <WalletUpgradeTemplate
        chainConfig={CHAIN_CONFIGS.btc}
        address=""
        balance={{ native: '0', usd: '0' }}
        onRefresh={handleRefresh}
        customActions={[]}
      >
        <Alert severity="info">Please log in to access your Bitcoin wallet</Alert>
      </WalletUpgradeTemplate>
    );
  }

  return (
    <WalletUpgradeTemplate
      chainConfig={CHAIN_CONFIGS.btc}
      address={btcAddress}
      balance={{ native: balance, usd: `$${parseFloat(balanceUsd).toFixed(2)}` }}
      onRefresh={handleRefresh}
      customActions={[
        { label: 'Send', icon: 'send', onClick: () => navigate('/bitcoin/send') },
        { label: 'Receive', icon: 'receive', onClick: () => navigate('/bitcoin/receive') }
      ]}
    >
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          ℹ️ Bitcoin uses UTXO model - no dust burning needed
        </Typography>
      </Alert>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Transactions" />
      </Tabs>

      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Transactions</Typography>
            {transactions.length === 0 ? (
              <Alert severity="info">No recent transactions</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {transactions.slice(0, 10).map((tx: any, i: number) => (
                  <Box key={i} sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {tx.type || 'Transaction'} - {new Date(tx.timestamp).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {tx.txid?.slice(0, 16)}...
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Amount: {tx.amount} BTC
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </WalletUpgradeTemplate>
  );
}
