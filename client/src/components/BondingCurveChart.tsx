import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ComposedChart, 
  Line, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ScatterChart,
  Scatter
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity, 
  DollarSign, 
  Users,
  Clock,
  Target,
  Zap,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PriceDataPoint {
  id: string;
  timestamp: string;
  tokenPrice: string;
  marketCap: string;
  totalInvested: string;
  tokensCirculating: string;
  volume?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
}

interface LaunchMetrics {
  currentPrice: string;
  priceChange24h: string;
  marketCap: string;
  volume24h: string;
  totalRaised: string;
  participantCount: number;
  progressToGoal: string;
  avgContributionSize: string;
  nftHolderPercentage: string;
}

interface BondingCurveChartProps {
  launchId: number;
  tokenSymbol: string;
  fundingGoal: string;
  useBondingCurve: boolean;
  height?: number;
  showFullControls?: boolean;
  onLaunchClick?: () => void;
}

// Custom tooltip for chart data
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const price = parseFloat(data.tokenPrice || data.close || '0');
  const volume = parseFloat(data.volume || '0');
  const marketCap = parseFloat(data.marketCap || '0');

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-3 min-w-48">
      <p className="font-medium text-sm mb-2">
        {new Date(label).toLocaleString()}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Price:</span>
          <span className="font-mono">${price.toFixed(6)} XRP</span>
        </div>
        {data.open && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Open:</span>
              <span className="font-mono">${parseFloat(data.open).toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">High:</span>
              <span className="font-mono text-green-600">${parseFloat(data.high).toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Low:</span>
              <span className="font-mono text-red-600">${parseFloat(data.low).toFixed(6)}</span>
            </div>
          </>
        )}
        {volume > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Volume:</span>
            <span className="font-mono">{volume.toFixed(2)} XRP</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Market Cap:</span>
          <span className="font-mono">${marketCap.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// Candlestick component for OHLC data
function CandlestickBar({ payload, x, y, width, height }: any) {
  if (!payload.open || !payload.high || !payload.low || !payload.close) {
    return null;
  }

  const { open, high, low, close } = payload;
  const isUpward = close >= open;
  const color = isUpward ? '#10b981' : '#ef4444';
  const bodyHeight = Math.abs(close - open) * height;
  const bodyY = y + (isUpward ? (high - close) * height : (high - open) * height);
  
  return (
    <g>
      {/* Wick */}
      <line
        x1={x + width / 2}
        y1={y}
        x2={x + width / 2}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + width * 0.2}
        y={bodyY}
        width={width * 0.6}
        height={bodyHeight}
        fill={isUpward ? color : 'white'}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
}

export default function BondingCurveChart({ 
  launchId, 
  tokenSymbol, 
  fundingGoal, 
  useBondingCurve, 
  height = 400,
  showFullControls = true,
  onLaunchClick 
}: BondingCurveChartProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | 'all'>('24h');
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'volume'>('line');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number>(0);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch price history data with enhanced error handling and status tracking
  const { data: priceHistory, isLoading: priceLoading, refetch: refetchPrice, error: priceError } = useQuery({
    queryKey: ['launchpad-price-history', launchId, timeRange],
    queryFn: async () => {
      setConnectionStatus('connecting');
      try {
        const response = await apiRequest(`/api/launchpad/price-history/${launchId}?range=${timeRange}&format=candlestick`);
        if (!response.ok) throw new Error('Failed to fetch price history');
        const data = await response.json() as PriceDataPoint[];
        setConnectionStatus('connected');
        setLastUpdateTime(new Date());
        return data;
      } catch (error) {
        setConnectionStatus('disconnected');
        throw error;
      }
    },
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds if auto-refresh is on
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch current metrics with enhanced status tracking
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['launchpad-metrics', launchId],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/launchpad/metrics/${launchId}`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json() as LaunchMetrics;
        return data;
      } catch (error) {
        console.error('Metrics fetch error:', error);
        throw error;
      }
    },
    refetchInterval: autoRefresh ? 15000 : false, // Refresh every 15 seconds
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: 5000,
  });

  // Monitor price changes and show notifications
  useEffect(() => {
    if (!priceHistory || priceHistory.length === 0) return;
    
    const currentPrice = parseFloat(priceHistory[priceHistory.length - 1]?.tokenPrice || '0');
    
    if (previousPrice > 0 && currentPrice !== previousPrice) {
      const change = currentPrice - previousPrice;
      const percentChange = ((change / previousPrice) * 100);
      
      if (Math.abs(percentChange) > 1) { // Only notify for changes > 1%
        toast({
          title: `${tokenSymbol} Price Update`,
          description: `Price ${change > 0 ? 'increased' : 'decreased'} to $${currentPrice.toFixed(6)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`,
          duration: 3000,
        });
      }
    }
    
    if (currentPrice > 0) {
      setPreviousPrice(currentPrice);
    }
  }, [priceHistory, previousPrice, tokenSymbol, toast]);

  // Handle connection errors
  useEffect(() => {
    if (priceError || metricsError) {
      setConnectionStatus('disconnected');
    }
  }, [priceError, metricsError]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    setConnectionStatus('connecting');
    try {
      await Promise.all([refetchPrice(), queryClient.invalidateQueries({ queryKey: ['launchpad-metrics', launchId] })]);
      setLastUpdateTime(new Date());
      toast({
        title: 'Data refreshed',
        description: 'Chart data has been updated successfully',
        duration: 2000,
      });
    } catch (error) {
      setConnectionStatus('disconnected');
      toast({
        title: 'Refresh failed',
        description: 'Failed to update chart data. Please try again.',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  // Process chart data
  const chartData = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];

    return priceHistory.map((point, index) => {
      const timestamp = new Date(point.timestamp).getTime();
      const price = parseFloat(point.tokenPrice);
      const volume = point.volume ? parseFloat(point.volume) : 0;
      const marketCap = parseFloat(point.marketCap);

      // For candlestick data, we need to group by time periods
      const prevPoint = index > 0 ? priceHistory[index - 1] : point;
      const nextPoint = index < priceHistory.length - 1 ? priceHistory[index + 1] : point;

      return {
        timestamp,
        time: new Date(point.timestamp).toLocaleTimeString(),
        price,
        volume,
        marketCap,
        // Candlestick OHLC data (simulated from price progression)
        open: parseFloat(prevPoint.tokenPrice),
        high: Math.max(price, parseFloat(prevPoint.tokenPrice)),
        low: Math.min(price, parseFloat(prevPoint.tokenPrice)),
        close: price,
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [priceHistory]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (!chartData || chartData.length < 2) return { value: 0, percentage: 0 };
    
    const current = chartData[chartData.length - 1]?.price || 0;
    const previous = chartData[chartData.length - 2]?.price || 0;
    const change = current - previous;
    const percentage = previous > 0 ? (change / previous) * 100 : 0;
    
    return { value: change, percentage };
  }, [chartData]);

  // Calculate funding progress
  const fundingProgress = useMemo(() => {
    if (!metrics) return 0;
    const raised = parseFloat(metrics.totalRaised);
    const goal = parseFloat(fundingGoal);
    return goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
  }, [metrics, fundingGoal]);

  if (priceLoading || !chartData.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {tokenSymbol} Price Chart
            {priceLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            {priceLoading ? 'Loading chart data...' : 'No price data available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPrice = chartData[chartData.length - 1]?.price || 0;
  const isPositive = priceChange.percentage >= 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {tokenSymbol} Price Chart
              {priceLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>}
            </CardTitle>
            {useBondingCurve && (
              <Badge variant="outline" className="text-purple-600 border-purple-300">
                <Zap className="h-3 w-3 mr-1" />
                Bonding Curve
              </Badge>
            )}
            {/* Connection Status Indicator */}
            <Badge 
              variant="outline" 
              className={`text-xs ${
                connectionStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-300' :
                connectionStatus === 'connecting' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                'bg-red-50 text-red-700 border-red-300'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <><Wifi className="h-3 w-3 mr-1" />Live</>
              ) : connectionStatus === 'connecting' ? (
                <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Updating</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" />Offline</>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdateTime && (
              <span className="text-xs text-gray-500">
                Updated {lastUpdateTime.toLocaleTimeString()}
              </span>
            )}
            {onLaunchClick && (
              <Button variant="outline" size="sm" onClick={onLaunchClick}>
                View Details
              </Button>
            )}
          </div>
        </div>
        
        {/* Current Price and Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Price</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold">${currentPrice.toFixed(6)}</p>
              <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="text-sm font-medium">
                  {isPositive ? '+' : ''}{priceChange.percentage.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          
          {metrics && (
            <>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Market Cap</p>
                <p className="text-lg font-bold">${parseFloat(metrics.marketCap).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">24h Volume</p>
                <p className="text-lg font-bold">{parseFloat(metrics.volume24h).toFixed(2)} XRP</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Progress</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{fundingProgress.toFixed(1)}%</p>
                  <Target className="h-4 w-4 text-blue-500" />
                </div>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {showFullControls && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between">
              <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
                <TabsList className="grid grid-cols-5 w-fit">
                  <TabsTrigger value="1h">1H</TabsTrigger>
                  <TabsTrigger value="6h">6H</TabsTrigger>
                  <TabsTrigger value="24h">24H</TabsTrigger>
                  <TabsTrigger value="7d">7D</TabsTrigger>
                  <TabsTrigger value="all">ALL</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <Tabs value={chartType} onValueChange={(value) => setChartType(value as any)}>
                  <TabsList className="grid grid-cols-3 w-fit">
                    <TabsTrigger value="line">Line</TabsTrigger>
                    <TabsTrigger value="candlestick">Candles</TabsTrigger>
                    <TabsTrigger value="volume">Volume</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={autoRefresh ? 'bg-green-50 border-green-300 text-green-700' : ''}
                  data-testid="button-auto-refresh"
                >
                  <Activity className="h-4 w-4 mr-1" />
                  {autoRefresh ? 'Live' : 'Paused'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={connectionStatus === 'connecting'}
                  data-testid="button-manual-refresh"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          <ResponsiveContainer width="100%" height={height}>
            {chartType === 'volume' ? (
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  fontSize={12}
                  domain={['dataMin * 0.95', 'dataMax * 1.05']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="volume" 
                  fill="#3b82f6" 
                  opacity={0.7}
                  name="Volume (XRP)"
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                  name="Price"
                  yAxisId="right"
                />
                <YAxis yAxisId="right" orientation="right" fontSize={12} />
              </ComposedChart>
            ) : chartType === 'candlestick' ? (
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  fontSize={12}
                  domain={['dataMin * 0.95', 'dataMax * 1.05']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="price"
                  shape={<CandlestickBar />}
                  isAnimationActive={false}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  fontSize={12}
                  domain={['dataMin * 0.95', 'dataMax * 1.05']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
                  name="Token Price"
                />
                {/* Reference line for funding goal if relevant */}
                {useBondingCurve && (
                  <ReferenceLine 
                    y={parseFloat(fundingGoal) / 1000} // Approximation for goal price
                    stroke="#ff6b6b" 
                    strokeDasharray="5 5"
                    label="Launch Goal"
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Additional metrics */}
        {metrics && showFullControls && (
          <div className="px-6 pb-4 border-t bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Contributors</p>
                  <p className="font-medium">{metrics.participantCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Avg. Contribution</p>
                  <p className="font-medium">{parseFloat(metrics.avgContributionSize).toFixed(2)} XRP</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400">NFT Holders</p>
                  <p className="font-medium">{parseFloat(metrics.nftHolderPercentage).toFixed(1)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Raised</p>
                  <p className="font-medium">{parseFloat(metrics.totalRaised).toFixed(2)} XRP</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
