import React, { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, FormControl, InputLabel, MenuItem, Select, Tab, Tabs, Typography, Button } from '@mui/material';
import XRPLSwap from './xrpl/Swap';
import XRPLLimitOrders from './xrpl/LimitOrders';
import XRPLLiquidity from './xrpl/Liquidity';
import EVMSwap from './evm/Swap';
import WalletConnectModal from './common/WalletConnectModal';
import { WalletsProvider } from '@/contexts/WalletsContext';

export type ChainKey = 'XRPL' | 'Ethereum' | 'BSC' | 'Polygon' | 'Arbitrum' | 'Optimism' | 'Base';

const CHAINS: ChainKey[] = ['XRPL', 'Ethereum', 'BSC', 'Polygon', 'Arbitrum', 'Optimism', 'Base'];

type TabKey = 'swap' | 'limit' | 'liquidity';

export default function SwapHubV3() {
  const [chain, setChain] = useState<ChainKey>('XRPL');
  const [tab, setTab] = useState<TabKey>('swap');
  const [connectOpen, setConnectOpen] = useState(false);

  const tabsForChain = useMemo(() => {
    if (chain === 'XRPL') return ['swap', 'limit', 'liquidity'] as TabKey[];
    return ['swap'] as TabKey[];
  }, [chain]);

  // Read query params on mount and when URL changes
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qChain = params.get('chain');
      const qTab = params.get('tab');

      if (qChain) {
        const normalized = qChain.toLowerCase();
        const map: Record<string, ChainKey> = {
          xrpl: 'XRPL', ripple: 'XRPL', xrp: 'XRPL',
          ethereum: 'Ethereum', eth: 'Ethereum',
          bsc: 'BSC', binance: 'BSC',
          polygon: 'Polygon', matic: 'Polygon',
          arbitrum: 'Arbitrum', arb: 'Arbitrum',
          optimism: 'Optimism', op: 'Optimism',
          base: 'Base'
        };
        const mapped = map[normalized];
        if (mapped) setChain(mapped);
      }

      if (qTab) {
        const t = qTab.toLowerCase();
        if (t === 'swap' || t === 'limit' || t === 'liquidity') setTab(t as TabKey);
      }
    } catch {}
  }, []);

  // Keep URL query in sync when user changes chain/tab
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('chain', chain);
      params.set('tab', tab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    } catch {}
  }, [chain, tab]);

  return (
    <WalletsProvider>
      <Card variant="outlined">
        <CardHeader title={<Typography variant="h6">Trade Center (v3)</Typography>} />
        <CardContent>
        <Box display="flex" gap={2} alignItems="center" mb={2}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="chain-select-label">Chain</InputLabel>
            <Select
              labelId="chain-select-label"
              label="Chain"
              value={chain}
              onChange={(e) => setChain(e.target.value as ChainKey)}
            >
              {CHAINS.map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="swap" label="Swap" />
            {chain === 'XRPL' && <Tab value="limit" label="Limit Orders" />}
            {chain === 'XRPL' && <Tab value="liquidity" label="Liquidity" />}
          </Tabs>

            <Box flex={1} />
            <Button variant="outlined" size="small" onClick={() => setConnectOpen(true)}>Connect</Button>
        </Box>

        {tab === 'swap' && (
          chain === 'XRPL' ? <XRPLSwap /> : <EVMSwap chain={chain} />
        )}

        {chain === 'XRPL' && tab === 'limit' && (
          <XRPLLimitOrders />
        )}

        {chain === 'XRPL' && tab === 'liquidity' && (
          <XRPLLiquidity />
        )}
        </CardContent>
      </Card>
      <WalletConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} chain={chain === 'XRPL' ? 'XRPL' : 'EVM'} />
    </WalletsProvider>
  );
}
