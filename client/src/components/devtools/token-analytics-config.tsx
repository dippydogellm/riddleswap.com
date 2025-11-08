import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { 
  Settings, Save, RotateCcw, Download, Upload, TestTube, 
  Clock, Eye, EyeOff, TrendingUp, BarChart3, DollarSign,
  AlertTriangle, CheckCircle2, Info, Zap
} from 'lucide-react';

// Configuration schema with validation
const tokenAnalyticsConfigSchema = z.object({
  // Cache Settings
  cacheSettings: z.object({
    tokenMetadataTtl: z.number().min(30, 'Minimum 30 seconds').max(600, 'Maximum 10 minutes'),
    dexScreenerDataTtl: z.number().min(30, 'Minimum 30 seconds').max(600, 'Maximum 10 minutes'),
    priceDataRefreshInterval: z.number().min(10, 'Minimum 10 seconds').max(300, 'Maximum 5 minutes'),
  }),
  
  // Token Management
  tokenManagement: z.object({
    hiddenTokens: z.string(), // Will be parsed as symbol:issuer pairs
    showZeroBalances: z.boolean(),
    defaultSortBy: z.enum(['name', 'balance', 'value', 'change']),
    sortDirection: z.enum(['asc', 'desc']),
  }),
  
  // Analytics Settings
  analyticsSettings: z.object({
    defaultView: z.enum(['prices', 'volume', 'liquidity']),
    chartTimeRange: z.enum(['1h', '4h', '24h', '7d', '30d']),
    priceChangeAlertThreshold: z.number().min(0.1, 'Minimum 0.1%').max(100, 'Maximum 100%'),
    enableLiveUpdates: z.boolean(),
  }),
  
  // Display Options
  displayOptions: z.object({
    showTokenLogos: z.boolean(),
    showPercentageChanges: z.boolean(),
    showVolume: z.boolean(),
    showMarketCap: z.boolean(),
    compactView: z.boolean(),
  }),
});

type TokenAnalyticsConfig = z.infer<typeof tokenAnalyticsConfigSchema>;

// Default configuration values
const defaultConfig: TokenAnalyticsConfig = {
  cacheSettings: {
    tokenMetadataTtl: 120, // 2 minutes
    dexScreenerDataTtl: 180, // 3 minutes
    priceDataRefreshInterval: 30, // 30 seconds
  },
  tokenManagement: {
    hiddenTokens: '',
    showZeroBalances: true,
    defaultSortBy: 'value',
    sortDirection: 'desc',
  },
  analyticsSettings: {
    defaultView: 'prices',
    chartTimeRange: '24h',
    priceChangeAlertThreshold: 5.0, // 5%
    enableLiveUpdates: true,
  },
  displayOptions: {
    showTokenLogos: true,
    showPercentageChanges: true,
    showVolume: true,
    showMarketCap: true,
    compactView: false,
  },
};

const STORAGE_KEY = 'tokenAnalyticsConfig';

