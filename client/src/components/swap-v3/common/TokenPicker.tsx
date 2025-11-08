import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, List, ListItem, ListItemAvatar, ListItemText, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TokenSearchResult, searchTokens } from '@/lib/token-api';

export type XRPLToken = {
  symbol: string;
  issuer?: string;
  name?: string;
  icon_url?: string;
};

export function TokenChip({ token, onClick, placeholder }: { token?: XRPLToken; onClick: () => void; placeholder?: string; }) {
  return (
    <Button variant="outlined" onClick={onClick} sx={{ justifyContent: 'flex-start', gap: 1 }}>
      {token ? (
        <>
          <Avatar src={token.icon_url} sx={{ width: 20, height: 20 }}>{token.symbol?.[0]}</Avatar>
          <Typography variant="body2">{token.symbol}</Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">{placeholder || 'Select token'}</Typography>
      )}
    </Button>
  );
}

export default function TokenPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (t: XRPLToken) => void; }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TokenSearchResult[]>([]);

  const defaultTokens: XRPLToken[] = useMemo(() => ([{ symbol: 'XRP', name: 'XRP', issuer: '', icon_url: '/images/chains/xrp-logo.png' }]), []);

  useEffect(() => {
    if (!open) return;
    setResults([]);
    setQ('');
  }, [open]);

  useEffect(() => {
    const run = async () => {
      if (!open) return;
      if (!q || q.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await searchTokens(q.trim());
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(() => { void run(); }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const renderList = () => {
    const list = (q.trim().length < 2 ? [] : results);
    const showXrp = (q.trim().length < 2) || 'xrp'.includes(q.trim().toLowerCase());
    return (
      <List>
        {showXrp && defaultTokens.map((t, idx) => (
          <ListItem key={`xrp-${idx}`} button onClick={() => { onSelect(t); onClose(); }}>
            <ListItemAvatar><Avatar src={t.icon_url}>X</Avatar></ListItemAvatar>
            <ListItemText primary={t.symbol} secondary={t.name} />
          </ListItem>
        ))}
        {list.map((t, idx) => (
          <ListItem key={`${t.symbol}-${t.issuer || 'native'}-${idx}`} button onClick={() => {
            onSelect({ symbol: t.symbol, issuer: t.issuer, name: t.name, icon_url: t.icon_url || t.logo_url || t.logoURI });
            onClose();
          }}>
            <ListItemAvatar><Avatar src={t.icon_url || t.logo_url || t.logoURI}>{t.symbol?.[0]}</Avatar></ListItemAvatar>
            <ListItemText primary={`${t.symbol}${t.issuer ? ` · ${t.issuer.slice(0,6)}…${t.issuer.slice(-4)}` : ''}`} secondary={t.name} />
          </ListItem>
        ))}
        {!loading && list.length === 0 && !showXrp && (
          <Box py={2}><Typography variant="body2" color="text.secondary" align="center">No tokens found</Typography></Box>
        )}
      </List>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Select Token
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search tokens (e.g., ARMY, RDL, BTC)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{ endAdornment: <InputAdornment position="end">{loading ? '…' : ''}</InputAdornment> }}
        />
        <Box mt={1}>{renderList()}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
