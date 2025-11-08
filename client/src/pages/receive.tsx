import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, QrCode, Copy } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from "@/hooks/useAuth";
import {
  Container,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from "@mui/material";
import { WalletQRModal } from "@/components/wallet-qr-modal";

export default function ReceivePage() {
  const [, setLocation] = useLocation();
  const { authData } = useAuth();
  const [walletAddress, setWalletAddress] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedChain, setSelectedChain] = useState("xrp");

  const getWalletAddress = (chain: string) => {
    if (!authData?.walletData) return "";
    
    switch (chain) {
      case "xrp":
        return authData.walletData.xrpAddress;
      case "btc":  
        return authData.walletData.btcAddress;
      case "sol":
        return authData.walletData.solAddress;
      case "eth":
        return authData.walletData.ethAddress;
      default:
        return "";
    }
  };

  const getChainName = (chain: string) => {
    switch (chain) {
      case "xrp": return "XRP";
      case "btc": return "Bitcoin";
      case "sol": return "Solana";
      case "eth": return "Ethereum";
      default: return "Crypto";
    }
  };

  useEffect(() => {
    const address = getWalletAddress(selectedChain);
    setWalletAddress(address);
  }, [selectedChain, authData]);

  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      // Use simple alert for now to avoid mixing UI systems
      window.alert('Wallet address copied to clipboard');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Button variant="outlined" onClick={() => setLocation('/xrp-wallet')} startIcon={<ArrowLeft size={16} />} sx={{ alignSelf: 'flex-start' }}>
          Back to Wallet
        </Button>

        <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <CardHeader
            title={
              <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                <QrCode size={18} /> Receive {getChainName(selectedChain)}
              </Typography>
            }
          />
          <CardContent>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="chain-label">Select Blockchain</InputLabel>
                <Select labelId="chain-label" label="Select Blockchain" value={selectedChain} onChange={(e) => setSelectedChain(e.target.value as string)}>
                  <MenuItem value="xrp">XRP Ledger</MenuItem>
                  <MenuItem value="btc">Bitcoin</MenuItem>
                  <MenuItem value="sol">Solana</MenuItem>
                  <MenuItem value="eth">Ethereum</MenuItem>
                </Select>
              </FormControl>

              {walletAddress ? (
                <Stack spacing={2} alignItems="center">
                  <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
                    <QRCodeSVG value={walletAddress} size={200} level="M" includeMargin />
                  </div>
                  <div style={{ width: '100%', background: 'transparent', border: '1px solid', borderColor: 'rgba(0,0,0,0.12)', padding: 12, borderRadius: 8 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Your {getChainName(selectedChain)} Address:</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mb: 1.5 }}>{walletAddress}</Typography>
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button variant="outlined" size="small" onClick={copyAddress} startIcon={<Copy size={14} />}>Copy</Button>
                      <Button variant="outlined" size="small" onClick={() => setShowQRModal(true)} startIcon={<QrCode size={14} />}>Large QR</Button>
                    </Stack>
                  </div>
                  <Typography variant="body2" color="text.secondary">Share this address or QR code to receive {getChainName(selectedChain)} payments</Typography>
                </Stack>
              ) : (
                <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                  <Typography>No wallet address found</Typography>
                  <Button onClick={() => setLocation('/xrp-wallet')}>Go to Wallet</Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <WalletQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        address={walletAddress}
        title={`Receive ${getChainName(selectedChain)}`}
        description={`Scan this QR code to send ${getChainName(selectedChain)} to your wallet`}
        network={getChainName(selectedChain)}
      />
    </Container>
  );
}
