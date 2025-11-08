import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Slider, TextField, Typography } from '@mui/material';

import type { ChainKey } from '../SwapHub';

type Supported = {
  chainId: number;
  label: string;
};

const SUPPORTED: Record<ChainKey, Supported> = {
  XRPL: { chainId: 0, label: 'XRPL' },
  Ethereum: { chainId: 1, label: 'Ethereum' },
  BSC: { chainId: 56, label: 'BSC' },
  Polygon: { chainId: 137, label: 'Polygon' },
  Arbitrum: { chainId: 42161, label: 'Arbitrum' },
  Optimism: { chainId: 10, label: 'Optimism' },
  Base: { chainId: 8453, label: 'Base' }
};

export default function EVMSwap({ chain }: { chain: ChainKey }) {
  const [fromToken, setFromToken] = useState('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [quote, setQuote] = useState<any>(null);

  const chainId = useMemo(() => SUPPORTED[chain].chainId, [chain]);

  useEffect(() => {
    setQuote(null);
  }, [chainId, fromToken, toToken, amount, slippage]);

  const getQuote = async () => {
    const r = await fetch(`/api/swap/evm/quote?chainId=${chainId}&fromToken=${fromToken}&toToken=${toToken}&amount=${amount}&slippage=${slippage}`);
    const j = await r.json();
    if (!j.success) return alert(j.error || 'Quote failed');
    setQuote(j.quote);
  };

  const execute = async () => {
    const r = await fetch('/api/swap/evm/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId, fromToken, toToken, amount, slippage })
    });
    const j = await r.json();
    if (!j.success) return alert(j.error || 'Swap failed');
    alert('Swap sent');
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box display="flex" gap={2} mb={2}>
          <FormControl size="small" sx={{ minWidth: 180 }} disabled>
            <InputLabel>Chain</InputLabel>
            <Select label="Chain" value={chainId}>
              <MenuItem value={chainId}>{chain}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
          <TextField fullWidth label="From Token (address or 0xEE.. for native)" value={fromToken} onChange={(e) => setFromToken(e.target.value)} />
          <TextField fullWidth label="To Token (address)" value={toToken} onChange={(e) => setToToken(e.target.value)} />
          <TextField fullWidth label="Amount (wei for ERC20, wei for native)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Box>
            <Typography gutterBottom>Slippage: {slippage}%</Typography>
            <Slider value={slippage} onChange={(_, v) => setSlippage(v as number)} min={0.1} max={5} step={0.1} />
          </Box>
        </Box>

        <Box mt={2}>
          <Button variant="contained" onClick={getQuote}>Get Quote</Button>
          <Button sx={{ ml: 2 }} variant="outlined" onClick={execute} disabled={!quote}>Swap</Button>
        </Box>

        {quote && (
          <Box mt={2}>
            <Typography variant="body2">Estimated Out: {quote.toAmount}</Typography>
            <Typography variant="body2">Gas: {quote.estimatedGas}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
