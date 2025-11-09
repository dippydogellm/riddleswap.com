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
  Chip,
  Stack,
  Link
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Close as CloseIcon,
  OpenInNew as ExternalLinkIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { useState } from 'react';

interface TransactionSuccessModalProps {
  open: boolean;
  onClose: () => void;
  txHash: string;
  explorerUrl?: string;
  chain: {
    name: string;
    logo: string;
    color: string;
    explorerUrl: string;
    explorerTxPath: string;
  };
  type: 'send' | 'receive' | 'swap' | 'burn' | 'trustline' | 'approve' | 'stake' | 'unstake' | 'other';
  details: {
    from?: string;
    to?: string;
    amount?: string;
    token?: string;
    fee?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

export default function TransactionSuccessModal({
  open,
  onClose,
  txHash,
  explorerUrl,
  chain,
  type,
  details
}: TransactionSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const copyTxHash = async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getTypeLabel = () => {
    const labels: Record<string, string> = {
      send: 'Sent Successfully',
      receive: 'Received Successfully',
      swap: 'Swap Complete',
      burn: 'Tokens Burned',
      trustline: 'Trustline Updated',
      approve: 'Approval Confirmed',
      stake: 'Staked Successfully',
      unstake: 'Unstaked Successfully',
      other: 'Transaction Complete'
    };
    return labels[type] || 'Transaction Complete';
  };

  const getTypeColor = () => {
    const colors: Record<string, string> = {
      send: '#3b82f6',
      receive: '#10b981',
      swap: '#8b5cf6',
      burn: '#f59e0b',
      trustline: '#06b6d4',
      approve: '#6366f1',
      stake: '#14b8a6',
      unstake: '#f43f5e',
      other: '#6b7280'
    };
    return colors[type] || '#6b7280';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          <IconButton onClick={onClose} size="small">
            <CloseIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Success Icon */}
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <SuccessIcon
            sx={{
              fontSize: 80,
              color: getTypeColor(),
              filter: `drop-shadow(0 0 20px ${getTypeColor()}80)`
            }}
          />
          <Typography variant="h6" sx={{ color: 'white', mt: 2, fontWeight: 'bold' }}>
            Transaction Confirmed
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
            Your transaction has been successfully processed on {chain.name}
          </Typography>
        </Box>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Transaction Details */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          {/* Transaction Hash */}
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
              Transaction Hash
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  color: 'white',
                  wordBreak: 'break-all',
                  flex: 1,
                  fontSize: '0.85rem'
                }}
              >
                {txHash}
              </Typography>
              <IconButton size="small" onClick={copyTxHash}>
                <CopyIcon sx={{ fontSize: 18, color: copied ? '#10b981' : 'rgba(255,255,255,0.7)' }} />
              </IconButton>
            </Box>
          </Box>

          {/* Amount */}
          {details.amount && (
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Amount
              </Typography>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                {details.amount} {details.token || chain.name}
              </Typography>
            </Box>
          )}

          {/* From Address */}
          {details.from && (
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                From
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.8)',
                  wordBreak: 'break-all'
                }}
              >
                {details.from}
              </Typography>
            </Box>
          )}

          {/* To Address */}
          {details.to && (
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                To
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.8)',
                  wordBreak: 'break-all'
                }}
              >
                {details.to}
              </Typography>
            </Box>
          )}

          {/* Transaction Fee */}
          {details.fee && (
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Network Fee
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {details.fee}
              </Typography>
            </Box>
          )}

          {/* Timestamp */}
          {details.timestamp && (
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Time
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {details.timestamp}
              </Typography>
            </Box>
          )}

          {/* Status Chip */}
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Chip
              label="Confirmed"
              color="success"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        </Stack>

        {/* Action Buttons */}
        <Stack spacing={2}>
          {explorerUrl && (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ExternalLinkIcon />}
              component={Link}
              href={explorerUrl}
              target="_blank"
              sx={{
                borderColor: chain.color,
                color: chain.color,
                '&:hover': {
                  borderColor: chain.color,
                  bgcolor: `${chain.color}20`
                }
              }}
            >
              View on Explorer
            </Button>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={onClose}
            sx={{
              bgcolor: getTypeColor(),
              '&:hover': {
                bgcolor: getTypeColor(),
                opacity: 0.9
              }
            }}
          >
            Done
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
