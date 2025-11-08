import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Search, ExternalLink, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface TokenSafetyReport {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  safetyScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  checks: {
    contractVerified: boolean;
    liquidityLocked: boolean;
    ownershipRenounced: boolean;
    honeypotCheck: boolean;
    rugPullRisk: boolean;
    highTax: boolean;
    mintFunction: boolean;
    proxyContract: boolean;
    teamTokens: number;
    liquidityAmount: string;
    holderCount: number;
    tradingVolume: string;
  };
  warnings: string[];
  recommendations: string[];
}

export default function TokenSafetyPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [safetyReport, setSafetyReport] = useState<TokenSafetyReport | null>(null);
  const { toast } = useToast();

  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum', color: 'bg-blue-600' },
    { id: 'bsc', name: 'BSC', color: 'bg-yellow-500' },
    { id: 'polygon', name: 'Polygon', color: 'bg-purple-500' },
    { id: 'arbitrum', name: 'Arbitrum', color: 'bg-blue-400' },
    { id: 'base', name: 'Base', color: 'bg-blue-500' },
    { id: 'xrpl', name: 'XRPL', color: 'bg-black' },
    { id: 'solana', name: 'Solana', color: 'bg-purple-600' }
  ];

  const handleAnalyze = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Empty Input",
        description: "Please enter a token address or symbol",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Mock analysis for now - in production, this would call real security APIs
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockReport: TokenSafetyReport = {
        address: searchTerm,
        symbol: 'MOCK',
        name: 'Mock Token',
        chain: selectedChain,
        safetyScore: Math.floor(Math.random() * 100),
        riskLevel: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)[Math.floor(Math.random() * 4)],
        checks: {
          contractVerified: Math.random() > 0.3,
          liquidityLocked: Math.random() > 0.4,
          ownershipRenounced: Math.random() > 0.5,
          honeypotCheck: Math.random() > 0.8,
          rugPullRisk: Math.random() > 0.7,
          highTax: Math.random() > 0.6,
          mintFunction: Math.random() > 0.4,
          proxyContract: Math.random() > 0.6,
          teamTokens: Math.floor(Math.random() * 50),
          liquidityAmount: `$${Math.floor(Math.random() * 1000000).toLocaleString()}`,
          holderCount: Math.floor(Math.random() * 10000),
          tradingVolume: `$${Math.floor(Math.random() * 500000).toLocaleString()}`
        },
        warnings: [],
        recommendations: []
      };

      // Generate warnings based on checks
      if (!mockReport.checks.contractVerified) {
        mockReport.warnings.push('Contract is not verified on blockchain explorer');
      }
      if (!mockReport.checks.liquidityLocked) {
        mockReport.warnings.push('Liquidity is not locked - risk of rug pull');
      }
      if (mockReport.checks.honeypotCheck) {
        mockReport.warnings.push('Potential honeypot detected - selling may be restricted');
      }
      if (mockReport.checks.highTax) {
        mockReport.warnings.push('High transaction tax detected (>10%)');
      }
      if (mockReport.checks.teamTokens > 20) {
        mockReport.warnings.push('Team holds large portion of tokens');
      }

      // Generate recommendations
      mockReport.recommendations.push('Always verify contract on official blockchain explorer');
      mockReport.recommendations.push('Check liquidity and trading volume before investing');
      mockReport.recommendations.push('Start with small amounts for testing');
      mockReport.recommendations.push('Monitor token activity for suspicious behavior');

      setSafetyReport(mockReport);
      
      toast({
        title: "Analysis Complete",
        description: `Safety score: ${mockReport.safetyScore}/100 (${mockReport.riskLevel} risk)`
      });
      
    } catch (error) {
      toast({
        title: "Analysis Error",
        description: "Failed to analyze token safety",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Token Safety Check</h1>
            <p className="text-muted-foreground">Analyze token security and detect potential risks before trading</p>
          </div>
        </div>

        {/* Analysis Form */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter token address or symbol"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                </div>
                <select 
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                >
                  {supportedChains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
                <Button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
                  className="min-w-[120px]"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Analyze Token
                    </>
                  )}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>⚠️ This tool provides security analysis but should not be the only factor in investment decisions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Safety Report */}
      {safetyReport && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Safety Analysis Results</CardTitle>
                <Badge className={getRiskColor(safetyReport.riskLevel)}>
                  {safetyReport.riskLevel} RISK
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(safetyReport.safetyScore)}`}>
                    {safetyReport.safetyScore}/100
                  </div>
                  <p className="text-sm text-muted-foreground">Safety Score</p>
                  <Progress 
                    value={safetyReport.safetyScore} 
                    className="mt-2"
                  />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{safetyReport.name}</div>
                  <p className="text-sm text-muted-foreground">{safetyReport.symbol}</p>
                  <Badge className={supportedChains.find(c => c.id === safetyReport.chain)?.color}>
                    {safetyReport.chain.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{safetyReport.checks.holderCount.toLocaleString()}</div>
                  <p className="text-sm text-muted-foreground">Holders</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{safetyReport.checks.tradingVolume}</div>
                  <p className="text-sm text-muted-foreground">24h Volume</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Checks */}
          <Card>
            <CardHeader>
              <CardTitle>Security Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Contract Verified</span>
                    {safetyReport.checks.contractVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Liquidity Locked</span>
                    {safetyReport.checks.liquidityLocked ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ownership Renounced</span>
                    {safetyReport.checks.ownershipRenounced ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Honeypot Check</span>
                    {!safetyReport.checks.honeypotCheck ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>High Tax Check</span>
                    {!safetyReport.checks.highTax ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mint Function</span>
                    {!safetyReport.checks.mintFunction ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Proxy Contract</span>
                    {!safetyReport.checks.proxyContract ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Team Tokens</span>
                    <span className={safetyReport.checks.teamTokens > 20 ? 'text-red-600' : 'text-green-600'}>
                      {safetyReport.checks.teamTokens}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {safetyReport.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {safetyReport.warnings.map((warning, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {safetyReport.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Explorer
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Check on DEXTools
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on CoinGecko
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    const chain = selectedChain;
                    const swapPath = chain === 'xrpl' ? '/xrpl-swap' :
                                   chain === 'solana' ? '/solana-swap' :
                                   '/evm-swap';
                    window.location.href = swapPath;
                  }}
                >
                  Trade Token
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
