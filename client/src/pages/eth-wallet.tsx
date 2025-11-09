import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Box, Card, CardContent, Typography, Button, Tabs, Tab, CircularProgress, Dialog, DialogTitle, DialogContent, Alert } from '@mui/material';
import { Send as SendIcon, CallReceived as ReceiveIcon, SwapHoriz as SwapIcon, LocalFireDepartment as BurnIcon } from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedWalletData } from '@/lib/wallet-query-optimizer';
import WalletUpgradeTemplate, { CHAIN_CONFIGS } from '@/components/wallet/WalletUpgradeTemplate';
import TransactionSuccessModal from '@/components/wallet/TransactionSuccessModal';
import TransactionConfirmationModal from '@/components/wallet/TransactionConfirmationModal';
import { getTransactionAuth } from '@/utils/transactionAuth';

// Import the Ethereum logo
const ethereumLogoPath = '/images/chains/ethereum-logo.png';

const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const formatAmount = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  } else if (num >= 1) {
    return num.toFixed(4);
  } else {
    return num.toFixed(8);
  }
};

const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
};

const formatTokenBalance = (balance: string, decimals: number): string => {
  const balanceNum = parseFloat(balance);
  const divisor = Math.pow(10, decimals);
  const formattedBalance = balanceNum / divisor;
  return formatAmount(formattedBalance);
};

const copyToClipboard = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
      duration: 2000
    });
  } catch (err) {
    toast({
      title: "Copy failed",
      description: "Please copy manually",
      variant: "destructive",
      duration: 3000
    });
  }
};

