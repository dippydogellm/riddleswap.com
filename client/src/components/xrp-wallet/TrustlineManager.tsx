import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Stack,
  Alert,
} from '@mui/material';

type ViewMode = 'sellable' | 'removable';

interface SellableToken {
  currency: string;
  name?: string;
  issuer: string;
  balance: string;
  limit?: string;
  symbol?: string;
}

interface RemovableTrustline {
  currency: string;
  name?: string;
  issuer: string;
  balance: string;
  limit?: string;
  symbol?: string;
}

interface TokenProcessStatus {
  currency: string;
  issuer: string;
  step: 'pending' | 'selling' | 'sold' | 'burning' | 'burned' | 'removing' | 'completed' | 'error';
  sellTxHash?: string;
  removeTxHash?: string;
  error?: string;
}

export interface TrustlineManagerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  walletAddress?: string;
}

function decodeCurrency(code?: string) {
  if (!code) return '';
  const isHex40 = /^[0-9A-Fa-f]{40}$/.test(code);
  if (isHex40) {
    try {
      const clean = code.replace(/0+$/, '');
      let ascii = '';
      for (let i = 0; i < clean.length; i += 2) {
        const byte = parseInt(clean.substring(i, i + 2), 16);
        if (!isNaN(byte)) ascii += String.fromCharCode(byte);
      }
      ascii = ascii.replace(/\0/g, '').trim();
      return ascii || code.slice(0, 8);
    } catch {
      return code.slice(0, 8);
    }
  }
  return code;
}

