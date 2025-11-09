import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { X, Copy, Download, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface WalletQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  title?: string;
  description?: string;
  network?: string;
}

export const WalletQRModal: React.FC<WalletQRModalProps> = ({
  isOpen,
  onClose,
  address,
  title = "Receive Payment",
  description = "Scan this QR code to send payments to your wallet",
  network = "Blockchain"
}) => {
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setShowSuccess(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const downloadQR = () => {
    // Get the QR code SVG element
    const svg = document.querySelector('#wallet-qr-code') as SVGElement;
    if (!svg) return;

    // Convert SVG to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Download canvas as PNG
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${network}-wallet-qr.png`;
      link.href = url;
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <>
      <Dialog 
        open={isOpen} 
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(249,250,251,1) 100%)',
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: 'primary.main',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                <Typography variant="h6" color="white" fontWeight="bold">
                  RDL
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold">
                {title}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <X size={20} />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box textAlign="center">
            <Typography variant="body2" color="text.secondary" mb={3}>
              {description}
            </Typography>
            
            {/* QR Code Display */}
            <Paper 
              elevation={3}
              sx={{ 
                p: 3, 
                display: 'inline-block',
                borderRadius: 2,
                background: 'white'
              }}
            >
              <QRCodeSVG
                id="wallet-qr-code"
                value={address}
                size={256}
                level="H"
                includeMargin={true}
                style={{ display: 'block' }}
              />
            </Paper>
            
            {/* Address Display */}
            <Paper 
              elevation={1}
              sx={{ 
                mt: 3,
                p: 2,
                borderRadius: 2,
                background: 'rgba(59, 130, 246, 0.05)'
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  mb: 2,
                  color: 'text.primary'
                }}
              >
                {address}
              </Typography>
              
              <Box display="flex" gap={1} justifyContent="center">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  onClick={copyAddress}
                  color={copied ? "success" : "primary"}
                >
                  {copied ? 'Copied!' : 'Copy Address'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download size={16} />}
                  onClick={downloadQR}
                >
                  Download QR
                </Button>
              </Box>
            </Paper>
            
            {/* Network Badge */}
            <Box mt={2}>
              <Chip 
                label={`${network} Network`}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose} variant="contained" fullWidth>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSuccess(false)} 
          severity="success"
          sx={{ width: '100%' }}
        >
          Address copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
};
