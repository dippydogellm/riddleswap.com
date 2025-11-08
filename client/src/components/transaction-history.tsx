import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Transaction {
  hash: string;
  type: 'sent' | 'received';
  amount: string;
  currency: string;
  to?: string;
  from?: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  fee?: string;
  memo?: string;
  ledger_index?: number;
}

interface TransactionHistoryProps {
  address: string;
  chainType: 'xrp' | 'eth' | 'btc' | 'sol';
  explorerUrl: string;
}

export function TransactionHistory({ address, chainType, explorerUrl }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Fetch transaction history based on chain type
  const { data: txData, isLoading, refetch } = useQuery({
    queryKey: [`/api/wallet/transactions/${chainType}/${address}`],
    enabled: !!address,
    refetchInterval: 60000 // Refresh every minute
  });

  useEffect(() => {
    if (txData && typeof txData === 'object' && txData !== null && 'transactions' in txData && Array.isArray((txData as any).transactions)) {
      setTransactions((txData as any).transactions);
    }
  }, [txData]);

  const formatAmount = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return `0.000000 ${currency}`;
    
    // Handle zero amounts properly
    if (num === 0) {
      return `0.000000 ${currency}`;
    }
    
    // Always show 6 decimal places for precision
    return `${num.toFixed(6)} ${currency}`;
  };

  const formatTimestamp = (timestamp: number) => {
    // Handle both seconds and milliseconds timestamps
    const actualTimestamp = timestamp > 10000000000 ? timestamp : timestamp * 1000;
    const date = new Date(actualTimestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      // Show full date and time for older transactions
      return date.toLocaleString();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Card className="card-enhanced">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Transaction History
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-muted-foreground/20 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted-foreground/20 rounded w-1/2"></div>
                  </div>
                  <div className="h-4 bg-muted-foreground/20 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {transactions.map((tx) => (
              <div
                key={tx.hash}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  {tx.type === 'sent' ? (
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4 text-green-500" />
                  )}
                  {getStatusIcon(tx.status)}
                </div>
                
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {tx.type === 'sent' ? 'Sent' : 'Received'}
                    </span>
                    <Badge className={`text-xs self-start sm:self-auto ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground break-all sm:truncate">
                    {tx.type === 'sent' ? `To: ${tx.to?.slice(0, 8)}...${tx.to?.slice(-4)}` : 
                     `From: ${tx.from?.slice(0, 8)}...${tx.from?.slice(-4)}`}
                  </div>
                  {tx.memo && (
                    <div className="text-xs text-muted-foreground mt-1 break-all sm:truncate">
                      Memo: {tx.memo}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className={`font-medium text-sm ${
                      tx.type === 'sent' ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {tx.type === 'sent' ? '-' : '+'}{formatAmount(tx.amount, tx.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(tx.timestamp)}
                    </div>
                    {tx.fee && (
                      <div className="text-xs text-muted-foreground">
                        Fee: {formatAmount(tx.fee, tx.currency)}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const baseUrl = chainType === 'xrp' ? 'https://livenet.xrpl.org/transactions/' : explorerUrl;
                      const fullUrl = chainType === 'xrp' ? `${baseUrl}${tx.hash}` : `${explorerUrl}${tx.hash}`;
                      window.open(fullUrl, '_blank');
                    }}
                    title="View transaction on explorer"
                    className="flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <div className="space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-50" />
              <div className="font-medium">No Recent Transactions</div>
              <div className="text-xs">Transactions will appear here once you start using your wallet</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
