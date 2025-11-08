import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Grid, InputAdornment, Slider, TextField, Typography, Chip } from '@mui/material';
import { useWallets } from '@/contexts/WalletsContext';
import TokenPicker, { TokenChip, XRPLToken } from '../common/TokenPicker';

interface Quote {
  success: boolean;
  expectedOutput?: number;
  minOutput?: number;
  rate?: number;
  platformFeeXrp?: number;
  error?: string;
}

export default function XRPLSwap() {
  const { wallets } = useWallets();
  const [fromToken, setFromToken] = useState<XRPLToken>({ symbol: 'XRP', issuer: '' });
  const [toToken, setToToken] = useState<XRPLToken>({ symbol: 'RDL', issuer: '' });
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(10);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [xrpBalance, setXrpBalance] = useState<number | null>(null);
  const [fromBalance, setFromBalance] = useState<string | null>(null);
  const [networkFeeXrp, setNetworkFeeXrp] = useState<number | null>(null);
  const [openFromPicker, setOpenFromPicker] = useState(false);
  const [openToPicker, setOpenToPicker] = useState(false);

  const minReceived = useMemo(() => quote?.minOutput ?? 0, [quote]);

  useEffect(() => {
    const t = setTimeout(() => { void refreshQuote(); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken.symbol, fromToken.issuer, toToken.symbol, toToken.issuer, amount, slippage]);

  useEffect(() => {
    const load = async () => {
      if (!wallets.xrpl) { setXrpBalance(null); return; }
      try {
        const r = await fetch(`/api/xrpl/balance/${wallets.xrpl}`);
        const j = await r.json();
        const bal = parseFloat(j.balance || j.totalBalance || '0');
        setXrpBalance(isNaN(bal) ? 0 : bal);
      } catch { setXrpBalance(null); }
    };
    void load();
  }, [wallets.xrpl]);

  // Load balance for selected from token (XRPL)
  useEffect(() => {
    const loadTokenBal = async () => {
      setFromBalance(null);
      if (!wallets.xrpl) return;
      if (fromToken.symbol === 'XRP') {
        // already loaded into xrpBalance
        setFromBalance(xrpBalance != null ? String(xrpBalance) : null);
        return;
      }
      if (!fromToken.issuer) return;
      try {
        const r = await fetch(`/api/xrpl/token-balance/${wallets.xrpl}/${fromToken.symbol}/${fromToken.issuer}`);
        const j = await r.json();
        if (j && (j.balance || j.value)) setFromBalance(String(j.balance || j.value));
      } catch {/* ignore */}
    };
    void loadTokenBal();
  }, [wallets.xrpl, fromToken.symbol, fromToken.issuer, xrpBalance]);

  const refreshQuote = async () => {
    const amt = parseFloat(amount);
    if (!fromToken.symbol || !toToken.symbol || !amount || isNaN(amt) || amt <= 0) {
      setQuote(null);
      setNetworkFeeXrp(null);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/xrpl/swap/v2/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: fromToken.symbol,
          toToken: toToken.symbol,
          amount: amt,
          fromIssuer: fromToken.issuer,
          toIssuer: toToken.issuer,
          slippagePercent: slippage
        })
      });
      const data = await resp.json();
      setQuote(data);
      // Attempt to prepare for a fee estimate when wallet is known
      if (wallets.xrpl) {
        try {
          const prep = await fetch('/api/xrpl/swap/v2/prepare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account: wallets.xrpl,
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              amount: amt,
              fromIssuer: fromToken.issuer,
              toIssuer: toToken.issuer,
              slippagePercent: slippage
            })
          });
          const pj = await prep.json();
          const fee = pj.feeXRP ?? pj.estimatedFeeXrp ?? pj.networkFeeXrp ?? pj.fee ?? null;
          setNetworkFeeXrp(typeof fee === 'number' ? fee : (fee ? parseFloat(fee) : null));
        } catch {
          setNetworkFeeXrp(null);
        }
      } else {
        setNetworkFeeXrp(null);
      }
    } catch (e) {
      setQuote({ success: false, error: 'Quote failed' });
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    const amt = parseFloat(amount);
    if (!amt || !quote?.success) return;
    try {
      const resp = await fetch('/api/xrpl/swap/v2/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: fromToken.symbol,
          toToken: toToken.symbol,
          amount: amt,
          fromIssuer: fromToken.issuer,
          toIssuer: toToken.issuer,
          slippagePercent: slippage
        })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Swap failed');
      alert(`Swap submitted: ${data.txHash}`);
    } catch (e: any) {
      alert(e.message || 'Swap failed');
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="body2" color="text.secondary">Wallet: {wallets.xrpl ? `${wallets.xrpl.slice(0,6)}…${wallets.xrpl.slice(-6)}` : 'Not connected'}</Typography>
          <Typography variant="body2" color="text.secondary">XRP: {xrpBalance ?? '—'}{fromToken.symbol !== 'XRP' && fromBalance != null ? ` · ${fromToken.symbol}: ${Number(fromBalance).toFixed(4)}` : ''}</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">From</Typography>
            <Box display="flex" gap={1} alignItems="center">
              <TokenChip token={fromToken} onClick={() => setOpenFromPicker(true)} placeholder="Select from token" />
              {fromBalance != null && (
                <Chip size="small" label={`Bal: ${Number(fromBalance).toFixed(4)}`} />
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">To</Typography>
            <TokenChip token={toToken} onClick={() => setOpenToPicker(true)} placeholder="Select to token" />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">{fromToken.symbol}</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box>
              <Typography gutterBottom>Slippage: {slippage}%</Typography>
              <Slider value={slippage} onChange={(_, val) => setSlippage(val as number)} min={0.1} max={50} step={0.1} />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Button variant="contained" onClick={refreshQuote} disabled={loading}>Get Quote</Button>
            <Button sx={{ ml: 2 }} variant="outlined" onClick={execute} disabled={!quote?.success}>Swap</Button>
          </Grid>

          {quote?.success && (
            <Grid item xs={12}>
              <Box mt={2}>
                <Typography variant="body2">Rate: 1 {fromToken.symbol} = {quote.rate?.toFixed?.(6)} {toToken.symbol}</Typography>
                <Typography variant="body2">Expected: {quote.expectedOutput?.toFixed?.(6)} {toToken.symbol}</Typography>
                <Typography variant="body2">Minimum (slippage {slippage}%): {minReceived?.toFixed?.(6)} {toToken.symbol}</Typography>
                {typeof quote.platformFeeXrp === 'number' && (
                  <Typography variant="body2">Platform Fee: {quote.platformFeeXrp.toFixed(6)} XRP</Typography>
                )}
                {typeof networkFeeXrp === 'number' && (
                  <Typography variant="body2">Estimated Network Fee: {networkFeeXrp.toFixed(6)} XRP</Typography>
                )}
                <Typography variant="caption" color="text.secondary">Network fee will be included in the transaction.</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
      <TokenPicker open={openFromPicker} onClose={() => setOpenFromPicker(false)} onSelect={(t) => setFromToken(t)} />
      <TokenPicker open={openToPicker} onClose={() => setOpenToPicker(false)} onSelect={(t) => setToToken(t)} />
    </Card>
  );
}
