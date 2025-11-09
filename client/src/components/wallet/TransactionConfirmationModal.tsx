import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  Avatar,
  Divider,
  Button,
  IconButton,
  Alert,
  AlertTitle,
  Stack,
  Checkbox,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useState } from 'react';

interface TransactionConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  chain: {
    name: string;
    logo: string;
    color: string;
  };
  type: 'send' | 'receive' | 'swap' | 'burn' | 'trustline' | 'approve' | 'stake' | 'unstake' | 'other';
  details: {
    from?: string;
    to?: string;
    amount?: string;
    token?: string;
    estimatedFee?: string;
    warning?: string;
    [key: string]: any;
  };
  requiresDisclaimer?: boolean;
  disclaimerText?: string;
}

export default function TransactionConfirmationModal({
  open,
  onClose,
  onConfirm,
  chain,
  type,
  details,
  requiresDisclaimer = false,
  disclaimerText
}: TransactionConfirmationModalProps) {
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    if (requiresDisclaimer && !acceptedDisclaimer) {
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAcceptedDisclaimer(false);
      onClose();
    }
  };

  const getTypeLabel = () => {
    const labels: Record<string, string> = {
      send: 'Confirm Send',
      receive: 'Confirm Receive',
      swap: 'Confirm Swap',
      burn: 'Confirm Burn',
      trustline: 'Confirm Trustline',
      approve: 'Confirm Approval',
      stake: 'Confirm Stake',
      unstake: 'Confirm Unstake',
      other: 'Confirm Transaction'
    };
    return labels[type] || 'Confirm Transaction';
  };

  const getDefaultDisclaimer = () => {
    const disclaimers: Record<string, string> = {
      send: 'I understand that once confirmed, this transaction cannot be reversed. I have verified the recipient address.',
      burn: 'I understand that burning tokens permanently destroys them and this action cannot be undone.',
      trustline: 'I understand that modifying trustlines may affect my ability to hold certain tokens.',
      swap: 'I understand the risks of token swaps including price slippage and impermanent loss.',
      approve: 'I understand that I am granting permission for a smart contract to access my tokens.',
      other: 'I have reviewed the transaction details and accept the risks involved.'
    };
    return disclaimerText || disclaimers[type] || disclaimers.other;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              src={chain.logo}
              alt={chain.name}
              sx={{
                width: 32,
                height: 32,
                border: `2px solid ${chain.color}`
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              {getTypeLabel()}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={isProcessing}>
            <CloseIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Warning if present */}
        {details.warning && (
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{
              mb: 3,
              bgcolor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              '& .MuiAlert-icon': { color: '#f59e0b' }
            }}
          >
            <AlertTitle sx={{ fontWeight: 'bold' }}>Warning</AlertTitle>
            {details.warning}
          </Alert>
        )}

        {/* Transaction Details */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: 'rgba(255,255,255,0.05)',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)',
            mb: 3
          }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
            Transaction Details
          </Typography>

          <Stack spacing={1.5}>
            {/* Network */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Network
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                {chain.name}
              </Typography>
            </Box>

            {/* Amount */}
            {details.amount && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Amount
                </Typography>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {details.amount} {details.token || chain.name}
                </Typography>
              </Box>
            )}

            {/* From */}
            {details.from && (
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  From
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    wordBreak: 'break-all'
                  }}
                >
                  {details.from}
                </Typography>
              </Box>
            )}

            {/* To */}
            {details.to && (
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  To
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    wordBreak: 'break-all'
                  }}
                >
                  {details.to}
                </Typography>
              </Box>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

            {/* Estimated Fee */}
            {details.estimatedFee && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Estimated Fee
                </Typography>
                <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                  {details.estimatedFee}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Disclaimer */}
        {requiresDisclaimer && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'rgba(59, 130, 246, 0.05)',
              borderRadius: 2,
              border: '1px solid rgba(59, 130, 246, 0.2)',
              mb: 3
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <InfoIcon sx={{ fontSize: 20, color: '#3b82f6' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 'bold' }}>
                Please Read Carefully
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
              {getDefaultDisclaimer()}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={acceptedDisclaimer}
                  onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                  disabled={isProcessing}
                  sx={{
                    color: '#3b82f6',
                    '&.Mui-checked': { color: '#3b82f6' }
                  }}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  I understand and accept the risks
                </Typography>
              }
            />
          </Box>
        )}

        {/* Action Buttons */}
        <Stack spacing={2}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleConfirm}
            disabled={isProcessing || (requiresDisclaimer && !acceptedDisclaimer)}
            startIcon={isProcessing && <CircularProgress size={20} sx={{ color: 'white' }} />}
            sx={{
              bgcolor: chain.color,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 'bold',
              '&:hover': {
                bgcolor: chain.color,
                opacity: 0.9
              },
              '&:disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            {isProcessing ? 'Processing...' : 'Confirm Transaction'}
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleClose}
            disabled={isProcessing}
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            Cancel
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
