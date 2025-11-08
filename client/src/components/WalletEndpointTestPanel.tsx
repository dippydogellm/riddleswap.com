/**
 * Wallet Endpoint Test Panel
 * A comprehensive testing interface for all wallet endpoints
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  PlayCircle, 
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Info
} from 'lucide-react';
import WalletEndpointTester, { 
  type ChainTestResults, 
  type EndpointTestResult,
  SUPPORTED_CHAINS,
  STANDARD_ENDPOINTS 
} from '@/lib/wallet-endpoint-tester';

export default function WalletEndpointTestPanel() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChain, setCurrentChain] = useState<string>('');
  const [results, setResults] = useState<ChainTestResults[]>([]);
  const [selectedResult, setSelectedResult] = useState<ChainTestResults | null>(null);

  const tester = new WalletEndpointTester();

  const runComprehensiveTest = async () => {
    setTesting(true);
    setProgress(0);
    setResults([]);
    setSelectedResult(null);

    try {
      const allResults = await tester.testAllChains((progressInfo) => {
        setCurrentChain(progressInfo.chain);
        setProgress((progressInfo.completed / progressInfo.total) * 100);
      });

      setResults(allResults);
      
      // Generate summary
      const totalEndpoints = allResults.reduce((sum, chain) => sum + chain.summary.total, 0);
      const totalPassed = allResults.reduce((sum, chain) => sum + chain.summary.passed, 0);
      const successRate = (totalPassed / totalEndpoints) * 100;

      toast({
        title: "Testing Complete!",
        description: `${totalPassed}/${totalEndpoints} endpoints working (${successRate.toFixed(1)}% success rate)`,
        duration: 5000
      });

    } catch (error) {
      toast({
        title: "Testing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
      setProgress(100);
      setCurrentChain('');
    }
  };

  const testSingleChain = async (chain: string) => {
    setTesting(true);
    try {
      const result = await tester.testChain(chain);
      setResults(prev => [...prev.filter(r => r.chain !== chain), result]);
      setSelectedResult(result);
      
      toast({
        title: `${chain.toUpperCase()} Testing Complete`,
        description: `${result.summary.passed}/${result.summary.total} endpoints working`,
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "Chain Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const exportResults = () => {
    const report = tester.generateReport(results);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-endpoint-test-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (result: EndpointTestResult) => {
    if (result.success) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getChainSuccessRate = (chainResult: ChainTestResults) => {
    if (chainResult.summary.total === 0) return 0;
    return (chainResult.summary.passed / chainResult.summary.total) * 100;
  };

  const overallStats = results.length > 0 ? {
    totalChains: results.length,
    totalEndpoints: results.reduce((sum, chain) => sum + chain.summary.total, 0),
    totalPassed: results.reduce((sum, chain) => sum + chain.summary.passed, 0),
    averageResponseTime: Math.round(
      results.reduce((sum, chain) => sum + chain.summary.averageResponseTime, 0) / results.length
    )
  } : null;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6" data-testid="wallet-endpoint-test-panel">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Wallet Endpoint Testing Suite
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensive testing for all wallet endpoints across {SUPPORTED_CHAINS.length} blockchain networks
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={runComprehensiveTest} 
              disabled={testing}
              className="flex items-center gap-2"
              data-testid="button-test-all-chains"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              Test All Chains
            </Button>
            
            {results.length > 0 && (
              <Button 
                variant="outline" 
                onClick={exportResults}
                className="flex items-center gap-2"
                data-testid="button-export-results"
              >
                <RefreshCw className="w-4 h-4" />
                Export Report
              </Button>
            )}
          </div>

          {testing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Testing progress...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {currentChain && (
                <p className="text-sm text-muted-foreground">
                  Currently testing: {currentChain.toUpperCase()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overall Statistics */}
      {overallStats && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{overallStats.totalChains}</div>
                <div className="text-sm text-muted-foreground">Chains Tested</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{overallStats.totalPassed}</div>
                <div className="text-sm text-muted-foreground">Endpoints Working</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {overallStats.totalEndpoints > 0 
                    ? Math.round((overallStats.totalPassed / overallStats.totalEndpoints) * 100)
                    : 0
                  }%
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{overallStats.averageResponseTime}ms</div>
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="chains">Chain Details</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoint Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Chain Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {results.map((chainResult) => {
                    const successRate = getChainSuccessRate(chainResult);
                    return (
                      <div 
                        key={chainResult.chain}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                        onClick={() => setSelectedResult(chainResult)}
                        data-testid={`chain-result-${chainResult.chain}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="font-mono font-bold text-sm">
                            {chainResult.chain.toUpperCase()}
                          </div>
                          <Badge 
                            variant={successRate === 100 ? "default" : successRate > 50 ? "secondary" : "destructive"}
                          >
                            {successRate.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {chainResult.summary.passed}/{chainResult.summary.total} endpoints
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chains" className="space-y-4">
            <div className="grid gap-4">
              {SUPPORTED_CHAINS.map((chain) => (
                <Card key={chain}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{chain.toUpperCase()}</CardTitle>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => testSingleChain(chain)}
                        disabled={testing}
                        data-testid={`button-test-${chain}`}
                      >
                        Test Chain
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const chainResult = results.find(r => r.chain === chain);
                      if (!chainResult) {
                        return (
                          <div className="text-sm text-muted-foreground">
                            Not tested yet
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>Success Rate: {getChainSuccessRate(chainResult).toFixed(1)}%</div>
                            <div>Avg Response: {chainResult.summary.averageResponseTime}ms</div>
                          </div>
                          <div className="grid gap-1">
                            {chainResult.results.map((result) => (
                              <div 
                                key={result.endpoint}
                                className="flex items-center justify-between text-sm p-2 border rounded"
                                data-testid={`endpoint-result-${chain}-${result.endpoint}`}
                              >
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(result)}
                                  <span>{result.endpoint}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  {result.responseTime}ms
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Endpoint Performance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {STANDARD_ENDPOINTS.map((endpoint) => {
                  const endpointResults = results.flatMap(chain => 
                    chain.results.filter(r => r.endpoint === endpoint)
                  );
                  const successRate = endpointResults.length > 0 
                    ? (endpointResults.filter(r => r.success).length / endpointResults.length) * 100
                    : 0;
                  const avgResponseTime = endpointResults.length > 0
                    ? Math.round(endpointResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / endpointResults.length)
                    : 0;

                  return (
                    <div 
                      key={endpoint}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`endpoint-analysis-${endpoint}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-medium">{endpoint}</div>
                        <Badge variant={successRate === 100 ? "default" : successRate > 80 ? "secondary" : "destructive"}>
                          {successRate.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {avgResponseTime}ms avg • {endpointResults.filter(r => r.success).length}/{endpointResults.length} chains
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
