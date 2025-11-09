import React, { useEffect, useMemo, useState } from 'react';
import { Container, Card, CardContent, CardHeader, Typography, Grid, Button, Tabs, Tab, CircularProgress, Box, IconButton, Menu, MenuItem } from '@mui/material';
import { Refresh as RefreshIcon, MoreVert as MoreVertIcon, Sell as SellIcon, LocalFireDepartment as BurnIcon } from '@mui/icons-material';
import ModernXRPLSwap from '@/components/modern-xrpl-swap';
import { useAuth } from '@/hooks/useAuth';
import { HeaderSummary } from '@/components/xrp-wallet/HeaderSummary';
import { ActionButtons } from '@/components/xrp-wallet/ActionButtons';
import { TokensList, TokenItem } from '@/components/xrp-wallet/TokensList';
import { NftCollections, NftItem } from '@/components/xrp-wallet/NftCollections';
import { WalletCollectionView } from '@/components/xrp-wallet/WalletCollectionView';
import { OffersList, Offer, OfferType } from '@/components/xrp-wallet/OffersList';
import { TransactionsList, TransactionItem } from '@/components/xrp-wallet/TransactionsList';
import TrustlineManager from '@/components/xrp-wallet/TrustlineManager';
import { useToast } from '@/hooks/use-toast';
import StandardWalletLayout from '@/components/wallet/StandardWalletLayout';
import TransactionSuccessModal from '@/components/wallet/TransactionSuccessModal';
import TransactionConfirmationModal from '@/components/wallet/TransactionConfirmationModal';

