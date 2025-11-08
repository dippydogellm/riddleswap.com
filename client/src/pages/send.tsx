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

              <Button onClick={handleSend} disabled={loading || !recipientAddress || !amount} variant="contained">
                {loading ? <><CircularProgress size={16} sx={{ mr: 1 }} /> Sending…</> : `Send ${selectedToken}`}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
