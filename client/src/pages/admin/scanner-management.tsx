import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Eye,
  Filter,
  Play,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ScannerLog {
  id: string;
  scanner_name: string;
  scanner_type: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  target_id?: string;
  target_name?: string;
  entities_scanned?: number;
  entities_processed?: number;
  entities_failed?: number;
  error_message?: string;
  error_details?: any;
  warnings?: string[];
  statistics?: any;
}

interface ScannerStats {
  total_scans: number;
  successful_scans: number;
  failed_scans: number;
  running_scans: number;
  avg_duration_ms: number;
  success_rate: number;
  by_scanner: Array<{
    scanner_name: string;
    total: number;
    success: number;
    failed: number;
    avg_duration: number;
  }>;
}

interface CollectionInfo {
  id: string;
  collection_id: string;
  collection_name: string;
  issuer: string;
  taxon: number;
  total_nfts: number;
  active_in_game: boolean;
  project_rarity_score?: number;
  project_rarity_rank?: number;
  collection_tier?: string;
  last_rarity_scan?: string;
}

export default function ScannerManagement() {
  const [selectedScanner, setSelectedScanner] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<ScannerLog | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch scanner logs
  const { data: logs = [], isLoading: logsLoading } = useQuery<ScannerLog[]>({
    queryKey: ['/api/scanners/logs', selectedScanner, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedScanner !== 'all') params.append('scanner', selectedScanner);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      const response = await apiRequest(`/api/scanners/logs?${params.toString()}`);
      const data = await response.json() as any;
      return data.logs || [];
    },
    refetchInterval: 5000 // Refresh every 5 seconds for running scans
  });

  // Fetch scanner statistics
  const { data: stats } = useQuery<ScannerStats>({
    queryKey: ['/api/scanners/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/scanners/stats');
      const data = await response.json() as any;
      return data;
    }
  });

  // Fetch collections
  const { data: collections = [] } = useQuery<CollectionInfo[]>({
    queryKey: ['/api/gaming/collections'],
    queryFn: async () => {
      const response = await apiRequest('/api/gaming/collections');
      const data = await response.json() as any;
      return data.collections || [];
    }
  });

  // Manual trigger mutations
  const triggerCollectionScan = useMutation({
    mutationFn: async (data: { issuer: string; taxon: number; name: string }) => {
      return apiRequest('/api/scanners/collection/scan', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Collection Scan Started',
        description: 'The collection scanner is now running',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanners/logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Scan Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const triggerAIScoring = useMutation({
    mutationFn: async (collectionId: string) => {
      return apiRequest(`/api/scanners/ai-scoring/score/${collectionId}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'AI Scoring Started',
        description: 'OpenAI is now scoring NFTs',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanners/logs'] });
    }
  });

  const triggerRarityScan = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/scanners/rarity/scan', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Rarity Scan Started',
        description: 'Rarity calculations are running',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanners/logs'] });
    }
  });

  const triggerCivilizationScan = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/scanners/civilization/scan', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Civilization Scan Started',
        description: 'Civilization analysis is running',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanners/logs'] });
    }
  });

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.scanner_name.toLowerCase().includes(term) ||
        log.target_name?.toLowerCase().includes(term) ||
        log.error_message?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'default',
      completed: 'default',
      failed: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getTierBadge = (tier?: string) => {
    if (!tier) return null;
    
    const colors = {
      legendary: 'bg-amber-500 text-white',
      mythic: 'bg-purple-500 text-white',
      epic: 'bg-blue-500 text-white',
      rare: 'bg-green-500 text-white',
      uncommon: 'bg-gray-400 text-white',
      common: 'bg-gray-300 text-gray-800',
      unranked: 'bg-gray-200 text-gray-600'
    };
    
    return (
      <Badge className={colors[tier as keyof typeof colors] || 'bg-gray-300'}>
        {tier.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">NFT Gaming Scanner Management</h1>
          <p className="text-muted-foreground">Monitor and control all gaming system scanners</p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/scanners'] })}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Scans</p>
                  <h3 className="text-2xl font-bold">{stats.total_scans}</h3>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <h3 className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</h3>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Running</p>
                  <h3 className="text-2xl font-bold">{stats.running_scans}</h3>
                </div>
                <Activity className="h-8 w-8 text-blue-500 animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <h3 className="text-2xl font-bold">{(stats.avg_duration_ms / 1000).toFixed(1)}s</h3>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logs">Scanner Logs</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="manual">Manual Triggers</TabsTrigger>
        </TabsList>

        {/* Scanner Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Scanner Execution Logs</CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedScanner} onValueChange={setSelectedScanner}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by scanner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scanners</SelectItem>
                      <SelectItem value="collection-initial-scanner">Collection Scanner</SelectItem>
                      <SelectItem value="openai-metadata-scorer">AI Scorer</SelectItem>
                      <SelectItem value="rarity-scoring-scanner">Rarity Scanner</SelectItem>
                      <SelectItem value="battle-civilization-scanner">Civilization Scanner</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[200px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {filteredLogs.map((log) => (
                    <Card key={log.id} className={cn(
                      "cursor-pointer hover:bg-accent transition-colors",
                      log.status === 'failed' && "border-red-200"
                    )}
                    onClick={() => setSelectedLog(log)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(log.status)}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{log.scanner_name}</h4>
                                {getStatusBadge(log.status)}
                                {log.target_name && (
                                  <Badge variant="outline">{log.target_name}</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Started: {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}</p>
                                {log.completed_at && (
                                  <p>Duration: {((log.duration_ms || 0) / 1000).toFixed(2)}s</p>
                                )}
                                {log.entities_scanned && (
                                  <p>
                                    Scanned: {log.entities_scanned} | 
                                    Processed: {log.entities_processed || 0} | 
                                    Failed: {log.entities_failed || 0}
                                  </p>
                                )}
                              </div>
                              {log.error_message && (
                                <div className="flex items-center gap-2 text-red-600 text-sm">
                                  <AlertCircle className="h-4 w-4" />
                                  <span>{log.error_message}</span>
                                </div>
                              )}
                              {log.warnings && log.warnings.length > 0 && (
                                <div className="flex items-center gap-2 text-amber-600 text-sm">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>{log.warnings.length} warnings</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collections Tab */}
        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gaming NFT Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <Card key={collection.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{collection.collection_name}</h4>
                              {getTierBadge(collection.collection_tier)}
                              {collection.active_in_game && (
                                <Badge variant="default">Active</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Collection ID: {collection.collection_id}</p>
                              <p>Total NFTs: {collection.total_nfts}</p>
                              {collection.project_rarity_score && (
                                <p>Project Rarity: {collection.project_rarity_score.toFixed(2)} (Rank #{collection.project_rarity_rank})</p>
                              )}
                              {collection.last_rarity_scan && (
                                <p>Last Scan: {formatDistanceToNow(new Date(collection.last_rarity_scan), { addSuffix: true })}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => triggerAIScoring.mutate(collection.collection_id)}
                              disabled={triggerAIScoring.isPending}
                            >
                              <Zap className="h-4 w-4 mr-1" />
                              Score AI
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Triggers Tab */}
        <TabsContent value="manual" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Collection Scanner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Scan a new collection to import all NFTs and parse metadata.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    const issuer = prompt('Enter issuer address:');
                    const taxon = prompt('Enter taxon:');
                    const name = prompt('Enter collection name:');
                    if (issuer && taxon && name) {
                      triggerCollectionScan.mutate({ issuer, taxon: parseInt(taxon), name });
                    }
                  }}
                  disabled={triggerCollectionScan.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Scan New Collection
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Metadata Scorer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use OpenAI to analyze NFT metadata and assign power scores.
                </p>
                <Select onValueChange={(val) => triggerAIScoring.mutate(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection to score" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((c) => (
                      <SelectItem key={c.id} value={c.collection_id}>
                        {c.collection_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rarity & Scoring Scanner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Recalculate rarity scores, rankings, and power multipliers for all NFTs.
                </p>
                <Button
                  className="w-full"
                  onClick={() => triggerRarityScan.mutate()}
                  disabled={triggerRarityScan.isPending}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Run Rarity Scan
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Civilization Scanner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Analyze battle history, city development, and calculate civilization scores.
                </p>
                <Button
                  className="w-full"
                  onClick={() => triggerCivilizationScan.mutate()}
                  disabled={triggerCivilizationScan.isPending}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Run Civilization Scan
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scanner Execution Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Scanner</p>
                  <p className="text-sm text-muted-foreground">{selectedLog.scanner_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  {getStatusBadge(selectedLog.status)}
                </div>
                <div>
                  <p className="text-sm font-medium">Started</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedLog.started_at).toLocaleString()}
                  </p>
                </div>
                {selectedLog.completed_at && (
                  <div>
                    <p className="text-sm font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedLog.completed_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedLog.statistics && (
                <div>
                  <p className="text-sm font-medium mb-2">Statistics</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedLog.statistics, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <p className="text-sm font-medium mb-2">Error Message</p>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <p className="text-sm text-red-700">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}

              {selectedLog.error_details && (
                <div>
                  <p className="text-sm font-medium mb-2">Error Details</p>
                  <pre className="text-xs bg-red-50 p-3 rounded-lg overflow-x-auto border border-red-200">
                    {JSON.stringify(selectedLog.error_details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.warnings && selectedLog.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Warnings</p>
                  <div className="space-y-2">
                    {selectedLog.warnings.map((warning, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-200 p-2 rounded text-sm text-amber-700">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