export default function XRPWalletRedesigned() {
  const { isAuthenticated, user, walletData, walletAddresses } = useAuth(false);
  const walletAddress = user?.walletAddress || walletData?.xrpAddress || walletAddresses?.xrpAddress || walletAddresses?.xrp || '';

  const [tab, setTab] = useState<'overview' | 'tokens' | 'swap' | 'nfts' | 'offers' | 'transactions'>('overview');
  const { toast } = useToast();

  // Data state
  const [loading, setLoading] = useState(false);
  const [xrpBalance, setXrpBalance] = useState<number>(0);
  const [xrpPrice, setXrpPrice] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [reservedBalance, setReservedBalance] = useState<number>(0);

  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failedImages] = useState<Set<string>>(new Set());

  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  
  // NFT collection view state
  const [selectedCollection, setSelectedCollection] = useState<{ name: string; nfts: NftItem[] } | null>(null);
  
  // NFT detail modal state
  const [selectedNft, setSelectedNft] = useState<NftItem | null>(null);
  const [nftDetailOpen, setNftDetailOpen] = useState(false);

  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [decliningOffer, setDecliningOffer] = useState<string | null>(null);

  // Trustline manager modal
  const [showTrustlineModal, setShowTrustlineModal] = useState(false);

  // Transaction modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTxData, setSuccessTxData] = useState<{
    txHash: string;
    type: 'send' | 'receive' | 'swap' | 'burn' | 'trustline' | 'approve' | 'stake' | 'unstake' | 'other';
    details: any;
  } | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTxData, setConfirmTxData] = useState<{
    type: 'send' | 'swap' | 'burn' | 'trustline';
    details: any;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Sell token modal
  const [sellToken, setSellToken] = useState<TokenItem | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);

  // Burn dust feature
  const [showBurnDustModal, setShowBurnDustModal] = useState(false);
  const [dustTokens, setDustTokens] = useState<TokenItem[]>([]);
  const [selectedDustTokens, setSelectedDustTokens] = useState<Set<string>>(new Set());

  // Trustline and wallet activation checking
  const [walletActivated, setWalletActivated] = useState<boolean | null>(null);
  const [checkingActivation, setCheckingActivation] = useState(false);
  const [recipientTrustlineStatus, setRecipientTrustlineStatus] = useState<{
    address: string;
    hasTrustline: boolean;
    currency: string;
    issuer: string;
  } | null>(null);

  const collectionsMap = useMemo(() => {
    const map = new Map<string, NftItem[]>();
    nfts.forEach((nft) => {
      const issuer = nft.issuer || 'Unknown';
      const taxon = nft.nftokenTaxon || nft.NFTokenTaxon || 0;
      const key = `${issuer}:${taxon}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(nft);
    });
    return map;
  }, [nfts]);

  // Helpers
  const tokenKey = (t: TokenItem) => `${t.currency}:${t.issuer || ''}`;

  // Check if recipient address has trustline for selected token
  const checkTrustlineStatus = async (recipientAddress: string, currency: string, issuer: string) => {
    try {
      const resp = await fetch(`/api/xrpl/trustlines/${recipientAddress}?currency=${currency}&issuer=${issuer}`);
      if (resp.ok) {
        const data = await resp.json();
        return data.hasTrustline || false;
      }
    } catch (error) {
      console.error('Error checking trustline:', error);
    }
    return false;
  };

  // Check if wallet is activated on XRP Ledger
  const checkWalletActivation = async (address: string) => {
    try {
      const resp = await fetch(`/api/xrpl/account-info/${address}`);
      if (resp.ok) {
        const data = await resp.json();
        return data.activated || false;
      }
    } catch (error) {
      console.error('Error checking wallet activation:', error);
    }
    return false;
  };

  // Fetch wallet data
  useEffect(() => {
    const load = async () => {
      if (!walletAddress) return;
      setLoading(true);
      try {
        // Balance
        let balanceNum = 0;
        let availableNum = 0;
        let reservedNum = 0;
        try {
          const resp = await fetch(`/api/xrpl/balance/${walletAddress}`);
          if (resp.ok) {
            const data = await resp.json();
            // Expect data like { success, balance, available?, reserve? }
            const bal = parseFloat(data.balance || data.totalBalance || '0');
            balanceNum = isNaN(bal) ? 0 : bal;
            availableNum = parseFloat(data.available || data.balance || '0') || 0;
            reservedNum = parseFloat(data.reserve || '0') || 0;
          }
        } catch {}
        setXrpBalance(balanceNum);
        setAvailableBalance(availableNum);
        setReservedBalance(reservedNum);

        // Price (use backend analytics endpoint warmed in cache)
        try {
          const priceResp = await fetch(`/api/analytics/xrpl/token?symbol=XRP`);
          if (priceResp.ok) {
            const p = await priceResp.json();
            const price = p?.data?.priceUsd || p?.priceUsd || 0;
            setXrpPrice(typeof price === 'number' ? price : parseFloat(price));
          }
        } catch {}

        // Tokens
        try {
          const tResp = await fetch(`/api/xrpl/tokens/${walletAddress}`);
          if (tResp.ok) {
            const t = await tResp.json();
            const list = Array.isArray(t?.tokens) ? t.tokens : [];
            const normalized: TokenItem[] = list.map((it: any) => ({
              currency: it.currency || it.symbol,
              issuer: it.issuer,
              balance: typeof it.balance === 'number' ? it.balance : parseFloat(it.balance || '0'),
              symbol: it.symbol || it.currency,
              name: it.name || it.symbol || it.currency,
              icon_url: it.icon_url || it.logo_url || it.logoURI || (it.issuer && it.symbol ? `https://cdn.bithomp.com/issued-token/${it.issuer}/${it.symbol}` : undefined),
              price_usd: it.price_usd || 0,
            }));
            setTokens(normalized);
          } else {
            setTokens([]);
          }
        } catch {
          setTokens([]);
        }

        // NFTs (public) - using metadata from Bithomp API response
        try {
          const nResp = await fetch(`/api/wallet/nfts-public/${walletAddress}`);
          if (nResp.ok) {
            const n = await nResp.json();
            const arr = n?.nfts || n?.items || [];
            const normalized: NftItem[] = arr.map((it: any) => {
              // Image already processed in backend with IPFS conversion
              const image = it.image;
              
              return {
                nftokenID: it.nftokenID || it.nft_id,
                NFTokenID: it.nftokenID,
                tokenID: it.nftokenID,
                nft_id: it.nft_id,
                image,
                name: it.name,
                collectionName: it.collection,
                collection: { name: it.collection },
                issuer: it.issuer,
                nftokenTaxon: it.taxon,
                NFTokenTaxon: it.taxon,
                attributes: it.attributes || [],
                rarity: it.rarity,
                floor_price: it.floor_price,
                last_sale_price: it.last_sale_price,
              } as NftItem;
            });
            setNfts(normalized);
          } else {
            setNfts([]);
          }
        } catch (err) {
          console.error('Error fetching NFTs:', err);
          setNfts([]);
        }

        // Offers (public)
        try {
          const oResp = await fetch(`/api/nft-offers-public/${walletAddress}`);
          if (oResp.ok) {
            const o = await oResp.json();
            const normalized: Offer[] = (o || []).map((it: any) => {
              const offerIndex = it.offerIndex || it.offer_index || it.id;
              const destination = it.destination;
              const amount = it.amount?.toString?.() || it.amount || '0';
              const flags = it.flags;
              const nftoken = it.nftoken || it.nft || it.token;
              const nftokenID = (it.nftokenID || it.NFTokenID || it.nft_id || it.tokenID || '').toString();
              const account = it.account || it.owner;

              // Determine offer type
              let offerType: OfferType = 'buy';
              let isLegacy = false;
              let isOrphaned = false;

              // Check if it's a transfer (free offer to specific destination)
              if (destination && destination === walletAddress && amount === '0') {
                offerType = 'transfer';
              }
              // Check if it's a buy offer (someone wants to buy your NFT)
              else if (flags?.sellToken === false && nftoken?.owner === walletAddress) {
                offerType = 'buy';
              }
              // Check if it's a sell offer (you're selling your NFT)
              else if (flags?.sellToken === true) {
                offerType = 'sell';
              }

              // Check for legacy offers (old format)
              if (!flags || typeof flags !== 'object') {
                isLegacy = true;
                offerType = 'legacy';
              }

              // Check for orphaned offers (NFT no longer exists or is owned by someone else)
              if (nftoken && nftoken.owner && nftoken.owner !== walletAddress && nftoken.owner !== account) {
                isOrphaned = true;
                offerType = 'orphaned';
              }

              return {
                offerIndex,
                destination,
                amount,
                flags,
                nftoken,
                nftokenID,
                account,
                type: offerType,
                isLegacy,
                isOrphaned,
                createdAt: it.createdAt || it.created_at,
                expiresAt: it.expiresAt || it.expires_at,
              };
            });
            setOffers(normalized);
          } else {
            setOffers([]);
          }
        } catch {
          setOffers([]);
        }

        // Transactions
        try {
          const txResp = await fetch(`/api/wallets/xrp/transactions/${walletAddress}?limit=50`);
          if (txResp.ok) {
            const tx = await txResp.json();
            const list = tx?.transactions || tx?.items || tx || [];
            const normalized: TransactionItem[] = list.map((it: any) => ({
              hash: it.hash || it.tx_hash || it.transactionHash,
              type: it.type || it.TransactionType || it.tx_type,
              amount: typeof it.amount === 'string' ? it.amount : (it.amount?.value || it.Amount?.value || it.Amount || '').toString?.() || undefined,
              fee: it.fee || it.Fee,
              direction: it.direction,
              date: it.date || it.timestamp || (it.executed_time ? it.executed_time * 1000 : undefined),
              to: it.to || it.Destination,
              from: it.from || it.Account,
            }));
            setTransactions(normalized.filter(t => t.hash));
          } else {
            setTransactions([]);
          }
        } catch {
          setTransactions([]);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [walletAddress]);

  // Handlers
  const handleToggle = (tokenKeyStr: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(Array.from(prev));
      if (checked) next.add(tokenKeyStr); else next.delete(tokenKeyStr);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelected(new Set(tokens.map(tokenKey)));
    else setSelected(new Set());
  };

  const handleBulkRemove = () => setShowTrustlineModal(true);

  const handleViewToken = (t: TokenItem) => {
    const symbol = t.symbol || t.currency;
    const issuer = t.issuer;
    if (symbol && issuer) {
      window.location.href = `/xrpl/${encodeURIComponent(symbol)}/${encodeURIComponent(issuer)}`;
    }
  };

  const handleViewOnExplorer = (t: TokenItem) => {
    const symbol = t.symbol || t.currency;
    const issuer = t.issuer;
    if (issuer && symbol) {
      const url = `https://cdn.bithomp.com/issued-token/${issuer}/${symbol}`;
      window.open(url, '_blank');
    }
  };

  const handleRemoveTrustLine = (t: TokenItem) => {
    setShowTrustlineModal(true);
  };

  const handleSellAndRemove = (t: TokenItem) => {
    setSellToken(t);
    setShowSellModal(true);
  };

  // Sell token feature
  const handleSellToken = async (token: TokenItem) => {
    if (!isAuthenticated) {
      toast({ title: 'Login required', description: 'Please login to sell tokens', variant: 'destructive' });
      return;
    }

    const confirmData = {
      type: 'swap' as const,
      details: {
        from: walletAddress,
        token: `${token.symbol} (${token.currency})`,
        amount: token.balance.toString(),
        estimatedFee: '0.00001 XRP',
        warning: 'This will swap your tokens for XRP. Please review the exchange rate carefully.'
      },
      onConfirm: async () => {
        try {
          // Open swap modal with pre-filled token
          setTab('swap');
          setShowSellModal(false);
          toast({ title: 'Opening swap...', description: 'Please complete the swap in the Swap tab' });
        } catch (error: any) {
          toast({ title: 'Failed to initiate swap', description: error?.message || 'Please try again', variant: 'destructive' });
        }
      }
    };

    setConfirmTxData(confirmData);
    setShowConfirmModal(true);
  };

  // Burn dust feature - detect tokens worth less than $1
  const detectDustTokens = () => {
    const dust = tokens.filter(t => {
      const bal = typeof t.balance === 'string' ? parseFloat(t.balance) : t.balance || 0;
      const value = bal * (t.price_usd || 0);
      return value < 1 && value > 0; // Less than $1 but not zero
    });
    setDustTokens(dust);
    return dust;
  };

  const handleBurnDust = () => {
    const dust = detectDustTokens();
    if (dust.length === 0) {
      toast({ title: 'No dust tokens', description: 'You have no tokens worth less than $1' });
      return;
    }
    setSelectedDustTokens(new Set(dust.map(tokenKey)));
    setShowBurnDustModal(true);
  };

  const handleBurnDustConfirm = async () => {
    if (!isAuthenticated) {
      toast({ title: 'Login required', description: 'Please login to burn tokens', variant: 'destructive' });
      return;
    }

    const selectedTokens = dustTokens.filter(t => selectedDustTokens.has(tokenKey(t)));
    if (selectedTokens.length === 0) {
      toast({ title: 'No tokens selected', description: 'Please select tokens to burn', variant: 'destructive' });
      return;
    }

    const confirmData = {
      type: 'burn' as const,
      details: {
        from: walletAddress,
        amount: `${selectedTokens.length} dust token(s)`,
        estimatedFee: `${selectedTokens.length * 0.00001} XRP`,
        warning: 'This will remove trustlines for selected tokens. Any remaining balance will be lost.'
      },
      onConfirm: async () => {
        try {
          // Remove trustlines for dust tokens
          const pass = prompt('Enter your wallet password to burn dust tokens:');
          if (!pass) return;

          let successCount = 0;
          let failCount = 0;

          for (const token of selectedTokens) {
            try {
              const resp = await fetch(`/api/xrpl/trustline/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  walletAddress,
                  walletPassword: pass,
                  currency: token.currency,
                  issuer: token.issuer,
                  walletType: 'imported'
                })
              });

              if (resp.ok) {
                successCount++;
              } else {
                failCount++;
              }
            } catch {
              failCount++;
            }
          }

          setShowBurnDustModal(false);
          
          if (successCount > 0) {
            setSuccessTxData({
              txHash: `batch-${Date.now()}`,
              type: 'burn',
              details: {
                amount: `${successCount} token(s)`,
                fee: `${successCount * 0.00001} XRP`,
                timestamp: new Date().toISOString()
              }
            });
            setShowSuccessModal(true);

            // Refresh tokens
            setTimeout(() => window.location.reload(), 2000);
          }

          if (failCount > 0) {
            toast({ 
              title: 'Partial success', 
              description: `${successCount} tokens removed, ${failCount} failed`,
              variant: 'destructive' 
            });
          }
        } catch (error: any) {
          toast({ title: 'Failed to burn dust', description: error?.message || 'Please try again', variant: 'destructive' });
        }
      }
    };

    setConfirmTxData(confirmData);
    setShowConfirmModal(true);
  };

  const handleAcceptOffer = async (offer: Offer) => {
    if (!isAuthenticated) {
      toast({ title: 'Login required', description: 'Please login to accept offers' });
      return;
    }
    const pass = prompt('Enter your wallet password to accept this offer:');
    if (!pass) return;
    setAcceptingOffer(offer.offerIndex);
    try {
      const resp = await fetch(`/api/nft-wallet/offers/${offer.offerIndex}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletPassword: pass, walletType: 'imported' })
      });
      if (resp.ok) {
        toast({ title: 'Offer accepted', description: 'The offer was accepted successfully.' });
        // refresh offers
        setOffers(prev => prev.filter(o => o.offerIndex !== offer.offerIndex));
      } else {
        const err = (await resp.json() as any).catch(() => ({}));
        toast({ title: 'Failed to accept offer', description: err?.error || 'Please try again', variant: 'destructive' });
      }
    } finally {
      setAcceptingOffer(null);
    }
  };

  const handleDeclineOffer = async (offer: Offer) => {
    if (!isAuthenticated) {
      toast({ title: 'Login required', description: 'Please login to decline offers' });
      return;
    }
    setDecliningOffer(offer.offerIndex);
    try {
      const resp = await fetch(`/api/nft-wallet/offers/${offer.offerIndex}/reject`, { method: 'POST' });
      if (resp.ok) {
        toast({ title: 'Offer declined' });
        setOffers(prev => prev.filter(o => o.offerIndex !== offer.offerIndex));
      } else {
        const err = (await resp.json() as any).catch(() => ({}));
        toast({ title: 'Failed to decline offer', description: err?.error || 'Please try again', variant: 'destructive' });
      }
    } finally {
      setDecliningOffer(null);
    }
  };

  const tokensTotalValue = tokens.reduce((sum, t) => {
    const bal = typeof t.balance === 'string' ? parseFloat(t.balance) : t.balance || 0;
    return sum + (t.price_usd ? bal * t.price_usd : 0);
  }, 0);

  const totalWalletValue = xrpBalance * (xrpPrice || 0) + tokensTotalValue;

  // Refresh handler
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <StandardWalletLayout
      chain={{
        name: 'XRP Ledger',
        symbol: 'XRP',
        logo: 'https://cdn.bithomp.com/chains/xrp.svg',
        color: '#23292F'
      }}
      address={walletAddress}
      balance={{
        native: xrpBalance.toFixed(4),
        usd: (xrpBalance * xrpPrice).toFixed(2)
      }}
      isLoading={loading}
      onRefresh={handleRefresh}
      actions={[
        {
          label: 'Send',
          icon: 'send',
          onClick: () => window.location.href = '/send'
        },
        {
          label: 'Receive',
          icon: 'receive',
          onClick: () => window.location.href = '/receive'
        },
        {
          label: 'Swap',
          icon: 'swap',
          onClick: () => setTab('swap')
        },
        {
          label: 'Burn Dust',
          icon: 'burn',
          onClick: handleBurnDust
        }
      ]}
    >

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Value</Typography>
              <Typography variant="h5">${totalWalletValue.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Tokens</Typography>
              <Typography variant="h5">{tokens.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">NFTs</Typography>
              <Typography variant="h5">{nfts.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
        <CardHeader title={
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab value="overview" label="Overview" />
            <Tab value="tokens" label={`Tokens (${tokens.length})`} />
            <Tab value="swap" label="Swap" />
            <Tab value="nfts" label={`NFTs (${nfts.length})`} />
            <Tab value="offers" label={`Offers (${offers.length})`} />
            <Tab value="transactions" label="Transactions" />
          </Tabs>
        } />
        <CardContent>
          {tab === 'overview' && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Wallet Overview</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Available Balance</Typography>
                  <Typography variant="h6">{availableBalance.toFixed(4)} XRP</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Reserved Balance</Typography>
                  <Typography variant="h6">{reservedBalance.toFixed(4)} XRP</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Token Value</Typography>
                  <Typography variant="h6">${tokensTotalValue.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">XRP Price</Typography>
                  <Typography variant="h6">${xrpPrice.toFixed(4)}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
          {tab === 'tokens' && (
            <TokensList
              tokens={tokens}
              selected={selected}
              failedImages={failedImages}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onBulkRemove={handleBulkRemove}
              onViewToken={handleViewToken}
              onViewTokenOnExplorer={handleViewOnExplorer}
              onRemoveTrustLine={handleRemoveTrustLine}
              onSellAndRemove={handleSellAndRemove}
              canRemoveFn={(t) => ({ canRemove: (typeof t.balance === 'string' ? parseFloat(t.balance) : t.balance || 0) === 0 })}
            />
          )}
          {tab === 'swap' && (
            <ModernXRPLSwap
              isWalletConnected={!!isAuthenticated}
              walletAddress={walletAddress}
              walletHandle={user?.handle || null}
              balance={'0'}
              totalBalance={'0'}
              reserve={'0'}
              availableTokens={tokens as any}
            />
          )}
          {tab === 'nfts' && (
            <>
              {!selectedCollection ? (
                <NftCollections
                  collections={collectionsMap}
                  onSelectCollection={(collectionName, nfts) => {
                    setSelectedCollection({ name: collectionName, nfts });
                  }}
                />
              ) : (
                <WalletCollectionView
                  collectionName={selectedCollection.name}
                  nfts={selectedCollection.nfts}
                  onBack={() => setSelectedCollection(null)}
                  onSelectNFT={(nft) => {
                    const nftId = nft.nftokenID || nft.NFTokenID || nft.nft_id || nft.tokenID;
                    if (nftId) {
                      window.location.href = `/nft/${nftId}`;
                    }
                  }}
                />
              )}
            </>
          )}
          {tab === 'offers' && (
            <OffersList
              offers={offers}
              walletAddress={walletAddress}
              onAccept={handleAcceptOffer}
              onDecline={handleDeclineOffer}
              acceptingOffer={acceptingOffer}
              decliningOffer={decliningOffer}
              showNotifications={true}
            />
          )}
          {tab === 'transactions' && (
            <TransactionsList
              transactions={transactions}
              availableTokens={tokens as any}
              walletAddress={walletAddress}
              onSelect={(tx) => {
                const hash = tx.hash;
                if (hash) window.open(`https://livenet.xrpl.org/transactions/${hash}`, '_blank');
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Trustline Manager Modal */}
      <TrustlineManager
        open={showTrustlineModal}
        onClose={() => setShowTrustlineModal(false)}
        walletAddress={walletAddress}
        onSuccess={() => {
          // Refresh tokens after operation
          if (walletAddress) {
            (async () => {
              try {
                const tResp = await fetch(`/api/xrpl/tokens/${walletAddress}`);
                if (tResp.ok) {
                  const t = await tResp.json();
                  const list = Array.isArray(t?.tokens) ? t.tokens : [];
                  const normalized: TokenItem[] = list.map((it: any) => ({
                    currency: it.currency || it.symbol,
                    issuer: it.issuer,
                    balance: typeof it.balance === 'number' ? it.balance : parseFloat(it.balance || '0'),
                    symbol: it.symbol || it.currency,
                    name: it.name || it.symbol || it.currency,
                    icon_url: it.icon_url || it.logo_url || it.logoURI || (it.issuer && it.symbol ? `https://cdn.bithomp.com/issued-token/${it.issuer}/${it.symbol}` : undefined),
                    price_usd: it.price_usd || 0,
                  }));
                  setTokens(normalized);
                }
              } catch {}
            })();
          }
        }}
      />

      {/* Transaction Success Modal */}
      {successTxData && (
        <TransactionSuccessModal
          open={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessTxData(null);
          }}
          txHash={successTxData!.txHash}
          explorerUrl={`https://livenet.xrpl.org/transactions/${successTxData!.txHash}`}
          chain={{
            name: 'XRP Ledger',
            logo: 'https://cdn.bithomp.com/chains/xrp.svg',
            color: '#23292F',
            explorerUrl: 'https://livenet.xrpl.org',
            explorerTxPath: '/transactions'
          }}
          type={successTxData!.type}
          details={successTxData!.details}
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
            name: 'XRP Ledger',
            logo: 'https://cdn.bithomp.com/chains/xrp.svg',
            color: '#23292F'
          }}
          type={confirmTxData.type}
          details={confirmTxData.details}
          requiresDisclaimer={true}
        />
      )}

      {/* Burn Dust Modal */}
      {showBurnDustModal && (
        <Card sx={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 500, width: '90%', zIndex: 9999, bgcolor: 'background.paper' }}>
          <CardHeader title={<Typography variant="h6">Burn Dust Tokens</Typography>} />
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select tokens worth less than $1 to remove their trustlines. Any remaining balance will be lost.
            </Typography>
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {dustTokens.map(t => {
                const key = tokenKey(t);
                const isSelected = selectedDustTokens.has(key);
                const bal = typeof t.balance === 'string' ? parseFloat(t.balance) : t.balance || 0;
                const value = bal * (t.price_usd || 0);
                return (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        const newSet = new Set(selectedDustTokens);
                        if (e.target.checked) newSet.add(key);
                        else newSet.delete(key);
                        setSelectedDustTokens(newSet);
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{t.symbol || t.currency}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {bal.toFixed(6)} (${value.toFixed(4)})
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button variant="outlined" onClick={() => setShowBurnDustModal(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleBurnDustConfirm} fullWidth disabled={selectedDustTokens.size === 0}>
                Burn {selectedDustTokens.size} Token(s)
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </StandardWalletLayout>
  );
}
