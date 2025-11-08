/**
 * ADMIN RIDDLESWAP REPORTS
 * Comprehensive admin dashboard for RiddleSwap collections and RDL token allocation reports
 * Features: 30-day volume reports, NFT collection management, reward calculations
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  RefreshCw, 
  TrendingUp,
  Coins,
  Trophy,
  FileText,
  Calendar,
  Wallet,
  BarChart3,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminRiddleSwapReports = () => {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [targetWallet, setTargetWallet] = useState('rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH');

  // Download RiddleSwap collections
  const downloadCollectionsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/riddleswap-collections/download', {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Collections Downloaded',
        description: `Successfully processed ${data.collections_processed} collections with ${data.total_nfts} NFTs`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/riddleswap-collections'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Download Failed',
        description: error?.message || 'Failed to download RiddleSwap collections',
        variant: 'destructive'
      });
    }
  });

  // Fetch volume-based rewards
  const { data: rewardsData, isLoading: rewardsLoading, refetch: refetchRewards } = useQuery({
    queryKey: ['/api/riddleswap-collections/rewards', targetWallet],
    enabled: !!targetWallet,
    refetchInterval: 60000, // Refresh every minute
  });

  // Generate monthly report
  const generateReportMutation = useMutation({
    mutationFn: async (month: string) => {
      const url = month 
        ? `/api/riddleswap-collections/report/${month}`
        : '/api/riddleswap-collections/report';
      return await apiRequest(url, { method: 'GET' });
    },
    onSuccess: (data) => {
      toast({
        title: 'Report Generated',
        description: `Monthly RDL allocation report created: ${data.report_id}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Report Generation Failed',
        description: error?.message || 'Failed to generate monthly report',
        variant: 'destructive'
      });
    }
  });

  // Fetch wallet rewards data
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['/api/riddleswap-collections/wallet', targetWallet],
    enabled: !!targetWallet,
  });

  const rewards = rewardsData?.data;
  const walletRewards = walletData?.data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            RiddleSwap Collections & Reports
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Admin dashboard for NFT collections management and RDL token allocation reports
          </p>
          <div className="mt-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              Target Issuer: rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH
            </Badge>
            <Badge variant="secondary" className="ml-2 text-lg px-4 py-2">
              Taxons: 0, 1, 2, 3, 9
            </Badge>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Collection Management
              </CardTitle>
              <CardDescription>
                Download and process NFTs from target issuer and taxons
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => downloadCollectionsMutation.mutate()}
                disabled={downloadCollectionsMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="download-collections-button"
              >
                {downloadCollectionsMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download RiddleSwap Collections
              </Button>
              <p className="text-sm text-gray-500">
                Downloads all NFTs from issuer rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH for taxons 0, 1, 2, 3, 9
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Generation
              </CardTitle>
              <CardDescription>
                Generate monthly RDL allocation reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="month">Month (YYYY-MM, optional)</Label>
                <Input
                  id="month"
                  type="text"
                  placeholder="2025-01"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  data-testid="month-input"
                />
              </div>
              <Button
                onClick={() => generateReportMutation.mutate(selectedMonth)}
                disabled={generateReportMutation.isPending}
                className="w-full"
                data-testid="generate-report-button"
              >
                {generateReportMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4 mr-2" />
                )}
                Generate Monthly Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Analysis */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Analysis
              </CardTitle>
              <CardDescription>
                Analyze specific wallet for NFT holdings and rewards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="wallet">Target Wallet Address</Label>
                <Input
                  id="wallet"
                  type="text"
                  value={targetWallet}
                  onChange={(e) => setTargetWallet(e.target.value)}
                  placeholder="Enter wallet address"
                  data-testid="wallet-input"
                />
              </div>
              <Button
                onClick={() => refetchRewards()}
                disabled={rewardsLoading}
                variant="outline"
                data-testid="refresh-rewards-button"
              >
                {rewardsLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh Analysis
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Volume-Based Rewards Summary */}
        {rewards && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8" />
                  <div>
                    <h3 className="font-semibold">30-Day Volume</h3>
                    <p className="text-2xl font-bold" data-testid="total-volume">
                      ${rewards.total_volume_usd?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-sm opacity-90">Platform trading volume</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-violet-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Coins className="h-8 w-8" />
                  <div>
                    <h3 className="font-semibold">Reward Pool</h3>
                    <p className="text-2xl font-bold" data-testid="reward-pool">
                      ${rewards.total_reward_pool?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-sm opacity-90">5% of volume (RDL)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8" />
                  <div>
                    <h3 className="font-semibold">Eligible Wallets</h3>
                    <p className="text-2xl font-bold" data-testid="eligible-wallets">
                      {rewards.reward_data?.length || 0}
                    </p>
                    <p className="text-sm opacity-90">NFT holders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Wallet Data */}
        {walletRewards && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  NFT Holdings
                </CardTitle>
                <CardDescription>
                  Current NFT holdings for target wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Total NFTs:</span>
                      <span className="ml-2 font-semibold text-lg" data-testid="wallet-total-nfts">
                        {walletRewards.total_nfts}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Collections:</span>
                      <span className="ml-2 font-semibold text-lg" data-testid="wallet-collections">
                        {walletRewards.collections?.length || 0}
                      </span>
                    </div>
                  </div>
                  
                  {walletRewards.collections?.map((collection: string, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{collection}</h4>
                      <p className="text-sm text-gray-500">
                        NFTs held: {walletRewards.nft_holdings.filter((h: any) => h.collection_name === collection).length}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Reward Calculation
                </CardTitle>
                <CardDescription>
                  Volume-based RDL token allocation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletRewards.reward_data ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-green-800 dark:text-green-200">Eligible for Rewards</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Volume %:</span>
                          <span className="ml-2 font-semibold" data-testid="wallet-volume-percentage">
                            {walletRewards.reward_data.volume_percentage?.toFixed(4)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">RDL Reward:</span>
                          <span className="ml-2 font-semibold text-green-600" data-testid="wallet-rdl-reward">
                            {walletRewards.reward_data.rdl_reward_amount} RDL
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {walletRewards.reward_data.reward_basis}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No rewards calculated for this wallet. Ensure the wallet holds RiddleSwap NFTs.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rewards Distribution Table */}
        {rewards?.reward_data && rewards.reward_data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                30-Day Rewards Distribution
              </CardTitle>
              <CardDescription>
                Volume-based RDL token allocation for all eligible wallets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 dark:border-gray-700">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      <th className="border p-3 text-left">Wallet Address</th>
                      <th className="border p-3 text-left">NFTs Held</th>
                      <th className="border p-3 text-left">Volume %</th>
                      <th className="border p-3 text-left">RDL Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.reward_data.slice(0, 20).map((reward: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="border p-3 font-mono text-sm" data-testid={`reward-wallet-${index}`}>
                          {reward.wallet_address}
                        </td>
                        <td className="border p-3" data-testid={`reward-nfts-${index}`}>
                          {reward.total_nfts_held}
                        </td>
                        <td className="border p-3" data-testid={`reward-percentage-${index}`}>
                          {reward.volume_percentage?.toFixed(4)}%
                        </td>
                        <td className="border p-3 font-semibold text-green-600" data-testid={`reward-amount-${index}`}>
                          {reward.rdl_reward_amount} RDL
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rewards.reward_data.length > 20 && (
                  <p className="text-sm text-gray-500 mt-4">
                    Showing top 20 of {rewards.reward_data.length} eligible wallets
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminRiddleSwapReports;
