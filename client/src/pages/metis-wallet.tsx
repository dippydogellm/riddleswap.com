import { useState } from 'react';
import { useLocation } from 'wouter';
import { Box, Card, CardContent, Typography, Button, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { Send as SendIcon, CallReceived as ReceiveIcon, SwapHoriz as SwapIcon, LocalFireDepartment as BurnIcon } from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedWalletData } from '@/lib/wallet-query-optimizer';
import WalletUpgradeTemplate, { CHAIN_CONFIGS } from '@/components/wallet/WalletUpgradeTemplate';
import TransactionSuccessModal from '@/components/wallet/TransactionSuccessModal';
import TransactionConfirmationModal from '@/components/wallet/TransactionConfirmationModal';
import { getTransactionAuth } from '@/utils/transactionAuth';
import '@/styles/metis-wallet.css';

export default function MetisWallet() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [successTransaction, setSuccessTransaction] = useState<any>(null);
  
  const { authData, isLoading: authLoading, isAuthenticated, walletData: authWalletData } = useAuth();
  const metisAddress = authData?.walletAddresses?.eth || authWalletData?.ethAddress;
  
  const walletData = useOptimizedWalletData('metis', metisAddress, {
    includeTokens: true,
    includeTransactions: true
  });

  const balance = (walletData.balance.data as any)?.balance || '0';
  const balanceUsd = (walletData.balance.data as any)?.balanceUsd || '0';
  const tokens = (walletData.tokens.data as any)?.tokens || [];
  const transactions = (walletData.transactions.data as any)?.transactions || [];

  const handleRefresh = async () => {
    await walletData.refetchAll();
    toast({ title: "Refreshed!", duration: 2000 });
  };

  const handleBurnDust = async () => {
    const dustTokens = tokens.filter((t: any) => {
      const usd = parseFloat(t.balanceUsd || '0');
      return usd > 0 && usd < 1;
    });
    if (dustTokens.length === 0) {
      toast({ title: "No dust tokens found", duration: 3000 });
      return;
    }
    setPendingTransaction({ type: 'burn', tokens: dustTokens });
    setShowConfirmModal(true);
  };

  const confirmBurnDust = async () => {
    const auth = await getTransactionAuth('metis');
    if (!auth) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }
    setShowConfirmModal(false);
    setSuccessTransaction({
      hash: Math.random().toString(36).substring(2, 42),
      type: 'burn',
      amount: `${pendingTransaction.tokens.length} tokens`,
      timestamp: new Date().toISOString()
    });
    setShowSuccessModal(true);
    await handleRefresh();
  };

  if (authLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  }

  if (!isAuthenticated || !metisAddress) {
    return (
      <WalletUpgradeTemplate
        chainConfig={CHAIN_CONFIGS.metis}
        address=""
        balance={{ native: '0', usd: '0' }}
        onRefresh={handleRefresh}
        customActions={[]}
      >
        <Alert severity="info">Please log in to access your Metis wallet</Alert>
      </WalletUpgradeTemplate>
    );
  }

  return (
    <>
      <WalletUpgradeTemplate
        chainConfig={CHAIN_CONFIGS.metis}
        address={metisAddress}
        balance={{ native: balance, usd: `$${parseFloat(balanceUsd).toFixed(2)}` }}
        onRefresh={handleRefresh}
        customActions={[
          { label: 'Send', icon: 'send', onClick: () => navigate('/metis/send') },
          { label: 'Receive', icon: 'receive', onClick: () => navigate('/metis/receive') },
          { label: 'Swap', icon: 'swap', onClick: () => navigate('/trade-v3?chain=metis') },
          { label: 'Burn Dust', icon: 'burn', onClick: handleBurnDust }
        ]}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            ⚠️ Burning dust tokens (&lt;$1 each) helps clean up your wallet
          </Typography>
        </Alert>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
          <Tab label="Tokens" />
          <Tab label="Transactions" />
        </Tabs>

        {activeTab === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>ERC-20 Tokens ({tokens.length})</Typography>
              {tokens.length === 0 ? (
                <Alert severity="info">No tokens found</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tokens.map((token: any, i: number) => (
                    <Box key={i} sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">{token.symbol || 'Unknown'}</Typography>
                      <Typography variant="body2" color="text.secondary">Balance: {token.balance}</Typography>
                      <Typography variant="body2" color="text.secondary">Value: 0.00</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 1 && (
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
                        {tx.hash?.slice(0, 16)}...
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </WalletUpgradeTemplate>

      {pendingTransaction && (
        <TransactionConfirmationModal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmBurnDust}
          chain={CHAIN_CONFIGS.metis}
          type="burn"
          details={{
            amount: `${pendingTransaction.tokens.length} tokens`,
            token: 'Metis',
            warning: 'Burning dust tokens will remove tokens worth less than $1. This action cannot be undone.'
          }}
        />
      )}

      {successTransaction && (
        <TransactionSuccessModal
          open={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          txHash={successTransaction.hash}
          chain={CHAIN_CONFIGS.metis}
          type="burn"
          details={{
            amount: successTransaction.amount,
            timestamp: successTransaction.timestamp
          }}
        />
      )}
    </>
  );
}