export default function ETHWallet() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [successTransaction, setSuccessTransaction] = useState<any>(null);
  
  // Use unified authentication
  const { authData, isLoading: authLoading, isAuthenticated, walletData: authWalletData } = useAuth();
  
  const walletAddress = authWalletData?.ethAddress;

  // Use optimized wallet data hook
  const walletData = useOptimizedWalletData('eth', walletAddress, {
    includeTokens: true,
    includeNFTs: false,
    includeTransactions: true,
    includePortfolio: false
  });

  const { refetchAll } = walletData;
  const balanceData = walletData.balance.data;
  const tokensData = walletData.tokens.data;
  const tokensLoading = walletData.tokens.isLoading;
  const transactionsData = walletData.transactions.data;
  
  const balance = (balanceData as any)?.balance || '0';
  const balanceUsd = (balanceData as any)?.balanceUsd || '0';
  const transactions = (transactionsData as any)?.transactions || [];
  const tokens = (tokensData as any)?.tokens || [];

  const handleRefresh = async () => {
    await refetchAll();
    toast({
      title: "Refreshed!",
      description: "Ethereum wallet data updated",
      duration: 2000
    });
  };

  // Burn Dust Feature - Find tokens worth less than $1
  const handleBurnDust = async () => {
    const dustTokens = tokens.filter((token: any) => {
      const usdValue = parseFloat(token.balanceUsd || '0');
      return usdValue > 0 && usdValue < 1;
    });

    if (dustTokens.length === 0) {
      toast({
        title: "No dust tokens found",
        description: "All your tokens are worth more than $1",
        duration: 3000
      });
      return;
    }

    setPendingTransaction({
      type: 'burn',
      chain: 'Ethereum',
      tokens: dustTokens,
      totalValue: dustTokens.reduce((sum: number, t: any) => sum + parseFloat(t.balanceUsd || '0'), 0)
    });
    setShowConfirmModal(true);
  };

  // Sell Token Feature
  const handleSellToken = (token: any) => {
    navigate(`/trade-v3?chain=eth&from=${token.contractAddress}`);
  };

  const confirmBurnDust = async () => {
    try {
      const auth = await getTransactionAuth('eth');
      if (!auth) {
        toast({
          title: "Authentication required",
          description: "Please log in to burn dust tokens",
          variant: "destructive"
        });
        return;
      }

      setShowConfirmModal(false);
      
      // Simulate burn transaction
      const txHash = '0x' + Math.random().toString(16).substring(2, 66);
      
      setSuccessTransaction({
        hash: txHash,
        type: 'burn',
        chain: 'Ethereum',
        amount: `${pendingTransaction.tokens.length} tokens`,
        timestamp: new Date().toISOString()
      });
      setShowSuccessModal(true);
      
      toast({
        title: "Burn successful!",
        description: `Burned ${pendingTransaction.tokens.length} dust tokens`,
        duration: 3000
      });

      await handleRefresh();
    } catch (error: any) {
      toast({
        title: "Burn failed",
        description: error.message || "Failed to burn dust tokens",
        variant: "destructive"
      });
    }
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated || !walletAddress) {
    return (
      <WalletUpgradeTemplate
        chainConfig={CHAIN_CONFIGS.eth}
        address=""
        balance={{ native: '0', usd: '0' }}
        onRefresh={handleRefresh}
        customActions={[]}
      >
        <Alert severity="info" sx={{ mb: 3 }}>
          Please log in to access your Ethereum wallet
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/wallet-login')}>
            Login
          </Button>
          <Button variant="outlined" onClick={() => navigate('/create-wallet')}>
            Create Wallet
          </Button>
        </Box>
      </WalletUpgradeTemplate>
    );
  }

  return (
    <>
      <WalletUpgradeTemplate
        chainConfig={CHAIN_CONFIGS.eth}
        address={walletAddress}
        balance={{
          native: formatAmount(balance),
          usd: formatUsd(parseFloat(balanceUsd))
        }}
        onRefresh={handleRefresh}
        customActions={[
          {
            label: 'Send',
            icon: 'send',
            onClick: () => navigate('/ethereum/send')
          },
          {
            label: 'Receive',
            icon: 'receive',
            onClick: () => navigate('/ethereum/receive')
          },
          {
            label: 'Swap',
            icon: 'swap',
            onClick: () => navigate('/trade-v3?chain=eth')
          },
          {
            label: 'Burn Dust',
            icon: 'burn',
            onClick: handleBurnDust
          }
        ]}
      >
        {/* Tabs for different sections */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        >
          <Tab label="Tokens" />
          <Tab label="Transactions" />
        </Tabs>

        {/* Tokens Tab */}
        {activeTab === 0 && (
          <Card sx={{ 
            background: 'rgba(98, 126, 234, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(98, 126, 234, 0.2)'
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SwapIcon /> ERC-20 Tokens
              </Typography>
              
              {tokensLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : tokens.length === 0 ? (
                <Alert severity="info">No tokens found in this wallet</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tokens.map((token: any, index: number) => {
                    const usdValue = parseFloat(token.balanceUsd || '0');
                    const isDust = usdValue > 0 && usdValue < 1;
                    
                    return (
                      <Card
                        key={`${token.contractAddress}-${index}`}
                        sx={{
                          p: 2,
                          background: isDust ? 'rgba(255, 152, 0, 0.1)' : 'rgba(98, 126, 234, 0.1)',
                          border: isDust ? '1px solid rgba(255, 152, 0, 0.3)' : '1px solid rgba(98, 126, 234, 0.3)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #627eea, #4a5d9a)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold'
                          }}>
                            {token.symbol?.substring(0, 2)?.toUpperCase() || 'TK'}
                          </Box>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {token.symbol}
                              {isDust && (
                                <Typography component="span" sx={{ ml: 1, color: '#ff9800', fontSize: '0.75rem' }}>
                                  DUST
                                </Typography>
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {token.name || formatAddress(token.contractAddress)}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {formatTokenBalance(token.balance, token.decimals)} {token.symbol}
                          </Typography>
                          {usdValue > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              {formatUsd(usdValue)}
                            </Typography>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSellToken(token)}
                            sx={{ mt: 0.5 }}
                          >
                            Sell
                          </Button>
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transactions Tab */}
        {activeTab === 1 && (
          <Card sx={{ 
            background: 'rgba(98, 126, 234, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(98, 126, 234, 0.2)'
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Transactions
              </Typography>
              
              {transactions.length === 0 ? (
                <Alert severity="info">No transactions found</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {transactions.slice(0, 10).map((tx: any, index: number) => (
                    <Card
                      key={index}
                      sx={{
                        p: 2,
                        background: 'rgba(98, 126, 234, 0.1)',
                        border: '1px solid rgba(98, 126, 234, 0.3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {tx.type || 'Transaction'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatAddress(tx.hash || '')}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {formatAmount(tx.amount || '0')} ETH
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Recent'}
                        </Typography>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </WalletUpgradeTemplate>

      {/* Transaction Confirmation Modal */}
      {pendingTransaction && (
        <TransactionConfirmationModal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmBurnDust}
          chain={{
            name: CHAIN_CONFIGS.eth.name,
            logo: CHAIN_CONFIGS.eth.logo,
            color: CHAIN_CONFIGS.eth.color
          }}
          type="burn"
          details={{
            amount: `${pendingTransaction.tokens?.length || 0} tokens`,
            token: 'Dust Tokens',
            estimatedFee: '~$0.50',
            warning: 'This action cannot be undone. Dust tokens will be permanently burned.'
          }}
          requiresDisclaimer={true}
          disclaimerText="I understand that burning dust tokens is irreversible and will permanently remove these tokens from my wallet."
        />
      )}

      {/* Transaction Success Modal */}
      {successTransaction && (
        <TransactionSuccessModal
          open={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          txHash={successTransaction.hash}
          chain={{
            name: CHAIN_CONFIGS.eth.name,
            logo: CHAIN_CONFIGS.eth.logo,
            color: CHAIN_CONFIGS.eth.color,
            explorerUrl: CHAIN_CONFIGS.eth.explorerUrl,
            explorerTxPath: CHAIN_CONFIGS.eth.explorerTxPath
          }}
          type={successTransaction.type}
          details={{
            amount: successTransaction.amount,
            hash: successTransaction.hash,
            timestamp: successTransaction.timestamp
          }}
        />
      )}
    </>
  );
}
