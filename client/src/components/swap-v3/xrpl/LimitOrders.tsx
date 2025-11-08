import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Grid, InputAdornment, TextField, Typography } from '@mui/material';
import { useWallets } from '@/contexts/WalletsContext';

type Token = { symbol: string; issuer?: string };

type Order = {
  id: string;
  type: 'buy' | 'sell';
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  rate: string;
  status: string;
};

export default function XRPLLimitOrders() {
  const { wallets } = useWallets();
  const [from, setFrom] = useState<Token>({ symbol: 'XRP' });
  const [to, setTo] = useState<Token>({ symbol: 'RDL' });
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [rate, setRate] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [address, setAddress] = useState('');

  useEffect(() => {
    // Populate from site-wide connected XRPL wallet
    if (wallets.xrpl) setAddress(wallets.xrpl);
  }, []);

  useEffect(() => {
    if (wallets.xrpl && wallets.xrpl !== address) setAddress(wallets.xrpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.xrpl]);

  const createOrder = async () => {
    if (!address || !fromAmount || !toAmount || !rate) return;
    const resp = await fetch('/api/xrpl/offer/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: address,
        takerGets: from.symbol === 'XRP' ? (parseFloat(fromAmount) * 1_000_000).toString() : { currency: from.symbol, issuer: from.issuer, value: fromAmount },
        takerPays: to.symbol === 'XRP' ? (parseFloat(toAmount) * 1_000_000).toString() : { currency: to.symbol, issuer: to.issuer, value: toAmount },
        flags: 0x00020000,
        walletAddress: address,
        walletType: 'riddle',
        customRate: rate
      })
    });
    const data = await resp.json();
    if (!data.success) return alert(data.error || 'Failed to create order');
    alert('Order created');
    loadOrders();
  };

  const loadOrders = async () => {
    if (!address) return;
    const resp = await fetch(`/api/xrpl/offers/${address}`);
    const data = await resp.json();
    if (data.success) setOrders(data.orders || []);
  };

  useEffect(() => { void loadOrders(); }, [address]);

  const cancel = async (id: string) => {
    const resp = await fetch('/api/xrpl/offer/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: id, walletAddress: address })
    });
    const data = await resp.json();
    if (!data.success) return alert(data.error || 'Cancel failed');
    alert('Cancelled');
    loadOrders();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth label="Your XRPL Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="From Token" value={from.symbol} onChange={(e) => setFrom({ ...from, symbol: e.target.value.toUpperCase() })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="From Issuer" value={from.issuer || ''} onChange={(e) => setFrom({ ...from, issuer: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="To Token" value={to.symbol} onChange={(e) => setTo({ ...to, symbol: e.target.value.toUpperCase() })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="To Issuer" value={to.issuer || ''} onChange={(e) => setTo({ ...to, issuer: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="From Amount" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">{from.symbol}</InputAdornment> }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="To Amount" value={toAmount} onChange={(e) => setToAmount(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">{to.symbol}</InputAdornment> }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Rate (to/from)" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Grid>

          <Grid item xs={12}>
            <Button variant="contained" onClick={createOrder}>Create Limit Order</Button>
            <Button sx={{ ml: 2 }} variant="outlined" onClick={loadOrders}>Refresh Orders</Button>
          </Grid>

          <Grid item xs={12}>
            {orders.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No orders</Typography>
            ) : (
              orders.map(o => (
                <Box key={o.id} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Typography variant="body2">{o.fromAmount} {o.fromToken.symbol} → {o.toAmount} {o.toToken.symbol} @ {o.rate}</Typography>
                  <Button size="small" color="error" onClick={() => cancel(o.id)}>Cancel</Button>
                </Box>
              ))
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