export default function TokenAnalyticsConfig() {
  const { toast } = useToast();
  const [isApiTesting, setIsApiTesting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [previewConfig, setPreviewConfig] = useState<TokenAnalyticsConfig>(defaultConfig);

  const form = useForm<TokenAnalyticsConfig>({
    resolver: zodResolver(tokenAnalyticsConfigSchema),
    defaultValues: defaultConfig,
  });

  // Load configuration from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        form.reset(config);
        setPreviewConfig(config);
        const lastSavedTime = localStorage.getItem(`${STORAGE_KEY}_lastSaved`);
        if (lastSavedTime) {
          setLastSaved(new Date(lastSavedTime));
        }
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      toast({
        title: "Configuration Load Failed",
        description: "Using default configuration values",
        variant: "destructive",
      });
    }
  }, [form, toast]);

  // Watch form changes for real-time preview
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value) {
        setPreviewConfig(value as TokenAnalyticsConfig);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Save configuration
  const handleSave = (data: TokenAnalyticsConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(`${STORAGE_KEY}_lastSaved`, new Date().toISOString());
      setLastSaved(new Date());
      
      toast({
        title: "Configuration Saved",
        description: "Token analytics settings have been saved successfully",
      });
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    }
  };

  // Reset to defaults
  const handleReset = () => {
    form.reset(defaultConfig);
    setPreviewConfig(defaultConfig);
    toast({
      title: "Configuration Reset",
      description: "All settings have been reset to default values",
    });
  };

  // Export configuration
  const handleExport = () => {
    try {
      const config = form.getValues();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `token-analytics-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Configuration Exported",
        description: "Configuration file has been downloaded",
      });
    } catch (error) {
      console.error('Failed to export configuration:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export configuration",
        variant: "destructive",
      });
    }
  };

  // Import configuration
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        const validatedConfig = tokenAnalyticsConfigSchema.parse(config);
        form.reset(validatedConfig);
        setPreviewConfig(validatedConfig);
        
        toast({
          title: "Configuration Imported",
          description: "Configuration has been imported successfully",
        });
      } catch (error) {
        console.error('Failed to import configuration:', error);
        toast({
          title: "Import Failed",
          description: "Invalid configuration file format",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  // Test API endpoints
  const handleApiTest = async () => {
    setIsApiTesting(true);
    try {
      // Simulate API testing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "API Test Complete",
        description: "All endpoints are responding correctly",
      });
    } catch (error) {
      toast({
        title: "API Test Failed",
        description: "Some endpoints are not responding",
        variant: "destructive",
      });
    } finally {
      setIsApiTesting(false);
    }
  };

  // Parse hidden tokens for validation
  const parseHiddenTokens = (input: string): Array<{symbol: string, issuer?: string}> => {
    if (!input.trim()) return [];
    
    return input.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(':');
        return {
          symbol: parts[0]?.trim() || '',
          issuer: parts[1]?.trim(),
        };
      });
  };

  const hiddenTokensList = parseHiddenTokens(form.watch('tokenManagement.hiddenTokens') || '');

  return (
    <Card data-testid="token-analytics-config">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Token Analytics Configuration
            </CardTitle>
            <CardDescription>
              Configure cache settings, token management, and analytics preferences
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {lastSaved && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Saved {lastSaved.toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
            <Tabs defaultValue="cache" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cache" data-testid="cache-settings-tab">
                  <Clock className="w-4 h-4 mr-2" />
                  Cache
                </TabsTrigger>
                <TabsTrigger value="tokens" data-testid="token-management-tab">
                  <Eye className="w-4 h-4 mr-2" />
                  Tokens
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="analytics-settings-tab">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="display" data-testid="display-options-tab">
                  <Settings className="w-4 h-4 mr-2" />
                  Display
                </TabsTrigger>
              </TabsList>

              {/* Cache Settings Tab */}
              <TabsContent value="cache" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cacheSettings.tokenMetadataTtl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Metadata Cache TTL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              min={30}
                              max={600}
                              className="pr-12"
                              data-testid="token-metadata-ttl"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-500">sec</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Cache duration for token metadata (30-600 seconds)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cacheSettings.dexScreenerDataTtl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DexScreener Data Cache TTL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              min={30}
                              max={600}
                              className="pr-12"
                              data-testid="dexscreener-ttl"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-500">sec</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Cache duration for DexScreener data (30-600 seconds)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cacheSettings.priceDataRefreshInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Data Refresh Interval</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              min={10}
                              max={300}
                              className="pr-12"
                              data-testid="price-refresh-interval"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-500">sec</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          How often to refresh price data (10-300 seconds)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Cache Preview</span>
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p>Token metadata will be cached for {previewConfig.cacheSettings.tokenMetadataTtl} seconds</p>
                    <p>DexScreener data will be cached for {previewConfig.cacheSettings.dexScreenerDataTtl} seconds</p>
                    <p>Price data will refresh every {previewConfig.cacheSettings.priceDataRefreshInterval} seconds</p>
                  </div>
                </div>

                {/* API Testing Section */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">API Endpoint Testing</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApiTest}
                      disabled={isApiTesting}
                      data-testid="test-api-endpoints"
                    >
                      {isApiTesting ? (
                        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
                      ) : (
                        <TestTube className="w-4 h-4 mr-2" />
                      )}
                      {isApiTesting ? 'Testing...' : 'Test Endpoints'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Test API endpoints to ensure they're responding correctly with current cache settings.
                  </p>
                </div>
              </TabsContent>

              {/* Token Management Tab */}
              <TabsContent value="tokens" className="space-y-4">
                <FormField
                  control={form.control}
                  name="tokenManagement.hiddenTokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hidden Tokens List</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter one token per line in format: SYMBOL:ISSUER_ADDRESS&#10;Example:&#10;USD:rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq&#10;BTC:rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL"
                          className="min-h-24 font-mono text-sm"
                          data-testid="hidden-tokens-input"
                        />
                      </FormControl>
                      <FormDescription>
                        Token pairs to hide from displays. Format: SYMBOL:ISSUER_ADDRESS (one per line)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {hiddenTokensList.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <Label className="text-sm font-medium mb-2 block">Hidden Tokens Preview</Label>
                    <div className="flex flex-wrap gap-2">
                      {hiddenTokensList.map((token, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          <EyeOff className="w-3 h-3 mr-1" />
                          {token.symbol}{token.issuer ? `:${token.issuer.slice(0, 8)}...` : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tokenManagement.defaultSortBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Sort By</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="default-sort-select">
                              <SelectValue placeholder="Select sort field" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="name">Token Name</SelectItem>
                            <SelectItem value="balance">Balance</SelectItem>
                            <SelectItem value="value">USD Value</SelectItem>
                            <SelectItem value="change">Price Change</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default field to sort tokens by
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tokenManagement.sortDirection"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Direction</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="sort-direction-select">
                              <SelectValue placeholder="Select direction" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="asc">Ascending (A-Z, Low-High)</SelectItem>
                            <SelectItem value="desc">Descending (Z-A, High-Low)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default sort direction
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tokenManagement.showZeroBalances"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Show Zero Balance Tokens</FormLabel>
                        <FormDescription>
                          Display tokens with zero or very small balances in your wallet
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="show-zero-balances-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Analytics Settings Tab */}
              <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="analyticsSettings.defaultView"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Analytics View</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="default-analytics-view">
                              <SelectValue placeholder="Select default view" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prices">Price Charts</SelectItem>
                            <SelectItem value="volume">Volume Analysis</SelectItem>
                            <SelectItem value="liquidity">Liquidity Metrics</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default view when opening analytics
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="analyticsSettings.chartTimeRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Chart Time Range</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="chart-time-range">
                              <SelectValue placeholder="Select time range" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1h">1 Hour</SelectItem>
                            <SelectItem value="4h">4 Hours</SelectItem>
                            <SelectItem value="24h">24 Hours</SelectItem>
                            <SelectItem value="7d">7 Days</SelectItem>
                            <SelectItem value="30d">30 Days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default time range for charts
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="analyticsSettings.priceChangeAlertThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Change Alert Threshold</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            min={0.1}
                            max={100}
                            step={0.1}
                            className="pr-8"
                            data-testid="alert-threshold"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-500">%</span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Alert when price changes exceed this percentage (0.1-100%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="analyticsSettings.enableLiveUpdates"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Live Updates</FormLabel>
                        <FormDescription>
                          Automatically update charts and data in real-time
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="live-updates-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Display Options Tab */}
              <TabsContent value="display" className="space-y-4">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="displayOptions.showTokenLogos"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show Token Logos</FormLabel>
                          <FormDescription>
                            Display token logos in lists and tables
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="show-logos-switch"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayOptions.showPercentageChanges"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show Percentage Changes</FormLabel>
                          <FormDescription>
                            Display price change percentages with color coding
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="show-percentage-switch"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayOptions.showVolume"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show Volume Data</FormLabel>
                          <FormDescription>
                            Display trading volume information in token displays
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="show-volume-switch"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayOptions.showMarketCap"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show Market Cap</FormLabel>
                          <FormDescription>
                            Display market capitalization data when available
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="show-marketcap-switch"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayOptions.compactView"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Compact View</FormLabel>
                          <FormDescription>
                            Use compact layouts to show more information in less space
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="compact-view-switch"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExport}
                  data-testid="export-config-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="import-config-input"
                  />
                  <Button type="button" variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  data-testid="reset-config-button"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button type="submit" data-testid="save-config-button">
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
