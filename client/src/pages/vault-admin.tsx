/**
 * Vault Admin Dashboard - Management and analytics for liquidity vault
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, TrendingUp, Users, DollarSign, Activity, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardData {
  totalLiquidityUsd: string;
  totalContributors: number;
  totalContributions: number;
  verifiedContributions: number;
  pendingContributions: number;
  chains: any[];
  recentContributions: any[];
  walletTypeBreakdown: any[];
}

export default function VaultAdminPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [newApy, setNewApy] = useState('2.76');
  const { toast } = useToast();

  useEffect(() => {
    loadDashboard();
    loadAnalytics();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/vault/admin/dashboard', {
        credentials: 'include'
      });
      const data = await response.json() as any;
      if (data.success) {
        setDashboard(data.dashboard);
        setContributions(data.dashboard.recentContributions || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/vault/admin/analytics', {
        credentials: 'include'
      });
      const data = await response.json() as any;
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleUpdateApy = async (chain?: string) => {
    try {
      const response = await fetch('/api/vault/admin/update-apy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chain,
          apy: newApy
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        });
        loadDashboard();
      } else {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleToggleChain = async (chain: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/vault/admin/toggle-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chain, isActive })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        });
        loadDashboard();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWalletTypeBadge = (walletType: string) => {
    const colors: Record<string, string> = {
      riddle: 'bg-blue-500',
      xaman: 'bg-purple-500',
      metamask: 'bg-orange-500',
      phantom: 'bg-indigo-500',
      joey: 'bg-pink-500'
    };
    return <Badge className={colors[walletType] || 'bg-gray-500'}>{walletType}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-red-500/10 border-red-500">
          <CardContent className="pt-6">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-red-400">Failed to load dashboard. Please check your admin permissions.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          <Shield className="inline-block h-10 w-10 mr-2 text-blue-400" />
          Vault Admin Dashboard
        </h1>
        <p className="text-gray-400">Manage liquidity vault across all 17 chains</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Liquidity</p>
                <p className="text-2xl font-bold text-green-400">
                  ${parseFloat(dashboard.totalLiquidityUsd || '0').toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Contributors</p>
                <p className="text-2xl font-bold text-blue-400">{dashboard.totalContributors}</p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Deposits</p>
                <p className="text-2xl font-bold text-purple-400">{dashboard.totalContributions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-teal-500/20 border-green-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Verified</p>
                <p className="text-2xl font-bold text-green-400">{dashboard.verifiedContributions}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{dashboard.pendingContributions}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chains" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="chains">Chain Management</TabsTrigger>
          <TabsTrigger value="contributions">Recent Contributions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Chain Management */}
        <TabsContent value="chains">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle>Active Chains</CardTitle>
              <CardDescription>Manage liquidity across all 17 supported blockchains</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chain</TableHead>
                    <TableHead>Native Token</TableHead>
                    <TableHead>Total Liquidity</TableHead>
                    <TableHead>Contributors</TableHead>
                    <TableHead>APY</TableHead>
                    <TableHead>Min Deposit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.chains.map((chain) => (
                    <TableRow key={chain.id}>
                      <TableCell className="font-medium capitalize">{chain.chain}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{chain.nativeToken}</Badge>
                      </TableCell>
                      <TableCell>
                        {parseFloat(chain.totalLiquidity || '0').toFixed(4)} {chain.nativeToken}
                        <p className="text-xs text-gray-500">
                          ${parseFloat(chain.totalLiquidityUsd || '0').toFixed(2)}
                        </p>
                      </TableCell>
                      <TableCell>{chain.activeContributors}</TableCell>
                      <TableCell className="text-green-400">{chain.currentApy}%</TableCell>
                      <TableCell>{chain.minDeposit} {chain.nativeToken}</TableCell>
                      <TableCell>
                        {chain.isActive ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={chain.isActive ? 'destructive' : 'default'}
                          onClick={() => handleToggleChain(chain.chain, !chain.isActive)}
                        >
                          {chain.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Contributions */}
        <TabsContent value="contributions">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle>Recent Contributions</CardTitle>
              <CardDescription>Latest vault deposits from all users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Wallet Type</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead>TX Hash</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributions.map((contrib) => (
                    <TableRow key={contrib.id}>
                      <TableCell className="font-medium">{contrib.userHandle}</TableCell>
                      <TableCell>{getWalletTypeBadge(contrib.walletType)}</TableCell>
                      <TableCell className="capitalize">{contrib.chain}</TableCell>
                      <TableCell>
                        {parseFloat(contrib.amount).toFixed(6)} {contrib.nativeToken}
                        {contrib.amountUsd && (
                          <p className="text-xs text-gray-500">${parseFloat(contrib.amountUsd).toFixed(2)}</p>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(contrib.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{contrib.memo}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {contrib.depositTxHash ? contrib.depositTxHash.slice(0, 12) + '...' : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(contrib.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Wallet Type Breakdown */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>Wallet Type Breakdown</CardTitle>
                <CardDescription>Contributions by wallet type</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.walletTypeBreakdown?.map((item: any) => (
                  <div key={item.walletType} className="flex items-center justify-between mb-4 p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getWalletTypeBadge(item.walletType)}
                      <span className="text-gray-400">{item.count} deposits</span>
                    </div>
                    <span className="font-bold text-green-400">
                      ${parseFloat(item.totalAmount || '0').toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Contributors */}
            {analytics?.topContributors && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle>Top Contributors</CardTitle>
                  <CardDescription>Highest value depositors</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.topContributors.map((contributor: any, index: number) => (
                    <div key={contributor.userHandle} className="flex items-center justify-between mb-4 p-3 bg-gray-900/50 rounded-lg">
                      <div>
                        <p className="font-medium">#{index + 1} {contributor.userHandle}</p>
                        <p className="text-sm text-gray-400">{contributor.totalDeposits} deposits</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-400">
                          ${parseFloat(contributor.totalAmount || '0').toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Rewards: ${parseFloat(contributor.totalRewards || '0').toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
              <CardDescription>Manage vault-wide configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Update APY */}
              <div>
                <h3 className="text-lg font-medium mb-4">Update APY</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-sm text-gray-400 mb-2 block">New APY (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newApy}
                      onChange={(e) => setNewApy(e.target.value)}
                      className="bg-gray-900 border-gray-700"
                    />
                  </div>
                  <Button
                    onClick={() => handleUpdateApy()}
                    className="bg-gradient-to-r from-blue-500 to-purple-600"
                  >
                    Update All Chains
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Current APY: 2.76% across all chains
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
