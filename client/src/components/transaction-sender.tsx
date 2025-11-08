import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Send, DollarSign, Zap, AlertTriangle } from "lucide-react";

interface TransactionSenderProps {
  walletType: 'ethereum' | 'xrp' | 'solana' | 'bitcoin';
  walletAddress: string;
  balance: string;
  symbol: string;
  onTransactionComplete?: (txHash: string) => void;
}

export function TransactionSender({ 
  walletType, 
  walletAddress, 
  balance, 
  symbol,
  onTransactionComplete 
}: TransactionSenderProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Chain-specific fields
  const [gasPrice, setGasPrice] = useState("20"); // For Ethereum
  const [gasLimit, setGasLimit] = useState("21000"); // For Ethereum
  const [destinationTag, setDestinationTag] = useState(""); // For XRP
  const [priorityFee, setPriorityFee] = useState("0.000005"); // For Solana
  const [feeRate, setFeeRate] = useState("10"); // For Bitcoin (sat/vB)

  const getPlaceholderAddress = () => {
    switch (walletType) {
      case 'ethereum': return '0x...';
      case 'xrp': return 'r...';
      case 'solana': return '1... (Base58)';
      case 'bitcoin': return '1... or 3... or bc1...';
      default: return '';
    }
  };

  const validateAddress = (address: string): boolean => {
    switch (walletType) {
      case 'ethereum':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'xrp':
        return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
      case 'solana':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case 'bitcoin':
        return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
      default:
        return false;
    }
  };

  const estimateFee = (): string => {
    switch (walletType) {
      case 'ethereum':
        const gasInGwei = parseFloat(gasPrice);
        const gasLimitNum = parseInt(gasLimit);
        const totalGasEth = (gasInGwei * gasLimitNum) / 1e9;
        return totalGasEth.toFixed(6);
      case 'xrp':
        return "0.00001"; // Standard XRP transaction fee
      case 'solana':
        return priorityFee;
      case 'bitcoin':
        const feeRateNum = parseFloat(feeRate);
        const estimatedSize = 250; // Average transaction size in bytes
        const feeSats = feeRateNum * estimatedSize;
        return (feeSats / 1e8).toFixed(8);
      default:
        return "0";
    }
  };

  const handleSendTransaction = async () => {
    // Validation
    if (!recipient || !amount) {
      toast({
        title: "Error",
        description: "Please fill in recipient and amount",
        variant: "destructive",
      });
      return;
    }

    if (!validateAddress(recipient)) {
      toast({
        title: "Invalid Address",
        description: `Please enter a valid ${walletType.toUpperCase()} address`,
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(balance);
    const feeNum = parseFloat(estimateFee());

    if (amountNum + feeNum > balanceNum) {
      toast({
        title: "Insufficient Balance",
        description: "Amount plus fees exceeds available balance",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate transaction sending based on wallet type
      const transactionData = {
        walletType,
        from: walletAddress,
        to: recipient,
        amount: amountNum,
        symbol,
        memo,
        ...(walletType === 'ethereum' && { gasPrice, gasLimit }),
        ...(walletType === 'xrp' && { destinationTag }),
        ...(walletType === 'solana' && { priorityFee }),
        ...(walletType === 'bitcoin' && { feeRate })
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate mock transaction hash
      const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

      toast({
        title: "Transaction Sent!",
        description: `Successfully sent ${amount} ${symbol}`,
      });

      // Reset form
      setRecipient("");
      setAmount("");
      setMemo("");
      setDestinationTag("");

      onTransactionComplete?.(txHash);

    } catch (error) {

      toast({
        title: "Transaction Failed",
        description: "Failed to send transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderChainSpecificInputs = () => {
    switch (walletType) {
      case 'ethereum':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gasPrice">Gas Price (Gwei)</Label>
              <Input
                id="gasPrice"
                type="number"
                value={gasPrice}
                onChange={(e) => setGasPrice(e.target.value)}
                placeholder="20"
              />
            </div>
            <div>
              <Label htmlFor="gasLimit">Gas Limit</Label>
              <Input
                id="gasLimit"
                type="number"
                value={gasLimit}
                onChange={(e) => setGasLimit(e.target.value)}
                placeholder="21000"
              />
            </div>
          </div>
        );

      case 'xrp':
        return (
          <div>
            <Label htmlFor="destinationTag">Destination Tag (Optional)</Label>
            <Input
              id="destinationTag"
              type="number"
              value={destinationTag}
              onChange={(e) => setDestinationTag(e.target.value)}
              placeholder="Enter destination tag if required"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required by some exchanges. Leave empty if not needed.
            </p>
          </div>
        );

      case 'solana':
        return (
          <div>
            <Label htmlFor="priorityFee">Priority Fee (SOL)</Label>
            <Input
              id="priorityFee"
              type="number"
              step="0.000001"
              value={priorityFee}
              onChange={(e) => setPriorityFee(e.target.value)}
              placeholder="0.000005"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Higher priority fee = faster transaction confirmation
            </p>
          </div>
        );

      case 'bitcoin':
        return (
          <div>
            <Label htmlFor="feeRate">Fee Rate (sat/vB)</Label>
            <Input
              id="feeRate"
              type="number"
              value={feeRate}
              onChange={(e) => setFeeRate(e.target.value)}
              placeholder="10"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Higher fee rate = faster confirmation (1-5 sat/vB = slow, 10-20 = normal, 50+ = fast)
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="card-enhanced">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send {symbol}
          <Badge variant="secondary">{walletType.toUpperCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipient Address */}
        <div>
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder={getPlaceholderAddress()}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={!validateAddress(recipient) && recipient ? "border-destructive" : ""}
          />
          {recipient && !validateAddress(recipient) && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Invalid {walletType.toUpperCase()} address format
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <Label htmlFor="amount">Amount ({symbol})</Label>
          <Input
            id="amount"
            type="number"
            step="0.0001"
            placeholder="0.0000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Available: {balance} {symbol}</span>
            <Button
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => {
                const maxAmount = parseFloat(balance) - parseFloat(estimateFee());
                setAmount(Math.max(0, maxAmount).toFixed(6));
              }}
            >
              Use Max
            </Button>
          </div>
        </div>

        {/* Chain-specific inputs */}
        {renderChainSpecificInputs()}

        {/* Memo/Note (optional for most chains) */}
        {(walletType === 'xrp' || walletType === 'solana') && (
          <div>
            <Label htmlFor="memo">Memo (Optional)</Label>
            <Input
              id="memo"
              placeholder="Enter transaction memo..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
        )}

        {/* Transaction Summary */}
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>Amount:</span>
            <span>{amount || '0'} {symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Network Fee:</span>
            <span>~{estimateFee()} {symbol}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span>Total:</span>
            <span>
              {amount ? (parseFloat(amount) + parseFloat(estimateFee())).toFixed(6) : '0.000000'} {symbol}
            </span>
          </div>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSendTransaction}
          disabled={isLoading || !recipient || !amount || !validateAddress(recipient)}
          className="w-full"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending Transaction...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send {symbol}
            </div>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
