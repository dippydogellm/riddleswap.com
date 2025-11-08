import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Camera, Download, Search, FileText, Database, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { CSVExport } from '@/components/csv-utils';
import '../styles/devtools-snapshot.css';

const snapshotSchema = z.object({
  chain: z.string().min(1, 'Please select a blockchain'),
  target_contract: z.string().min(1, 'Contract address is required').regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  block_number: z.string().optional()
});

type SnapshotFormData = z.infer<typeof snapshotSchema>;

const NFTSnapshot = () => {
  const { projectId } = useParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to access DevTools. Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/wallet-login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading NFT Snapshot...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const [snapshotStatus, setSnapshotStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [snapshotResult, setSnapshotResult] = useState<any>(null);

  const form = useForm<SnapshotFormData>({
    resolver: zodResolver(snapshotSchema),
    defaultValues: {
      chain: '',
      target_contract: '',
      block_number: ''
    }
  });

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', explorer: 'etherscan.io' },
    { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', explorer: 'bscscan.com' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', explorer: 'polygonscan.com' },
    { id: 'base', name: 'Base', symbol: 'ETH', explorer: 'basescan.org' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', explorer: 'arbiscan.io' }
  ];

  const createSnapshotMutation = useMutation({
    mutationFn: async (data: SnapshotFormData) => {
      const response = await fetch('/api/devtools/snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          snapshot_type: 'nft_holders'
        })
      });
      if (!response.ok) throw new Error('Failed to create snapshot');
      return response.json();
    },
    onSuccess: (result) => {
      setSnapshotStatus('completed');
      setSnapshotResult(result);
      toast({
        title: 'Snapshot Created',
        description: `Successfully captured ${result.total_holders || 0} NFT holders.`,
      });
    },
    onError: (error) => {
      setSnapshotStatus('error');
      toast({
        title: 'Snapshot Failed',
        description: error.message || 'Failed to create NFT snapshot. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: SnapshotFormData) => {
    setSnapshotStatus('processing');
    createSnapshotMutation.mutate(data);
  };

  const downloadSnapshot = () => {
    if (snapshotResult?.file_url) {
      window.open(snapshotResult.file_url, '_blank');
    }
  };

  return (
    <div className="snapshot-tool">
      {/* Header */}
      <div className="snapshot-header">
        <div className="header-content">
          <Link href={`/devtools/project/${projectId}`} className="back-button">
            <ArrowLeft className="w-4 h-4" />
            Back to Project Dashboard
          </Link>
          
          <div className="header-info">
            <div className="header-icon">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h1 className="header-title">NFT Snapshot</h1>
              <p className="header-subtitle">Capture NFT holder data for airdrops and analytics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="snapshot-content">
        <div className="snapshot-grid">
          {/* Form Card */}
          <Card className="snapshot-form-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Snapshot Configuration
              </CardTitle>
              <CardDescription>
                Configure your NFT collection snapshot parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="snapshot-form">
                  <FormField
                    control={form.control}
                    name="chain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Blockchain</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select blockchain" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {chains.map((chain) => (
                              <SelectItem key={chain.id} value={chain.id}>
                                <div className="chain-option">
                                  <span>{chain.name}</span>
                                  <Badge variant="outline">{chain.symbol}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="target_contract"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NFT Contract Address</FormLabel>
                        <FormControl>
                          <div className="input-with-icon">
                            <Search className="w-4 h-4 input-icon" />
                            <Input placeholder="0x..." {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="block_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Block Number (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Latest block if empty"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground mt-1">
                          Leave empty to use the latest block
                        </p>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={snapshotStatus === 'processing'}
                    className="w-full snapshot-button"
                  >
                    {snapshotStatus === 'processing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating Snapshot...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Create NFT Snapshot
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="info-cards">
            <Card className="info-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">What you'll get</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="info-list">
                  <li>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete holder addresses
                  </li>
                  <li>
                    <CheckCircle2 className="w-4 h-4" />
                    Token IDs owned
                  </li>
                  <li>
                    <CheckCircle2 className="w-4 h-4" />
                    Balance count per address
                  </li>
                  <li>
                    <CheckCircle2 className="w-4 h-4" />
                    CSV & JSON exports
                  </li>
                  <li>
                    <CheckCircle2 className="w-4 h-4" />
                    Metadata lookup
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="info-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Use Cases</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="info-list">
                  <li>
                    <FileText className="w-4 h-4" />
                    Airdrop distributions
                  </li>
                  <li>
                    <FileText className="w-4 h-4" />
                    Community analytics
                  </li>
                  <li>
                    <FileText className="w-4 h-4" />
                    Holder verification
                  </li>
                  <li>
                    <FileText className="w-4 h-4" />
                    Marketing campaigns
                  </li>
                  <li>
                    <FileText className="w-4 h-4" />
                    Governance snapshots
                  </li>
                </ul>
              </CardContent>
            </Card>

            {snapshotStatus !== 'idle' && (
              <Card className={`status-card ${snapshotStatus}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {snapshotStatus === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {snapshotStatus === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                    {snapshotStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                    Snapshot Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {snapshotStatus === 'processing' && (
                    <div className="status-content">
                      <p>Processing NFT collection data...</p>
                      <div className="progress-bar">
                        <div className="progress-fill"></div>
                      </div>
                    </div>
                  )}
                  
                  {snapshotStatus === 'completed' && snapshotResult && (
                    <div className="status-content">
                      <div className="result-stats">
                        <div className="stat-item">
                          <span className="stat-label">Total Holders:</span>
                          <span className="stat-value">{snapshotResult.total_holders || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Block Number:</span>
                          <span className="stat-value">{snapshotResult.block_number || 'Latest'}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Timestamp:</span>
                          <span className="stat-value">{new Date().toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={downloadSnapshot}
                          className="download-button flex-1"
                          disabled={!snapshotResult.file_url}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Data
                        </Button>
                        
                        <CSVExport
                          data={snapshotResult.holders || []}
                          filename={`nft_snapshot_${form.watch('target_contract')}`}
                          headers={['address', 'token_count', 'token_ids']}
                          disabled={!snapshotResult.holders || snapshotResult.holders.length === 0}
                        />
                      </div>
                    </div>
                  )}
                  
                  {snapshotStatus === 'error' && (
                    <div className="status-content">
                      <p className="error-message">
                        Failed to create snapshot. Please check the contract address and try again.
                      </p>
                      <Button
                        onClick={() => setSnapshotStatus('idle')}
                        variant="outline"
                        size="sm"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Snapshots */}
        <Card className="recent-snapshots">
          <CardHeader>
            <CardTitle>Recent NFT Snapshots</CardTitle>
            <CardDescription>
              Your recently created NFT holder snapshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="snapshots-list">
              <div className="snapshot-item">
                <div className="snapshot-info">
                  <div className="snapshot-name">CryptoPunks Collection</div>
                  <div className="snapshot-meta">
                    <Badge variant="outline">Ethereum</Badge>
                    <span>10,000 holders</span>
                    <span>2 hours ago</span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="snapshot-item">
                <div className="snapshot-info">
                  <div className="snapshot-name">Bored Ape Yacht Club</div>
                  <div className="snapshot-meta">
                    <Badge variant="outline">Ethereum</Badge>
                    <span>6,439 holders</span>
                    <span>5 hours ago</span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="snapshot-item">
                <div className="snapshot-info">
                  <div className="snapshot-name">Azuki Collection</div>
                  <div className="snapshot-meta">
                    <Badge variant="outline">Ethereum</Badge>
                    <span>4,762 holders</span>
                    <span>1 day ago</span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NFTSnapshot;
