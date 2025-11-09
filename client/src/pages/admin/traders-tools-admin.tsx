import React, { useState, useEffect } from 'react';
import { Bot, Play, Pause, Users, TrendingUp, Settings, AlertTriangle, Check, X, Eye, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { apiRequest } from "@/lib/queryClient";

interface SniperBot {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  targetToken: string;
  participants: number;
  totalInvestment: string;
  successRate: number;
  activeSnipes: number;
  profitsToday: string;
}

interface CopyTrade {
  id: string;
  traderId: string;
  traderName: string;
  followers: number;
  status: 'active' | 'paused' | 'stopped';
  totalVolume: string;
  profitsToday: string;
  activeTrades: number;
}

interface Trade {
  id: string;
  type: 'snipe' | 'copy';
  token: string;
  amount: string;
  status: 'pending' | 'success' | 'failed' | 'distributed';
  participants: number;
  profit: string;
  timestamp: string;
  botId?: string;
  traderId?: string;
}

interface DistributionRecord {
  id: string;
  tradeId: string;
  totalProfit: string;
  participantCount: number;
  distributedAmount: string;
  timestamp: string;
  status: 'completed' | 'failed' | 'pending';
}

export default function TradersToolsAdmin() {
  const [sniperBots, setSniperBots] = useState<SniperBot[]>([]);
  const [copyTrades, setCopyTrades] = useState<CopyTrade[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
  const [selectedBot, setSelectedBot] = useState('all');
  const [selectedTrader, setSelectedTrader] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Mock data - replace with real API calls
  const mockSniperBots: SniperBot[] = [
    {
      id: 'sniper-1',
      name: 'Alpha Hunter Bot',
      status: 'running',
      targetToken: 'XRPL-NewTokens',
      participants: 45,
      totalInvestment: '$12,450',
      successRate: 78.5,
      activeSnipes: 3,
      profitsToday: '+$2,847'
    },
    {
      id: 'sniper-2',
      name: 'Quick Strike Bot',
      status: 'paused',
      targetToken: 'ETH-Gems',
      participants: 23,
      totalInvestment: '$8,920',
      successRate: 65.2,
      activeSnipes: 0,
      profitsToday: '+$1,234'
    }
  ];

  const mockCopyTrades: CopyTrade[] = [
    {
      id: 'copy-1',
      traderId: 'trader-1',
      traderName: 'CryptoWizard',
      followers: 156,
      status: 'active',
      totalVolume: '$45,678',
      profitsToday: '+$3,456',
      activeTrades: 7
    },
    {
      id: 'copy-2',
      traderId: 'trader-2',
      traderName: 'DeFiMaster',
      followers: 89,
      status: 'active',
      totalVolume: '$23,890',
      profitsToday: '+$1,567',
      activeTrades: 4
    }
  ];

  const mockTrades: Trade[] = [
    {
      id: 'trade-1',
      type: 'snipe',
      token: 'RMOON',
      amount: '$5,430',
      status: 'success',
      participants: 45,
      profit: '+$1,247',
      timestamp: '2 minutes ago',
      botId: 'sniper-1'
    },
    {
      id: 'trade-2',
      type: 'copy',
      token: 'USDC',
      amount: '$12,000',
      status: 'distributed',
      participants: 156,
      profit: '+$892',
      timestamp: '15 minutes ago',
      traderId: 'trader-1'
    },
    {
      id: 'trade-3',
      type: 'snipe',
      token: 'XGEM',
      amount: '$3,200',
      status: 'failed',
      participants: 23,
      profit: '-$450',
      timestamp: '1 hour ago',
      botId: 'sniper-2'
    }
  ];

  const mockDistributions: DistributionRecord[] = [
    {
      id: 'dist-1',
      tradeId: 'trade-2',
      totalProfit: '$892',
      participantCount: 156,
      distributedAmount: '$802.80',
      timestamp: '16 minutes ago',
      status: 'completed'
    },
    {
      id: 'dist-2',
      tradeId: 'trade-1',
      totalProfit: '$1,247',
      participantCount: 45,
      distributedAmount: '$1,122.30',
      timestamp: 'Processing...',
      status: 'pending'
    }
  ];

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      // In production, load real data from API
      setSniperBots(mockSniperBots);
      setCopyTrades(mockCopyTrades);
      setRecentTrades(mockTrades);
      setDistributions(mockDistributions);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBotAction = async (botId: string, action: 'start' | 'stop' | 'pause') => {
    try {
      await apiRequest(`/api/traders/admin/sniper-bot/${action}`, { method: 'POST', body: JSON.stringify({ botId }) });
      
      setSniperBots(prev => prev.map(bot => 
        bot.id === botId 
          ? { ...bot, status: action === 'start' ? 'running' : action === 'stop' ? 'stopped' : 'paused' }
          : bot
      ));

      toast({
        title: `Bot ${action}ed`,
        description: `Sniper bot has been ${action}ed successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} bot`,
        variant: "destructive"
      });
    }
  };

  const handleCopyTradeAction = async (tradeId: string, action: 'pause' | 'stop' | 'resume') => {
    try {
      await apiRequest(`/api/traders/admin/copy-trade/${action}`, { method: 'POST', body: JSON.stringify({ tradeId }) });
      
      setCopyTrades(prev => prev.map(trade => 
        trade.id === tradeId 
          ? { ...trade, status: action === 'resume' ? 'active' : action === 'pause' ? 'paused' : 'stopped' }
          : trade
      ));

      toast({
        title: `Copy trading ${action}ed`,
        description: `Copy trading has been ${action}ed successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} copy trading`,
        variant: "destructive"
      });
    }
  };

  const handleDistributeProfits = async (tradeId: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest(`/api/traders/admin/distribute-profits`, { method: 'POST', body: JSON.stringify({ botId: tradeId }) });
      const data = await response.json();

      setDistributions(prev => [...prev, data.distribution]);
      setRecentTrades(prev => prev.map(trade =>
        trade.id === tradeId ? { ...trade, status: 'distributed' } : trade
      ));

      toast({
        title: "Distribution Complete",
        description: `Profits distributed to ${data.distribution.participantCount} wallets`
      });
    } catch (error) {
      toast({
        title: "Distribution Failed",
        description: "Failed to distribute profits",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
      case 'success':
      case 'completed':
        return 'bg-green-500';
      case 'paused':
      case 'pending':
        return 'bg-yellow-500';
      case 'stopped':
      case 'failed':
        return 'bg-red-500';
      case 'distributed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredTrades = recentTrades.filter(trade => {
    if (selectedBot !== 'all' && trade.botId !== selectedBot) return false;
    if (selectedTrader !== 'all' && trade.traderId !== selectedTrader) return false;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Traders Tools Admin</h1>
            <p className="text-muted-foreground">Manage sniper bots, copy trading, and profit distribution</p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Bots</p>
                  <p className="text-2xl font-bold">{sniperBots.filter(b => b.status === 'running').length}</p>
                </div>
                <Bot className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Copy Traders</p>
                  <p className="text-2xl font-bold">{copyTrades.filter(c => c.status === 'active').length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Participants</p>
                  <p className="text-2xl font-bold">{sniperBots.reduce((sum, bot) => sum + bot.participants, 0) + copyTrades.reduce((sum, trade) => sum + trade.followers, 0)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Profits Today</p>
                  <p className="text-2xl font-bold text-green-600">+$8,104</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="bots" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bots">Sniper Bots</TabsTrigger>
          <TabsTrigger value="copy">Copy Trading</TabsTrigger>
          <TabsTrigger value="trades">Trade History</TabsTrigger>
          <TabsTrigger value="distribution">Distributions</TabsTrigger>
        </TabsList>

        <TabsContent value="bots">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Sniper Bots Management</h2>
              <Button>
                <Bot className="h-4 w-4 mr-2" />
                Add New Bot
              </Button>
            </div>

            {sniperBots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(bot.status)}`} />
                      <CardTitle>{bot.name}</CardTitle>
                      <Badge variant="outline">{bot.targetToken}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={bot.id} onValueChange={(value) => setSelectedBot(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={bot.id}>Manage</SelectItem>
                          <SelectItem value="configure">Configure</SelectItem>
                          <SelectItem value="logs">View Logs</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {bot.status === 'running' ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleBotAction(bot.id, 'pause')}>
                            <Pause className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleBotAction(bot.id, 'stop')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleBotAction(bot.id, 'start')}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Participants</p>
                      <p className="font-semibold">{bot.participants}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Investment</p>
                      <p className="font-semibold">{bot.totalInvestment}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="font-semibold">{bot.successRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Profits Today</p>
                      <p className="font-semibold text-green-600">{bot.profitsToday}</p>
                    </div>
                  </div>
                  
                  {bot.activeSnipes > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800">
                        {bot.activeSnipes} active snipes in progress
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="copy">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Copy Trading Management</h2>
            </div>

            {copyTrades.map((trade) => (
              <Card key={trade.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(trade.status)}`} />
                      <CardTitle>{trade.traderName}</CardTitle>
                      <Badge variant="outline">{trade.followers} followers</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Profile
                      </Button>
                      
                      {trade.status === 'active' ? (
                        <Button size="sm" variant="outline" onClick={() => handleCopyTradeAction(trade.id, 'pause')}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleCopyTradeAction(trade.id, 'resume')}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button size="sm" variant="destructive" onClick={() => handleCopyTradeAction(trade.id, 'stop')}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Volume</p>
                      <p className="font-semibold">{trade.totalVolume}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Trades</p>
                      <p className="font-semibold">{trade.activeTrades}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Followers</p>
                      <p className="font-semibold">{trade.followers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Profits Today</p>
                      <p className="font-semibold text-green-600">{trade.profitsToday}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trades">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Recent Trades</h2>
              <div className="flex items-center gap-2">
                <Select value={selectedBot} onValueChange={setSelectedBot}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by bot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bots</SelectItem>
                    {sniperBots.map(bot => (
                      <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedTrader} onValueChange={setSelectedTrader}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by trader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Traders</SelectItem>
                    {copyTrades.map(trade => (
                      <SelectItem key={trade.id} value={trade.traderId}>{trade.traderName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredTrades.map((trade) => (
                <Card key={trade.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(trade.status)}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={trade.type === 'snipe' ? 'default' : 'secondary'}>
                              {trade.type}
                            </Badge>
                            <span className="font-semibold">{trade.token}</span>
                            <span className="text-muted-foreground">{trade.amount}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {trade.participants} participants • {trade.timestamp}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-semibold ${trade.profit.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.profit}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">{trade.status}</p>
                        </div>
                        
                        {trade.status === 'success' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleDistributeProfits(trade.id)}
                            disabled={isLoading}
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Distribute
                          </Button>
                        )}
                        
                        <Select>
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="•••" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="details">View Details</SelectItem>
                            <SelectItem value="participants">Participants</SelectItem>
                            <SelectItem value="logs">View Logs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="distribution">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Profit Distributions</h2>
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>

            <div className="space-y-3">
              {distributions.map((dist) => (
                <Card key={dist.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(dist.status)}`} />
                        <div>
                          <p className="font-semibold">
                            Distribution #{dist.id.slice(-4)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {dist.participantCount} participants • {dist.timestamp}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold">{dist.totalProfit} total</p>
                        <p className="text-sm text-green-600">{dist.distributedAmount} distributed</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {dist.status === 'completed' ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : dist.status === 'pending' ? (
                          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
