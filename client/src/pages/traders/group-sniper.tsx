import React, { useState, useEffect } from 'react';
import { Target, Users, Zap, TrendingUp, Bell, Clock, Play, Pause, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NewToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  issuer: string;
  taxon: string;
  created: string;
  initialPrice: string;
  currentPrice: string;
  priceChange: string;
  volume24h: string;
  holders: number;
  liquidityLocked: boolean;
  verified: boolean;
  riskScore: number;
}

interface SniperGroup {
  id: string;
  name: string;
  description: string;
  members: number;
  leader: string;
  successRate: number;
  totalSnipes: number;
  avgReturn: string;
  minBuy: string;
  maxBuy: string;
  isPrivate: boolean;
  requirements: string[];
}

interface SniperAlert {
  id: string;
  token: NewToken;
  group: string;
  alertType: 'new_token' | 'price_threshold' | 'volume_spike' | 'group_action';
  message: string;
  timestamp: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export default function GroupSniperPage() {
  const [newTokens, setNewTokens] = useState<NewToken[]>([]);
  const [sniperGroups, setSniperGroups] = useState<SniperGroup[]>([]);
  const [alerts, setAlerts] = useState<SniperAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoSnipeEnabled, setAutoSnipeEnabled] = useState(false);
  const [snipeAmount, setSnipeAmount] = useState([100]);
  const [riskThreshold, setRiskThreshold] = useState([70]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const { toast } = useToast();

  // Mock new tokens data
  const mockNewTokens: NewToken[] = [
    {
      id: '1',
      name: 'RiddleMoon',
      symbol: 'RMOON',
      address: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      issuer: 'rMoonIssuer123...xyz',
      taxon: '12345',
      created: '2 minutes ago',
      initialPrice: '0.001',
      currentPrice: '0.0012',
      priceChange: '+20.0%',
      volume24h: '15,430',
      holders: 127,
      liquidityLocked: true,
      verified: false,
      riskScore: 25
    },
    {
      id: '2',
      name: 'XRP Gem',
      symbol: 'XGEM',
      address: 'rG7n7otQDd6FczFgLdSqtcsAUxDkw6fzGH',
      issuer: 'rGemIssuer456...abc',
      taxon: '67890',
      created: '5 minutes ago',
      initialPrice: '0.0001',
      currentPrice: '0.00008',
      priceChange: '-20.0%',
      volume24h: '8,920',
      holders: 89,
      liquidityLocked: false,
      verified: false,
      riskScore: 85
    }
  ];

  // Mock sniper groups
  const mockGroups: SniperGroup[] = [
    {
      id: 'alpha-hunters',
      name: 'Alpha Hunters',
      description: 'Elite XRPL token hunters with proven track record',
      members: 156,
      leader: 'XRPLKing',
      successRate: 73.2,
      totalSnipes: 847,
      avgReturn: '+142%',
      minBuy: '50',
      maxBuy: '1000',
      isPrivate: true,
      requirements: ['Minimum 10,000 RDL staked', 'Verified KYC']
    },
    {
      id: 'moon-squad',
      name: 'Moon Squad',
      description: 'Community-driven sniping group for new XRPL gems',
      members: 423,
      leader: 'MoonHunter',
      successRate: 58.7,
      totalSnipes: 1205,
      avgReturn: '+89%',
      minBuy: '10',
      maxBuy: '500',
      isPrivate: false,
      requirements: ['Minimum 100 RDL balance']
    }
  ];

  // Mock alerts
  const mockAlerts: SniperAlert[] = [
    {
      id: '1',
      token: mockNewTokens[0],
      group: 'Alpha Hunters',
      alertType: 'new_token',
      message: 'New token RMOON detected with high potential',
      timestamp: '2 minutes ago',
      urgency: 'high'
    },
    {
      id: '2',
      token: mockNewTokens[1],
      group: 'Moon Squad',
      alertType: 'group_action',
      message: 'Group leader initiated buy signal for XGEM',
      timestamp: '5 minutes ago',
      urgency: 'critical'
    }
  ];

  useEffect(() => {
    setNewTokens(mockNewTokens);
    setSniperGroups(mockGroups);
    setAlerts(mockAlerts);
  }, []);

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
    toast({
      title: "Monitoring Started",
      description: "Now monitoring XRPL for new token launches"
    });

    // Simulate new token alerts
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newAlert: SniperAlert = {
          id: Date.now().toString(),
          token: {
            ...mockNewTokens[0],
            id: Date.now().toString(),
            symbol: `TOKEN${Math.floor(Math.random() * 1000)}`,
            created: 'Just now'
          },
          group: 'Alpha Hunters',
          alertType: 'new_token',
          message: 'New token detected - analyzing...',
          timestamp: 'Just now',
          urgency: Math.random() > 0.5 ? 'high' : 'medium'
        };
        
        setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
        
        toast({
          title: "New Token Detected",
          description: `${newAlert.token.symbol} just launched on XRPL`
        });
      }
    }, 30000); // Alert every 30 seconds

    return () => clearInterval(interval);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    toast({
      title: "Monitoring Stopped",
      description: "Token monitoring has been disabled"
    });
  };

  const handleSnipeToken = async (token: NewToken) => {
    try {
      toast({
        title: "Snipe Initiated",
        description: `Attempting to buy ${token.symbol} for $${snipeAmount[0]}`
      });

      // Redirect to XRPL swap with pre-filled data
      localStorage.setItem('sniperData', JSON.stringify({
        tokenAddress: token.address,
        amount: snipeAmount[0],
        slippage: 5, // Higher slippage for sniping
        priority: 'high'
      }));
      
      window.location.href = '/xrpl-swap';
      
    } catch (error) {
      toast({
        title: "Snipe Failed",
        description: "Failed to execute snipe order",
        variant: "destructive"
      });
    }
  };

  const handleJoinGroup = (groupId: string) => {
    const group = sniperGroups.find(g => g.id === groupId);
    if (group) {
      toast({
        title: "Join Request Sent",
        description: `Request to join ${group.name} has been sent`
      });
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-600 bg-green-100';
    if (score < 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">XRPL Group Sniper</h1>
            <p className="text-muted-foreground">Coordinate with groups to snipe new XRPL tokens at launch</p>
          </div>
        </div>

        {/* Control Panel */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Sniper Control Panel</span>
              <div className="flex items-center gap-2">
                {isMonitoring ? (
                  <Button variant="destructive" onClick={handleStopMonitoring}>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop Monitoring
                  </Button>
                ) : (
                  <Button onClick={handleStartMonitoring}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Monitoring
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium">Snipe Amount: $${snipeAmount[0]}</label>
                <Slider
                  value={snipeAmount}
                  onValueChange={setSnipeAmount}
                  max={1000}
                  min={10}
                  step={10}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Risk Threshold: {riskThreshold[0]}%</label>
                <Slider
                  value={riskThreshold}
                  onValueChange={setRiskThreshold}
                  max={100}
                  min={0}
                  step={5}
                  className="mt-2"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Snipe</p>
                  <p className="text-sm text-muted-foreground">Automatically execute group signals</p>
                </div>
                <Switch
                  checked={autoSnipeEnabled}
                  onCheckedChange={setAutoSnipeEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="new-tokens" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="new-tokens">New Tokens</TabsTrigger>
          <TabsTrigger value="groups">Sniper Groups</TabsTrigger>
          <TabsTrigger value="alerts">Live Alerts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="new-tokens">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Recent Token Launches</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}
                </span>
              </div>
            </div>

            {newTokens.map((token) => (
              <Card key={token.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {token.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{token.name}</h3>
                        <p className="text-sm text-muted-foreground">{token.symbol}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{token.created}</Badge>
                          {token.verified && <Badge className="bg-green-500">Verified</Badge>}
                          {token.liquidityLocked && <Badge className="bg-blue-500">Liquidity Locked</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-semibold">${token.currentPrice}</p>
                        <p className={`text-sm ${
                          token.priceChange.startsWith('+') ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {token.priceChange}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Volume</p>
                        <p className="font-semibold">${token.volume24h}</p>
                        <p className="text-sm text-muted-foreground">{token.holders} holders</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getRiskColor(token.riskScore)}>
                        Risk: {token.riskScore}%
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleSnipeToken(token)}
                        disabled={token.riskScore > riskThreshold[0]}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Snipe Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {newTokens.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold">No New Tokens</h3>
                  <p className="text-sm text-muted-foreground">Start monitoring to detect new XRPL token launches</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Sniper Groups</h2>
            
            {sniperGroups.map((group) => (
              <Card key={group.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{group.name}</h3>
                          {group.isPrivate && <Badge variant="secondary">Private</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">Led by {group.leader}</p>
                        <p className="text-sm mt-2 max-w-md">{group.description}</p>
                        
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground">Requirements:</p>
                          <ul className="text-xs text-muted-foreground">
                            {group.requirements.map((req, index) => (
                              <li key={index}>• {req}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-2xl font-bold text-green-600">{group.successRate}%</p>
                          <p className="text-xs text-muted-foreground">Success Rate</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{group.avgReturn}</p>
                          <p className="text-xs text-muted-foreground">Avg Return</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{group.members}</p>
                          <p className="text-xs text-muted-foreground">Members</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{group.totalSnipes}</p>
                          <p className="text-xs text-muted-foreground">Total Snipes</p>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleJoinGroup(group.id)}
                      >
                        {group.isPrivate ? 'Request to Join' : 'Join Group'}
                      </Button>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Buy Range: ${group.minBuy} - ${group.maxBuy}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Live Alerts</h2>
            
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${getUrgencyColor(alert.urgency)}`} />
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.token.symbol} • Group: {alert.group}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      View Token
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {alerts.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold">No Active Alerts</h3>
                  <p className="text-sm text-muted-foreground">Alerts will appear here when monitoring is active</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sniper Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Default Group</label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select preferred group" />
                    </SelectTrigger>
                    <SelectContent>
                      {sniperGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Max Daily Snipes</label>
                  <Input placeholder="10" />
                </div>

                <div>
                  <label className="text-sm font-medium">Stop Loss %</label>
                  <Input placeholder="20" />
                </div>

                <div>
                  <label className="text-sm font-medium">Take Profit %</label>
                  <Input placeholder="100" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">New Token Alerts</p>
                    <p className="text-sm text-muted-foreground">Get notified of new XRPL tokens</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Group Signals</p>
                    <p className="text-sm text-muted-foreground">Receive group buy/sell signals</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Price Alerts</p>
                    <p className="text-sm text-muted-foreground">Price threshold notifications</p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Volume Spikes</p>
                    <p className="text-sm text-muted-foreground">Unusual volume activity alerts</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
