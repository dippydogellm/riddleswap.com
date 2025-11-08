import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs, Typography } from '@mui/material';
import { useWallets } from '@/contexts/WalletsContext';
import { connectEvmWithReown } from '@/lib/reown';

export default function WalletConnectModal({ open, onClose, chain }: { open: boolean; onClose: () => void; chain: 'XRPL' | 'EVM'; }) {
  const { setXRPL, setEVM } = useWallets();
  const [tab, setTab] = useState<'riddle' | 'xaman' | 'joey' | 'reown'>('riddle');
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [uuid, setUuid] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');

  useEffect(() => { if (!open) { reset(); } }, [open]);

  const reset = () => {
    setLoading(false);
    setQr(null);
    setDeepLink(null);
    setUuid(null);
    setStatus('idle');
  };

  const startXaman = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/external-wallets/xaman/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payloadType: 'signin', purpose: 'Connect XRPL wallet' })
      });
      const j = await r.json();
      if (!j.success && !j.uuid) throw new Error(j.error || 'Failed to start Xaman');
      setQr(j.qrCode);
      setDeepLink(j.deepLink || j.webLink);
      setUuid(j.uuid);
      setStatus('pending');
      // start poll
      pollXaman(j.uuid);
    } catch (e) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const pollXaman = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/external-wallet/xaman/poll/${id}`);
        const j = await r.json();
        if (j.status === 'connected' && j.result?.account) {
          clearInterval(interval);
          setStatus('connected');
          setXRPL(j.result.account);
        }
        if (j.status === 'expired' || j.status === 'cancelled') {
          clearInterval(interval);
          setStatus(j.status);
        }
      } catch {
        // ignore
      }
    }, 2000);
  };

  const startJoey = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/external-wallets/joey/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'Connect XRPL wallet' })
      });
      const j = await r.json();
      setQr(j.qrCode);
      setDeepLink(j.deepLink);
      setUuid(j.uuid);
      setStatus('pending');
    } catch (e) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const startReown = async () => {
    setLoading(true);
    try {
      // Try Reown (WalletConnect v2 via AppKit) first
      const addr = await connectEvmWithReown();
      if (addr) {
        setEVM(addr);
        setStatus('connected');
        return;
      }
      // Fallback to injected provider (MetaMask)
      const eth = (window as any).ethereum;
      if (eth?.request) {
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        const a0 = accounts?.[0];
        if (a0) { setEVM(a0); setStatus('connected'); return; }
      }
      setStatus('error');
    } catch (e) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const content = () => {
    if (chain === 'XRPL') {
      return (
        <Box>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab value="riddle" label="Riddle Wallet" />
            <Tab value="xaman" label="Xaman" />
            <Tab value="joey" label="Joey (WC v2)" />
          </Tabs>

          {tab === 'riddle' && (
            <Box>
              <Typography variant="body2" color="text.secondary">Use your Riddle wallet session to trade.</Typography>
              <Button sx={{ mt: 2 }} variant="contained" onClick={() => { setXRPL(undefined); onClose(); }}>Use Session Wallet</Button>
            </Box>
          )}

          {tab === 'xaman' && (
            <Box>
              {!uuid ? (
                <Button variant="contained" onClick={startXaman} disabled={loading}>Connect with Xaman</Button>
              ) : (
                <Box>
                  {deepLink && <Button sx={{ mb: 2 }} variant="outlined" href={deepLink}>Open Xaman</Button>}
                  {qr && <img src={`data:image/png;base64,${qr}`} alt="Xaman QR" style={{ width: 240 }} />}
                  <Typography variant="body2" sx={{ mt: 1 }}>Status: {status}</Typography>
                </Box>
              )}
            </Box>
          )}

          {tab === 'joey' && (
            <Box>
              {!uuid ? (
                <Button variant="contained" onClick={startJoey} disabled={loading}>Connect with Joey</Button>
              ) : (
                <Box>
                  {deepLink && <Button sx={{ mb: 2 }} variant="outlined" href={deepLink}>Open Joey</Button>}
                  {qr && <img src={`data:image/png;base64,${qr}`} alt="Joey QR" style={{ width: 240 }} />}
                  <Typography variant="body2" sx={{ mt: 1 }}>Status: {status}</Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      );
    }

    // EVM
    return (
      <Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="riddle" label="Riddle Wallet" />
          <Tab value="reown" label="Reown / WalletConnect v2" />
        </Tabs>

        {tab === 'riddle' && (
          <Box>
            <Typography variant="body2" color="text.secondary">Use your Riddle wallet session to trade on EVM.</Typography>
            <Button sx={{ mt: 2 }} variant="contained" onClick={() => { setEVM(undefined); onClose(); }}>Use Session Wallet</Button>
          </Box>
        )}

        {tab === 'reown' && (
          <Box>
            <Typography variant="body2" color="text.secondary">Connect an EVM wallet (MetaMask / EVM provider). WalletConnect v2 (Reown) can be added here.</Typography>
            <Button sx={{ mt: 2 }} variant="outlined" onClick={startReown} disabled={loading}>Connect EVM Wallet</Button>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Connect Wallet</DialogTitle>
      <DialogContent>
        {content()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
