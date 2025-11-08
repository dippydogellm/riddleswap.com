// Transactions History Page - Separate page for bridge transactions
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Download, 
  RefreshCw, 
  ArrowRight, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  Wallet,
  ExternalLink,
  Copy
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface BridgeTransaction {
  // Riddle-bridge transaction ID
  transactionId: string;
  
  // Sent amount - chain token
  sentAmount: string;
  sentChain: string;
  sentToken: string;
  
  // Fee amount
  feeAmount: string;
  
  // Receive amount - chain token  
  receiveAmount: string;
  receiveChain: string;
  receiveToken: string;
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'executing';
  
  // Additional data
  timestamp: string;
  txHash?: string;
  outputTxHash?: string;
  errorMessage?: string;
  usdValue?: string;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  // Load transactions on component mount
  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Get session token from localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      
      const response = await fetch('/api/bridge/transactions', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success) {
          setTransactions(data.transactions);
        }
      } else if (response.status === 401 || response.status === 403) {
        // Session expired - redirect to login
        console.log('Session expired, redirecting to login...');
        localStorage.removeItem('sessionToken');
        window.location.href = '/wallet-login';
      } else {
        console.error('Failed to fetch transactions:', response.status);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transaction history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions based on search and status
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tx.sentToken.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tx.receiveToken.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Restart failed transaction
  const restartTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/bridge/restart/${transactionId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast({
          title: 'Transaction Restarted',
          description: 'Transaction has been queued for retry'
        });
        loadTransactions(); // Refresh the list
      } else {
        throw new Error('Failed to restart transaction');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to restart transaction',
        variant: 'destructive'
      });
    }
  };

  // Download receipt
  const downloadReceipt = async (transaction: BridgeTransaction) => {
    try {
      const response = await fetch(`/api/bridge/receipt/${transaction.transactionId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `riddle-bridge-receipt-${transaction.transactionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download receipt',
        variant: 'destructive'
      });
    }
  };

  // Get explorer URL for different chains
  const getExplorerUrl = (txHash: string, chain: string) => {
    switch (chain.toLowerCase()) {
      case 'xrp':
      case 'xrpl':
        return `https://livenet.xrpl.org/transactions/${txHash}`;
      case 'eth':
      case 'ethereum':
        return `https://etherscan.io/tx/${txHash}`;
      case 'sol':
      case 'solana':
        return `https://solscan.io/tx/${txHash}`;
      case 'btc':
      case 'bitcoin':
        return `https://blockchair.com/bitcoin/transaction/${txHash}`;
      default:
        return `https://livenet.xrpl.org/transactions/${txHash}`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'executing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'executing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bridge Transactions</h1>
            <p className="text-muted-foreground">View and manage your cross-chain bridge history</p>
          </div>
          <Button onClick={loadTransactions} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by transaction ID or token..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="md:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded-md bg-white dark:bg-gray-800"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="executing">Executing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading transactions...</p>
            </CardContent>
          </Card>
        ) : filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Transactions Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' ? 'No transactions match your filters.' : 'You haven\'t made any bridge transactions yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((transaction) => (
              <Card key={transaction.transactionId} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">
                        Riddle Bridge Transaction
                      </CardTitle>
                      <Badge className={getStatusColor(transaction.status)}>
                        {getStatusIcon(transaction.status)}
                        <span className="ml-1 capitalize">{transaction.status}</span>
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(transaction.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Transaction ID */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                    <div className="font-mono text-sm break-all">{transaction.transactionId}</div>
                  </div>

                  {/* Transaction Flow */}
                  <div className="flex items-center justify-between">
                    {/* Sent Amount */}
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Sent Amount</div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{transaction.sentAmount}</span>
                        <Badge variant="outline">{transaction.sentChain}</Badge>
                        <Badge variant="secondary">{transaction.sentToken}</Badge>
                      </div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground mx-4" />

                    {/* Receive Amount */}
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Receive Amount</div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{transaction.receiveAmount}</span>
                        <Badge variant="outline">{transaction.receiveChain}</Badge>
                        <Badge variant="secondary">{transaction.receiveToken}</Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Fee and USD Value */}
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-muted-foreground">Fee Amount: </span>
                      <span className="font-medium">{transaction.feeAmount} {transaction.receiveToken}</span>
                    </div>
                    {transaction.usdValue && (
                      <div>
                        <span className="text-muted-foreground">USD Value: </span>
                        <span className="font-medium">${transaction.usdValue}</span>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {transaction.status === 'failed' && transaction.errorMessage && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{transaction.errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {transaction.status === 'failed' && (
                      <Button
                        onClick={() => restartTransaction(transaction.transactionId)}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Restart
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => downloadReceipt(transaction)}
                      variant="outline" 
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Receipt
                    </Button>

                    {transaction.txHash && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={getExplorerUrl(transaction.txHash, transaction.sentChain)}
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Initial TX
                        </a>
                      </Button>
                    )}

                    {transaction.outputTxHash && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={getExplorerUrl(transaction.outputTxHash, 'XRPL')}
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          RDL TX
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
