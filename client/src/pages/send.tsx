import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Container,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Stack,
  CircularProgress,
} from "@mui/material";
import { ArrowLeft, Send as SendIcon, Wallet as WalletIcon, Tag, FileText } from "lucide-react";

export default function SendPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [selectedChain, setSelectedChain] = useState("xrp");
  const [selectedToken, setSelectedToken] = useState("XRP");
  const [loading, setLoading] = useState(false);
  const [checkingTrustline, setCheckingTrustline] = useState(false);
  const [recipientTrustlineStatus, setRecipientTrustlineStatus] = useState<{
    hasTrustline: boolean;
    currency: string;
    issuer: string;
  } | null>(null);
  const [checkingActivation, setCheckingActivation] = useState(false);
  const [recipientActivated, setRecipientActivated] = useState<boolean | null>(null);

  // Check if recipient address has trustline for selected token
  const checkTrustlineStatus = async (recipientAddress: string, currency: string, issuer: string) => {
    if (!recipientAddress || !currency) return;

    setCheckingTrustline(true);
    try {
      const resp = await fetch(`/api/xrpl/trustlines/${recipientAddress}?currency=${currency}&issuer=${issuer}`);
      if (resp.ok) {
        const data = await resp.json();
        setRecipientTrustlineStatus({
          hasTrustline: data.hasTrustline || false,
          currency,
          issuer
        });
      } else {
        setRecipientTrustlineStatus(null);
      }
    } catch (error) {
      console.error('Error checking trustline:', error);
      setRecipientTrustlineStatus(null);
    } finally {
      setCheckingTrustline(false);
    }
  };

  // Check if recipient wallet is activated on XRP Ledger
  const checkWalletActivation = async (address: string) => {
    if (!address) return;

    setCheckingActivation(true);
    try {
      const resp = await fetch(`/api/xrpl/account-info/${address}`);
      if (resp.ok) {
        const data = await resp.json();
        setRecipientActivated(data.activated || false);
      } else {
        setRecipientActivated(null);
      }
    } catch (error) {
      console.error('Error checking wallet activation:', error);
      setRecipientActivated(null);
    } finally {
      setCheckingActivation(false);
    }
  };

  // Check trustline and activation when recipient or token changes
  useEffect(() => {
    if (recipientAddress && selectedChain === 'xrp' && selectedToken !== 'XRP') {
      // For XRP tokens, check trustline (assuming issuer is needed, using a placeholder for now)
      // In a real implementation, you'd need to get the issuer from the token selection
      const issuer = selectedToken === 'XRP' ? '' : 'placeholder_issuer'; // Replace with actual issuer logic
      checkTrustlineStatus(recipientAddress, selectedToken, issuer);
    } else {
      setRecipientTrustlineStatus(null);
    }

    if (recipientAddress && selectedChain === 'xrp') {
      checkWalletActivation(recipientAddress);
    } else {
      setRecipientActivated(null);
    }
  }, [recipientAddress, selectedToken, selectedChain]);

  // Bank wallet for testing
  const BANK_WALLET = "rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3";

  const handleTestBankSend = () => {
    setRecipientAddress(BANK_WALLET);
    setAmount("0.01");
    setMemo("Test payment to bank wallet");
    setSelectedChain("xrp");
    setSelectedToken("XRP");
    setDestinationTag("");
  };

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      window.alert("Please fill in recipient address and amount");
      return;
    }

    setLoading(true);
    try {
      const paymentData: any = {
        toAddress: recipientAddress,
        amount: amount,
        chain: selectedChain,
        memo: memo || undefined
      };

      // Add destination tag for XRP if provided
      if (selectedChain === 'xrp' && destinationTag && destinationTag.trim()) {
        const tag = parseInt(destinationTag.trim());
        if (!isNaN(tag) && tag >= 0 && tag <= 4294967295) {
          paymentData.destinationTag = tag;
        } else {
          window.alert("Invalid destination tag. Must be a number between 0 and 4294967295");
          setLoading(false);
          return;
        }
      }

      // Update selected token when chain changes
      if (selectedChain === 'xrp' && selectedToken !== 'XRP') {
        setSelectedToken('XRP');
      } else if (selectedChain === 'sol' && selectedToken !== 'SOL') {
        setSelectedToken('SOL');
      } else if (selectedChain === 'btc' && selectedToken !== 'BTC') {
        setSelectedToken('BTC');
      }

      console.log('Sending payment:', paymentData);
      
      const response = await apiRequest('/api/payment/send', {
        method: 'POST',
        body: JSON.stringify(paymentData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json() as any;

      if (result.success) {
        window.alert(result.message || `Transaction sent! Hash: ${result.hash}`);
        
        // Clear form
        setRecipientAddress("");
        setAmount("");
        setMemo("");
        setDestinationTag("");
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      window.alert(error instanceof Error ? error.message : "Failed to send transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Button variant="outlined" onClick={() => setLocation('/xrp-wallet')} startIcon={<ArrowLeft size={16} />}
          sx={{ alignSelf: 'flex-start' }}>
          Back to Wallet
        </Button>

        <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          <CardHeader>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}><SendIcon size={18} /> Send Transaction</Typography>
          </CardHeader>
          <CardContent>
            <Stack spacing={2}>
              <TextField label="Recipient Address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} fullWidth />

              {/* Wallet Activation Warning */}
              {recipientActivated === false && selectedChain === 'xrp' && (
                <Card sx={{ bgcolor: 'warning.light', border: 1, borderColor: 'warning.main' }}>
                  <CardContent sx={{ py: 1 }}>
                    <Typography variant="body2" color="warning.contrastText" display="flex" alignItems="center" gap={1}>
                      <WalletIcon size={16} />
                      Warning: Recipient wallet is not activated on XRP Ledger. They need at least 1 XRP to activate their wallet before receiving tokens.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Trustline Warning */}
              {recipientTrustlineStatus && !recipientTrustlineStatus.hasTrustline && selectedChain === 'xrp' && selectedToken !== 'XRP' && (
                <Card sx={{ bgcolor: 'error.light', border: 1, borderColor: 'error.main' }}>
                  <CardContent sx={{ py: 1 }}>
                    <Typography variant="body2" color="error.contrastText" display="flex" alignItems="center" gap={1}>
                      <Tag size={16} />
                      Warning: Recipient does not have a trustline for {recipientTrustlineStatus.currency}.
                      The transaction may fail. Ask them to set up a trustline first.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Checking Status */}
              {(checkingTrustline || checkingActivation) && (
                <Card sx={{ bgcolor: 'info.light', border: 1, borderColor: 'info.main' }}>
                  <CardContent sx={{ py: 1 }}>
                    <Typography variant="body2" color="info.contrastText" display="flex" alignItems="center" gap={1}>
                      <CircularProgress size={14} sx={{ mr: 1 }} />
                      Checking recipient wallet status...
                    </Typography>
                  </CardContent>
                </Card>
              )}

              <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} fullWidth />

              <FormControl fullWidth>
                <InputLabel id="chain-label">Blockchain</InputLabel>
                <Select labelId="chain-label" label="Blockchain" value={selectedChain} onChange={(e) => setSelectedChain(e.target.value)}>
                  <MenuItem value="xrp">XRP Ledger</MenuItem>
                  <MenuItem value="sol">Solana</MenuItem>
                  <MenuItem value="btc">Bitcoin</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="asset-label">Asset</InputLabel>
                <Select labelId="asset-label" label="Asset" value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}>
                  {selectedChain === 'xrp' && <MenuItem value="XRP">XRP</MenuItem>}
                  {selectedChain === 'sol' && <MenuItem value="SOL">SOL</MenuItem>}
                  {selectedChain === 'btc' && <MenuItem value="BTC">BTC</MenuItem>}
                </Select>
              </FormControl>

              {selectedChain === 'xrp' && (
                <Stack spacing={0.5}>
                  <TextField label="Destination Tag (optional)" value={destinationTag} onChange={(e) => setDestinationTag(e.target.value)} fullWidth />
                  <Typography variant="caption" color="text.secondary">Required for some exchanges like Binance, Coinbase</Typography>
                </Stack>
              )}

              <TextField label="Memo (optional)" value={memo} onChange={(e) => setMemo(e.target.value)} fullWidth />

              <Button onClick={handleTestBankSend} variant="outlined" startIcon={<WalletIcon size={16} />}>
                Test with Bank Wallet (0.01 {selectedToken})
              </Button>

              <Button
                onClick={handleSend}
                disabled={
                  loading ||
                  !recipientAddress ||
                  !amount ||
                  (selectedChain === 'xrp' && selectedToken !== 'XRP' && recipientTrustlineStatus && !recipientTrustlineStatus.hasTrustline) ||
                  (selectedChain === 'xrp' && recipientActivated === false)
                }
                variant="contained"
              >
                {loading ? <><CircularProgress size={16} sx={{ mr: 1 }} /> Sending…</> : `Send ${selectedToken}`}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
