import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Grid, TextField, Typography } from '@mui/material';
import { useWallets } from '@/contexts/WalletsContext';

export default function XRPLLiquidity() {
  const { wallets } = useWallets();
  const [address, setAddress] = useState('');
  const [pools, setPools] = useState<any[]>([]);
  const [fromToken, setFromToken] = useState('XRP');
  const [fromIssuer, setFromIssuer] = useState('');
  const [toToken, setToToken] = useState('RDL');
  const [toIssuer, setToIssuer] = useState('');
  const [amount, setAmount] = useState('');
  const [check, setCheck] = useState<any>(null);

  const loadPools = async () => {
    if (!address) return;
    const r = await fetch(`/api/xrpl/liquidity/pools/${address}`);
    const j = await r.json();
    if (j.success) setPools(j.pools || []);
  };

  useEffect(() => { void loadPools(); }, [address]);

  // Populate from site-wide XRPL wallet
  useEffect(() => {
    if (wallets.xrpl) setAddress(wallets.xrpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wallets.xrpl && wallets.xrpl !== address) setAddress(wallets.xrpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.xrpl]);

  const checkLiquidity = async () => {
    const r = await fetch('/api/xrpl/liquidity/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromToken,
        toToken,
        amount,
        fromIssuer,
        toIssuer
      })
    });
    const j = await r.json();
    setCheck(j);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth label="Your XRPL Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Your Pools</Typography>
              <Button size="small" onClick={loadPools}>Refresh</Button>
            </Box>
            {pools.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No pools found</Typography>
            ) : (
              pools.map((p, idx) => (
                <Box key={idx} py={1}>
                  <Typography variant="body2">{p.pair} — TVL: {p.totalLiquidity}</Typography>
                </Box>
              ))
            )}
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1">Check Liquidity</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="From Token" value={fromToken} onChange={(e) => setFromToken(e.target.value.toUpperCase())} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="From Issuer" value={fromIssuer} onChange={(e) => setFromIssuer(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="To Token" value={toToken} onChange={(e) => setToToken(e.target.value.toUpperCase())} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="To Issuer" value={toIssuer} onChange={(e) => setToIssuer(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button variant="contained" onClick={checkLiquidity}>Check</Button>
          </Grid>

          {check && (
            <Grid item xs={12}>
              <Typography variant="body2">{check.message || (check.success ? 'OK' : 'No data')}</Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}
