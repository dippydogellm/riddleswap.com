import React from 'react';
import { Card, CardContent, Grid, Paper, Typography, Divider, Stack, Chip } from '@mui/material';

export interface HeaderSummaryProps {
  totalWalletValue: number;
  xrpBalance: number;
  xrpPrice: number;
  availableBalance: number;
  reservedBalance: number;
  tokensCount: number;
  nftsCount: number;
  xrpValue: number;
  tokenValues: number;
  nftValue: number;
}

export const HeaderSummary: React.FC<HeaderSummaryProps> = ({
  totalWalletValue,
  xrpBalance,
  xrpPrice,
  availableBalance,
  reservedBalance,
  tokensCount,
  nftsCount,
  xrpValue,
  tokenValues,
  nftValue
}) => {
  return (
    <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <CardContent sx={{ p: 4 }}>
        <Grid container spacing={3}>
          {/* Main Balance Card */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Typography variant="caption" color="text.secondary" className="mb-1">
                    Total Value
                  </Typography>
                  <Typography variant="h4" className="font-bold">
                    ${totalWalletValue.toFixed(2)}
                  </Typography>
                </div>
                <div className="text-right">
                  <Typography variant="h6" sx={{ fontWeight: 'semibold' }}>
                    {xrpBalance.toFixed(6)} XRP
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    @ ${xrpPrice.toFixed(2)}
                  </Typography>
                </div>
              </div>
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <div className="text-center">
                    <Typography variant="caption" color="text.secondary">
                      Available
                    </Typography>
                    <Typography variant="caption" className="font-semibold">
                      {availableBalance.toFixed(3)}
                    </Typography>
                  </div>
                </Grid>
                <Grid item xs={4}>
                  <div className="text-center">
                    <Typography variant="caption" color="text.secondary">
                      Reserved
                    </Typography>
                    <Typography variant="caption" className="font-semibold">
                      {reservedBalance.toFixed(3)}
                    </Typography>
                  </div>
                </Grid>
                <Grid item xs={4}>
                  <div className="text-center">
                    <Typography variant="caption" color="text.secondary">
                      Tokens
                    </Typography>
                    <Typography variant="caption" className="font-semibold">
                      {tokensCount}
                    </Typography>
                  </div>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Asset Values */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                Asset Breakdown
              </Typography>
              <Stack spacing={1.5}>
                <div className="flex justify-between items-center">
                  <Typography variant="body2">XRP</Typography>
                  <Typography variant="body2" className="font-semibold">
                    ${xrpValue.toFixed(2)}
                  </Typography>
                </div>
                <div className="flex justify-between items-center">
                  <Typography variant="body2">Tokens</Typography>
                  <Typography variant="body2" className="font-semibold">
                    ${tokenValues.toFixed(2)}
                  </Typography>
                </div>
                <div className="flex justify-between items-center">
                  <Typography variant="body2">NFTs ({nftsCount})</Typography>
                  <Typography variant="body2" className="font-semibold">
                    ${nftValue.toFixed(2)}
                  </Typography>
                </div>
                <Divider sx={{ my: 1 }} />
                <div className="flex justify-between items-center">
                  <Typography variant="body2" className="font-semibold">Total</Typography>
                  <Typography variant="body2" className="font-bold">
                    ${totalWalletValue.toFixed(2)}
                  </Typography>
                </div>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
