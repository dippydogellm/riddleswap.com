import React from 'react';
import { Paper, Grid, Checkbox, Avatar, Typography, Chip, Stack, IconButton, CircularProgress, Tooltip } from '@mui/material';
import { OpenInNew as ExternalLink, Delete as Trash2 } from '@mui/icons-material';
import { DollarSign, Eye } from 'lucide-react';

export interface TokenItem {
  currency: string;
  issuer?: string;
  balance: number | string;
  symbol?: string;
  name?: string;
  icon_url?: string;
  price_usd?: number;
}

export interface TokensListProps {
  tokens: TokenItem[];
  selected: Set<string>;
  failedImages: Set<string>;
  onToggle: (tokenKey: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onBulkRemove: () => void;
  bulkRemoveLoading?: boolean;
  onViewToken: (t: TokenItem) => void;
  onViewTokenOnExplorer: (t: TokenItem) => void;
  onRemoveTrustLine: (t: TokenItem) => void;
  onSellAndRemove: (t: TokenItem) => void;
  canRemoveFn?: (t: TokenItem) => { canRemove: boolean };
}

const keyOf = (t: TokenItem) => `${t.currency}:${t.issuer || ''}`;

const decodeCurrency = (code?: string) => {
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
};

export const TokensList: React.FC<TokensListProps> = ({
  tokens,
  selected,
  failedImages,
  onToggle,
  onSelectAll,
  onBulkRemove,
  bulkRemoveLoading,
  onViewToken,
  onViewTokenOnExplorer,
  onRemoveTrustLine,
  onSellAndRemove,
  canRemoveFn = () => ({ canRemove: true }),
}) => {
  if (!tokens || tokens.length === 0) {
    return (
      <div className="text-center py-6">
        <Typography variant="body1" color="text.secondary">No tokens found</Typography>
      </div>
    );
  }

  return (
    <Stack spacing={2}>
      {tokens.map((token, index) => {
        const tokenKey = keyOf(token);
        const isSelected = selected.has(tokenKey);
        const { canRemove } = canRemoveFn(token);
        const imageFailedKey = `${token.currency}-${token.issuer || ''}`;
        const hasImageFailed = failedImages.has(imageFailedKey);
        const balanceNum = typeof token.balance === 'string' ? parseFloat(token.balance) : token.balance || 0;
  const valueUsd = token.price_usd && token.price_usd > 0 ? balanceNum * token.price_usd : null;
  const symbolDisplay = decodeCurrency(token.symbol || token.currency);

        return (
          <Paper
            key={index}
            elevation={isSelected ? 3 : 1}
            sx={{
              p: 2,
              bgcolor: isSelected ? 'action.selected' : !canRemove ? 'action.hover' : 'background.paper',
              border: 1,
              borderColor: isSelected ? 'primary.main' : 'divider',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Checkbox
                    checked={isSelected}
                    disabled={!canRemove}
                    onChange={(e) => onToggle(tokenKey, e.target.checked)}
                  />
                  <Avatar
                    src={token.icon_url && !hasImageFailed ? token.icon_url : undefined}
                    sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}
                    onError={() => failedImages.add(imageFailedKey)}
                  >
                    {(token.symbol || token.currency || '?').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {symbolDisplay}
                      </Typography>
                      {!canRemove && <Chip label="Has Balance" size="small" color="warning" variant="outlined" />}
                      {canRemove && <Chip label="Removable" size="small" color="success" variant="outlined" />}
                    </div>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {token.name || (token.issuer ? `${token.issuer.slice(0, 8)}...` : '')}
                    </Typography>
                  </div>
                </div>
              </Grid>

              <Grid item xs={6} sm={3}>
                <div className="text-right">
                  <Typography variant="body1" fontWeight={600}>
                    {balanceNum.toFixed(6)}
                  </Typography>
                  {valueUsd !== null ? (
                    <Typography variant="caption" color="text.secondary">
                      ${valueUsd.toFixed(4)}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      Fetching price...
                    </Typography>
                  )}
                </div>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                  <Tooltip title="View Token Details">
                    <IconButton size="small" onClick={() => onViewToken(token)}>
                      <Eye size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View on Explorer">
                    <IconButton size="small" color="info" onClick={() => onViewTokenOnExplorer(token)}>
                      <ExternalLink fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canRemove ? (
                    <Tooltip title="Remove Trust Line">
                      <IconButton size="small" color="error" onClick={() => onRemoveTrustLine(token)}>
                        <Trash2 fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Sell & Remove">
                      <IconButton size="small" color="warning" onClick={() => onSellAndRemove(token)}>
                        <DollarSign size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        );
      })}
    </Stack>
  );
};