export const TrustlineManager: React.FC<TrustlineManagerProps> = ({ open, onClose, onSuccess, walletAddress }) => {
  const [view, setView] = useState<ViewMode>('sellable');
  const [loading, setLoading] = useState(false);
  const [sellable, setSellable] = useState<SellableToken[]>([]);
  const [removable, setRemovable] = useState<RemovableTrustline[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [useBurn, setUseBurn] = useState(false);
  const [statuses, setStatuses] = useState<TokenProcessStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'error' } | null>(null);

  // Safeguards: protect burn on specific tokens/issuers
  const PROTECTED_SYMBOLS = useMemo(() => new Set(['XRP', 'RDL']), []);
  const PROTECTED_ISSUERS = useMemo(() => new Set<string>([
    'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9' // RDL issuer
  ]), []);

  // Determine external wallet (fallback when session not present)
  const external = useMemo(() => {
    const raw = localStorage.getItem('external_wallet_session');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }, []);

  const activeAddress = walletAddress || external?.address || '';

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setConfirm(false);
    setUseBurn(false);
    setStatuses([]);
    // initial load
    if (view === 'sellable') loadSellable(); else loadRemovable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (view === 'sellable') loadSellable(); else loadRemovable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const loadSellable = async () => {
    if (!activeAddress && !walletAddress) return;
    setLoading(true);
    try {
      const url = external?.address
        ? `/api/xrpl/public/tokens/sellable/${external.address}`
        : `/api/xrpl/wallet/tokens/sellable`;
      const headers: HeadersInit = { 'Cache-Control': 'no-cache' };
      if (!external?.address) {
        const token = localStorage.getItem('sessionToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch(url, { headers });
      const data = (await resp.json() as any).catch(() => ({}));
      const list: SellableToken[] = (data.sellableTokens || data.tokens || []).map((t: any) => ({
        currency: t.currency,
        issuer: t.issuer,
        balance: t.balance,
        name: t.name,
        symbol: decodeCurrency(t.symbol || t.currency),
      }));
      setSellable(list);
    } finally {
      setLoading(false);
    }
  };

  const loadRemovable = async () => {
    if (!activeAddress && !walletAddress) return;
    setLoading(true);
    try {
      const url = external?.address
        ? `/api/xrpl/public/trustlines/removable/${external.address}`
        : `/api/xrpl/wallet/trustlines/removable`;
      const headers: HeadersInit = { 'Cache-Control': 'no-cache' };
      if (!external?.address) {
        const token = localStorage.getItem('sessionToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch(url, { headers });
      const data = (await resp.json() as any).catch(() => ({}));
      const list: RemovableTrustline[] = (data.removableTrustlines || data.trustlines || []).map((t: any) => ({
        currency: t.currency,
        issuer: t.issuer,
        balance: t.balance || '0',
        name: t.name,
        symbol: decodeCurrency(t.symbol || t.currency),
      }));
      setRemovable(list);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const process = async () => {
    if (selected.length === 0 || !confirm) return;
    setProcessing(true);
    const items = (view === 'sellable' ? sellable : removable)
      .filter(t => selected.includes(`${t.currency}:${t.issuer}`));
    setStatuses(items.map(it => ({ currency: it.currency, issuer: it.issuer, step: 'pending' })));

    try {
      for (const item of items) {
        // sell/burn when sellable, otherwise just remove
        if (view === 'sellable') {
          if (useBurn) {
            // burn
            setSnack({ open: true, message: `Burning ${decodeCurrency(item.symbol || item.currency)}…`, severity: 'info' });
            setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'burning' } : s));
            const burnResp = await fetch('/api/wallet/tokens/burn', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`
              },
              body: JSON.stringify({ currency: item.currency, issuer: item.issuer, amount: item.balance })
            });
            const burn = (await burnResp.json() as any).catch(() => ({}));
            if (!burnResp.ok || burn.success === false) {
              setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'error', error: burn?.error || 'Burn failed' } : s));
              setSnack({ open: true, message: burn?.error || 'Burn failed', severity: 'error' });
              continue;
            }
            setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'burned', sellTxHash: burn?.txHash } : s));
            setSnack({ open: true, message: 'Burned successfully', severity: 'success' });
          } else {
            // sell to XRP
            setSnack({ open: true, message: `Selling ${decodeCurrency(item.symbol || item.currency)} to XRP…`, severity: 'info' });
            setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'selling' } : s));
            const sellResp = await fetch('/api/wallet/tokens/sell-to-xrp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`
              },
              body: JSON.stringify({ currency: item.currency, issuer: item.issuer, amount: item.balance, slippage: 5 })
            });
            const sell = (await sellResp.json() as any).catch(() => ({}));
            if (!sellResp.ok || sell.success === false) {
              setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'error', error: sell?.error || 'Sell failed' } : s));
              setSnack({ open: true, message: sell?.error || 'Sell failed', severity: 'error' });
              continue;
            }
            setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'sold', sellTxHash: sell?.txHash } : s));
            setSnack({ open: true, message: 'Sold successfully', severity: 'success' });
          }
        }

        // remove trustline
        setSnack({ open: true, message: 'Removing trustline…', severity: 'info' });
        setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'removing' } : s));
        const removeResp = await fetch('/api/wallet/trustline/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`
          },
          body: JSON.stringify({ currency: item.currency, issuer: item.issuer, confirmRemoval: true })
        });
        const rem = (await removeResp.json() as any).catch(() => ({}));
        if (!removeResp.ok || rem.success === false) {
          setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'error', error: rem?.error || 'Remove failed' } : s));
          setSnack({ open: true, message: rem?.error || 'Remove failed', severity: 'error' });
          continue;
        }
        setStatuses(prev => prev.map(s => s.currency === item.currency && s.issuer === item.issuer ? { ...s, step: 'completed', removeTxHash: rem?.txHash } : s));
        setSnack({ open: true, message: 'Trustline removed', severity: 'success' });
      }

      // refresh lists
      await (view === 'sellable' ? loadSellable() : loadRemovable());
      setSelected([]);
      if (onSuccess) onSuccess();
    } finally {
      setProcessing(false);
    }
  };

  const renderList = () => {
    const list = view === 'sellable' ? sellable : removable;
    if (loading) {
      return (
        <Box py={4} display="flex" justifyContent="center"><CircularProgress size={24} /></Box>
      );
    }
    if (!list || list.length === 0) {
      return (
        <Box py={4} textAlign="center">
          <Typography variant="body2" color="text.secondary">No {view === 'sellable' ? 'tokens with balance' : 'zero-balance trustlines'} found</Typography>
        </Box>
      );
    }
    return (
      <Stack spacing={1.5}>
        {list.map((t) => {
          const key = `${t.currency}:${t.issuer}`;
          const selectedItem = selected.includes(key);
          const st = statuses.find(s => s.currency === t.currency && s.issuer === t.issuer);
          return (
            <Paper key={key} sx={{ p: 1.5, border: 1, borderColor: selectedItem ? 'primary.main' : 'divider', bgcolor: selectedItem ? 'action.selected' : 'background.paper' }}>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={12} sm={6} md={7}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Checkbox checked={selectedItem} onChange={() => toggle(key)} />
                    <Typography variant="subtitle2" fontWeight={600}>{t.symbol || decodeCurrency(t.currency)}</Typography>
                    <Chip size="small" label={(t.balance && parseFloat(t.balance) > 0) ? 'Has Balance' : 'Zero'} color={(t.balance && parseFloat(t.balance) > 0) ? 'warning' : 'success'} variant="outlined" />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>Issuer: {t.issuer}</Typography>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <Typography variant="body2" textAlign="right">{(parseFloat(t.balance || '0') || 0).toFixed(6)}</Typography>
                  <Typography variant="caption" color="text.secondary" textAlign="right">Balance</Typography>
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  {st ? (
                    <Chip size="small" color={st.step === 'completed' ? 'success' : st.step === 'error' ? 'error' : 'info'}
                      label={st.step.charAt(0).toUpperCase() + st.step.slice(1)} />
                  ) : null}
                </Grid>
              </Grid>
            </Paper>
          );
        })}
      </Stack>
    );
  };

  const selectedItems = useMemo(() =>
    (view === 'sellable' ? sellable : removable)
      .filter(t => selected.includes(`${t.currency}:${t.issuer}`)),
    [selected, view, sellable, removable]
  );

  const canShowBurn = useMemo(() => {
    if (view !== 'sellable') return false;
    const items = selectedItems.length > 0 ? selectedItems : sellable;
    if (items.length === 0) return false;
    return items.every(it => it.issuer && !PROTECTED_ISSUERS.has(it.issuer) && !PROTECTED_SYMBOLS.has((it.symbol || decodeCurrency(it.currency)).toUpperCase()));
  }, [view, selectedItems, sellable, PROTECTED_ISSUERS, PROTECTED_SYMBOLS]);

  return (
    <Dialog open={open} onClose={processing ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Sell / Burn / Remove Trustlines</DialogTitle>
      <DialogContent>
        {!activeAddress && (
          <Alert severity="warning" sx={{ mb: 2 }}>No wallet address detected. Please connect or login.</Alert>
        )}
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
          <Tab value="sellable" label={`Sell or Burn (${sellable.length})`} />
          <Tab value="removable" label={`Remove (${removable.length})`} />
        </Tabs>

        {view === 'sellable' && canShowBurn && (
          <FormControlLabel
            control={<Checkbox checked={useBurn} onChange={e => setUseBurn(e.target.checked)} />}
            label="Use Burn instead of Sell (send tokens to issuer's burn address)"
            sx={{ mb: 1 }}
          />
        )}

        {renderList()}

        <Box mt={2}>
          <FormControlLabel
            control={<Checkbox checked={confirm} onChange={e => setConfirm(e.target.checked)} />}
            label="I understand these actions are permanent and irreversible"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>Cancel</Button>
        <Button variant="contained" onClick={process} disabled={!confirm || selected.length === 0 || processing}>
          {processing ? 'Processing…' : view === 'sellable' ? (useBurn ? 'Burn & Remove' : 'Sell & Remove') : 'Remove Trustlines'}
        </Button>
      </DialogActions>
      {snack && (
        <Alert
          severity={snack.severity}
          sx={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1400 }}
          onClose={() => setSnack(s => s ? { ...s, open: false } : null)}
        >
          {snack.message}
        </Alert>
      )}
    </Dialog>
  );
};

export default TrustlineManager;
