import React, { useEffect, useMemo, useState } from 'react';
import { Container, Card, CardContent, CardHeader, Typography, Grid, Button, Tabs, Tab, CircularProgress } from '@mui/material';
import ModernXRPLSwap from '@/components/modern-xrpl-swap';
import { useAuth } from '@/hooks/useAuth';
import { HeaderSummary } from '@/components/xrp-wallet/HeaderSummary';
import { ActionButtons } from '@/components/xrp-wallet/ActionButtons';
import { TokensList, TokenItem } from '@/components/xrp-wallet/TokensList';
import { NftCollections, NftItem } from '@/components/xrp-wallet/NftCollections';
import { OffersList, Offer } from '@/components/xrp-wallet/OffersList';
import { TransactionsList, TransactionItem } from '@/components/xrp-wallet/TransactionsList';
import TrustlineManager from '@/components/xrp-wallet/TrustlineManager';
import { useToast } from '@/hooks/use-toast';

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

  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [decliningOffer, setDecliningOffer] = useState<string | null>(null);

  // Trustline manager modal
  const [showTrustlineModal, setShowTrustlineModal] = useState(false);

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

        // NFTs (public)
        try {
          const nResp = await fetch(`/api/wallet/nfts-public/${walletAddress}`);
          if (nResp.ok) {
            const n = await nResp.json();
            const arr = n?.nfts || n?.items || [];
            const normalized: NftItem[] = arr.map((it: any) => {
              let image = it.image || it.metadata?.image || it.nftoken?.metadata?.image;
              if (typeof image === 'string' && image.startsWith('ipfs://')) {
                image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
              }
              return {
                nftokenID: it.nftokenID || it.NFTokenID || it.nft_id || it.tokenID,
                NFTokenID: it.NFTokenID,
                tokenID: it.tokenID,
                nft_id: it.nft_id,
                image,
                name: it.name || it.metadata?.name || it.nftoken?.name,
                collectionName: it.collectionName || it.collection?.name,
                collection: it.collection,
                issuer: it.issuer,
                nftokenTaxon: it.nftokenTaxon || it.NFTokenTaxon,
                NFTokenTaxon: it.NFTokenTaxon,
                attributes: it.attributes,
              } as NftItem;
            });
            setNfts(normalized);
          } else {
            setNfts([]);
          }
        } catch {
          setNfts([]);
        }

        // Offers (public)
        try {
          const oResp = await fetch(`/api/nft-offers-public/${walletAddress}`);
          if (oResp.ok) {
            const o = await oResp.json();
            const normalized: Offer[] = (o || []).map((it: any) => ({
              offerIndex: it.offerIndex || it.offer_index || it.id,
              destination: it.destination,
              amount: it.amount?.toString?.() || it.amount || '0',
              flags: it.flags,
              nftoken: it.nftoken || it.nft || it.token,
              nftokenID: (it.nftokenID || it.NFTokenID || it.nft_id || it.tokenID || '').toString(),
              account: it.account || it.owner,
            }));
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
    setShowTrustlineModal(true);
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
        <CardHeader title={<Typography variant="h5">XRPL Wallet</Typography>} />
        <CardContent>
          <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid item xs={12} sm>
              <Typography variant="body2" color="text.secondary">Address</Typography>
              <Typography variant="subtitle2" sx={{ wordBreak: 'break-all' }}>{walletAddress || 'Not connected'}</Typography>
            </Grid>
            <Grid item>
              <Button variant="outlined" onClick={() => (window.location.href = '/wallet-login')}>
                {isAuthenticated ? 'Switch Wallet' : 'Connect Wallet'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary */}
      <HeaderSummary
        totalWalletValue={xrpBalance * (xrpPrice || 0) + tokens.reduce((sum, t) => {
          const bal = typeof t.balance === 'string' ? parseFloat(t.balance) : t.balance || 0;
          return sum + (t.price_usd ? bal * t.price_usd : 0);
        }, 0)}
        xrpBalance={xrpBalance}
        xrpPrice={xrpPrice}
        availableBalance={availableBalance || xrpBalance}
        reservedBalance={reservedBalance}
        tokensCount={tokens.length}
        nftsCount={nfts.length}
        xrpValue={xrpBalance * (xrpPrice || 0)}
        tokenValues={tokens.reduce((sum, t) => {
          const bal = typeof t.balance === 'string' ? parseFloat(t.balance) : t.balance || 0;
          return sum + (t.price_usd ? bal * t.price_usd : 0);
        }, 0)}
        nftValue={0}
      />

      {/* Address actions */}
      <ActionButtons
        onSend={() => { window.location.href = '/send'; }}
        onReceive={() => { window.location.href = '/receive'; }}
        onSwap={() => setTab('swap')}
      />

      {/* Tabs */}
      <Card sx={{ mt: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
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
            <Typography variant="body2" color="text.secondary">Select a tab to view details.</Typography>
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
            <NftCollections
              collections={collectionsMap}
              onSelectCollection={() => {}}
            />
          )}
          {tab === 'offers' && (
            <OffersList
              offers={offers}
              walletAddress={walletAddress}
              onAccept={handleAcceptOffer}
              onDecline={handleDeclineOffer}
              acceptingOffer={acceptingOffer}
              decliningOffer={decliningOffer}
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
    </Container>
  );
}
