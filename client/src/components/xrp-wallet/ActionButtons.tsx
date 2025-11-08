import React from 'react';
import { Grid, Button } from '@mui/material';
import { Send, QrCode } from '@mui/icons-material';
import { SwapHoriz as ArrowUpDown } from '@mui/icons-material';

export interface ActionButtonsProps {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ onSend, onReceive, onSwap }) => {
  return (
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={12} sm={4}>
        <Button fullWidth variant="contained" color="primary" onClick={onSend} startIcon={<Send />} sx={{ py: 1.5 }}>
          Send
        </Button>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Button fullWidth variant="outlined" onClick={onReceive} startIcon={<QrCode />} sx={{ py: 1.5 }}>
          Receive
        </Button>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Button fullWidth variant="outlined" onClick={onSwap} startIcon={<ArrowUpDown />} sx={{ py: 1.5 }}>
          Swap
        </Button>
      </Grid>
    </Grid>
  );
};
