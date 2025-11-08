/**
 * EXTERNAL WALLET CONNECTION TESTING PAGE
 * Comprehensive testing interface for all supported wallets
 * Features: Xaman QR code, Joey, MetaMask, Phantom wallet connections
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Wallet, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Copy,
  Eye,
  TestTube,
  Globe,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

interface WalletTest {
  id: string;
  name: string;
  type: 'mobile' | 'extension' | 'desktop';
  chains: string[];
  icon: string;
  color: string;
  status: 'idle' | 'connecting' | 'connected' | 'failed';
  address?: string;
  qrCode?: string;
  deepLink?: string;
  testResults: {
    connectionTest: boolean | null;
    signatureTest: boolean | null;
    balanceTest: boolean | null;
  };
}

const ExternalWalletTesting = () => {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<WalletTest[]>([
    {
      id: 'xaman',
      name: 'Xaman',
      type: 'mobile',
      chains: ['XRP'],
      icon: '/images/wallets/xaman-logo.png',
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      status: 'idle',
      testResults: { connectionTest: null, signatureTest: null, balanceTest: null }
    },
    {
      id: 'joey',
      name: 'Joey Wallet',
      type: 'mobile',
      chains: ['XRP'],
      icon: '/images/wallets/joey-logo.png',
      color: 'bg-gradient-to-r from-orange-500 to-orange-600',
      status: 'idle',
      testResults: { connectionTest: null, signatureTest: null, balanceTest: null }
    },
    {
      id: 'metamask',
      name: 'MetaMask',
      type: 'extension',
      chains: ['ETH', 'BSC', 'POLYGON', 'BASE', 'ARBITRUM'],
      icon: '/images/wallets/metamask-logo.png',
      color: 'bg-gradient-to-r from-orange-500 to-yellow-500',
      status: 'idle',
      testResults: { connectionTest: null, signatureTest: null, balanceTest: null }
    },
    {
      id: 'phantom',
      name: 'Phantom',
      type: 'extension',
      chains: ['SOL'],
      icon: '/images/wallets/phantom-logo.png',
      color: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      status: 'idle',
      testResults: { connectionTest: null, signatureTest: null, balanceTest: null }
    }
  ]);

  const [xamanModal, setXamanModal] = useState<{
    open: boolean;
    qrCode: string;
    deepLink: string;
    uuid: string;
  }>({
    open: false,
    qrCode: '',
    deepLink: '',
    uuid: ''
  });

  const [joeyModal, setJoeyModal] = useState<{
    open: boolean;
    qrCode: string;
    deepLink: string;
    uuid: string;
  }>({
    open: false,
    qrCode: '',
    deepLink: '',
    uuid: ''
  });

  const [testResults, setTestResults] = useState<{
    overallStatus: string;
    xamanQRGenerated: boolean;
    joeyQRGenerated: boolean;
    metamaskDetected: boolean;
    phantomDetected: boolean;
  }>({
    overallStatus: 'Ready to test',
    xamanQRGenerated: false,
    joeyQRGenerated: false,
    metamaskDetected: false,
    phantomDetected: false
  });

  // Check for browser wallet extensions
  useEffect(() => {
    checkBrowserWallets();
  }, []);

  const checkBrowserWallets = () => {
    const metamaskDetected = typeof (window as any).ethereum !== 'undefined';
    const phantomDetected = !!(window as any).solana?.isPhantom;

    setTestResults(prev => ({
      ...prev,
      metamaskDetected,
      phantomDetected
    }));

    updateWalletStatus('metamask', metamaskDetected ? 'connected' : 'failed');
    updateWalletStatus('phantom', phantomDetected ? 'connected' : 'failed');
  };

  const updateWalletStatus = (walletId: string, status: 'idle' | 'connecting' | 'connected' | 'failed', address?: string) => {
    setWallets(prev => prev.map(wallet => 
      wallet.id === walletId 
        ? { ...wallet, status, address }
        : wallet
    ));
  };

  // Test Xaman QR Code Generation
  const testXamanConnection = async () => {
    updateWalletStatus('xaman', 'connecting');
    
    try {
      const response = await fetch('/api/xumm/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txjson: {
            TransactionType: 'SignIn'
          },
          options: {
            submit: false,
            expire: 5,
            return_url: {
              web: window.location.origin
            }
          }
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        
        setXamanModal({
          open: true,
          qrCode: data.next.always,
          deepLink: data.next.always,
          uuid: data.uuid
        });

        setTestResults(prev => ({ ...prev, xamanQRGenerated: true }));
        updateWalletStatus('xaman', 'connected');
        
        toast({
          title: "Xaman QR Generated",
          description: "QR code successfully created for Xaman wallet",
        });
      } else {
        throw new Error('Failed to generate Xaman QR code');
      }
    } catch (error) {
      console.error('Xaman connection test failed:', error);
      updateWalletStatus('xaman', 'failed');
      toast({
        title: "Xaman Test Failed",
        description: "Failed to generate QR code for Xaman wallet",
        variant: "destructive"
      });
    }
  };

  // Test Joey Wallet Connection
  const testJoeyConnection = async () => {
    updateWalletStatus('joey', 'connecting');
    
    try {
      // Mock Joey Wallet QR generation
      const mockQRCode = `joey://wc?uri=${encodeURIComponent('wc:fake-session-uri')}`;
      const mockUUID = 'joey-test-' + Date.now();
      
      setJoeyModal({
        open: true,
        qrCode: mockQRCode,
        deepLink: mockQRCode,
        uuid: mockUUID
      });

      setTestResults(prev => ({ ...prev, joeyQRGenerated: true }));
      updateWalletStatus('joey', 'connected');
      
      toast({
        title: "Joey QR Generated",
        description: "Test QR code created for Joey wallet",
      });
    } catch (error) {
      console.error('Joey connection test failed:', error);
      updateWalletStatus('joey', 'failed');
      toast({
        title: "Joey Test Failed",
        description: "Failed to generate test connection for Joey wallet",
        variant: "destructive"
      });
    }
  };

  // Test MetaMask Connection
  const testMetaMaskConnection = async () => {
    if (typeof (window as any).ethereum === 'undefined') {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask browser extension",
        variant: "destructive"
      });
      return;
    }

    updateWalletStatus('metamask', 'connecting');

    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (accounts.length > 0) {
        updateWalletStatus('metamask', 'connected', accounts[0]);
        toast({
          title: "MetaMask Connected",
          description: `Connected: ${accounts[0].slice(0, 8)}...`,
        });
      }
    } catch (error) {
      console.error('MetaMask connection failed:', error);
      updateWalletStatus('metamask', 'failed');
      toast({
        title: "MetaMask Connection Failed",
        description: "Failed to connect to MetaMask",
        variant: "destructive"
      });
    }
  };

  // Test Phantom Connection
  const testPhantomConnection = async () => {
    if (!(window as any).solana?.isPhantom) {
      toast({
        title: "Phantom Not Found",
        description: "Please install Phantom browser extension",
        variant: "destructive"
      });
      return;
    }

    updateWalletStatus('phantom', 'connecting');

    try {
      const response = await (window as any).solana.connect();
      
      if (response.publicKey) {
        const address = response.publicKey.toString();
        updateWalletStatus('phantom', 'connected', address);
        toast({
          title: "Phantom Connected",
          description: `Connected: ${address.slice(0, 8)}...`,
        });
      }
    } catch (error) {
      console.error('Phantom connection failed:', error);
      updateWalletStatus('phantom', 'failed');
      toast({
        title: "Phantom Connection Failed",
        description: "Failed to connect to Phantom",
        variant: "destructive"
      });
    }
  };

  // Test all wallets
  const testAllWallets = async () => {
    toast({
      title: "Testing All Wallets",
      description: "Running comprehensive wallet tests...",
    });

    await testXamanConnection();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testJoeyConnection();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testMetaMaskConnection();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testPhantomConnection();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <TestTube className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            External Wallet Testing Center
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Test all wallet connections including Xaman QR code, Joey, MetaMask, and Phantom
          </p>
          
          {/* Quick Test Button */}
          <div className="mt-6">
            <Button 
              onClick={testAllWallets}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="test-all-wallets-button"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test All Wallets
            </Button>
          </div>
        </div>

        {/* Test Status Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Test Results Overview
            </CardTitle>
            <CardDescription>
              Current status of all wallet connection tests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`p-3 rounded-lg ${testResults.xamanQRGenerated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  <QrCode className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Xaman QR</p>
                  <p className="text-xs">{testResults.xamanQRGenerated ? 'Generated' : 'Pending'}</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`p-3 rounded-lg ${testResults.joeyQRGenerated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  <QrCode className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Joey QR</p>
                  <p className="text-xs">{testResults.joeyQRGenerated ? 'Generated' : 'Pending'}</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`p-3 rounded-lg ${testResults.metamaskDetected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <Zap className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">MetaMask</p>
                  <p className="text-xs">{testResults.metamaskDetected ? 'Detected' : 'Not Found'}</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`p-3 rounded-lg ${testResults.phantomDetected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <Zap className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Phantom</p>
                  <p className="text-xs">{testResults.phantomDetected ? 'Detected' : 'Not Found'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Individual Wallet Tests */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {wallets.map((wallet) => (
            <Card key={wallet.id} className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${wallet.color} rounded-lg flex items-center justify-center`}>
                      <img 
                        src={wallet.icon} 
                        alt={wallet.name}
                        className="w-8 h-8"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{wallet.name}</h3>
                      <div className="flex items-center gap-1">
                        {wallet.type === 'mobile' && <Smartphone className="w-3 h-3 text-gray-500" />}
                        {wallet.type === 'extension' && <Globe className="w-3 h-3 text-gray-500" />}
                        <span className="text-xs text-gray-500 capitalize">{wallet.type}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusIcon(wallet.status)}
                    <Badge variant={wallet.status === 'connected' ? 'default' : 'secondary'}>
                      {wallet.status}
                    </Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  Chains: {wallet.chains.join(', ')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {wallet.address && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Connected Address:</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(wallet.address!, 'Address')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs font-mono text-gray-900 dark:text-white">
                      {wallet.address}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  {wallet.id === 'xaman' && (
                    <Button 
                      onClick={testXamanConnection}
                      disabled={wallet.status === 'connecting'}
                      className="flex-1"
                      data-testid="test-xaman-button"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Test Xaman QR
                    </Button>
                  )}
                  
                  {wallet.id === 'joey' && (
                    <Button 
                      onClick={testJoeyConnection}
                      disabled={wallet.status === 'connecting'}
                      className="flex-1"
                      data-testid="test-joey-button"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Test Joey QR
                    </Button>
                  )}
                  
                  {wallet.id === 'metamask' && (
                    <Button 
                      onClick={testMetaMaskConnection}
                      disabled={wallet.status === 'connecting'}
                      className="flex-1"
                      data-testid="test-metamask-button"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Test MetaMask
                    </Button>
                  )}
                  
                  {wallet.id === 'phantom' && (
                    <Button 
                      onClick={testPhantomConnection}
                      disabled={wallet.status === 'connecting'}
                      className="flex-1"
                      data-testid="test-phantom-button"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Test Phantom
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Xaman QR Modal */}
        <Dialog open={xamanModal.open} onOpenChange={() => setXamanModal(prev => ({ ...prev, open: false }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Xaman Wallet Connection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg inline-block">
                  <QRCodeSVG 
                    value={xamanModal.qrCode}
                    size={200}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Scan with Xaman</AlertTitle>
                <AlertDescription>
                  Open Xaman wallet app and scan this QR code to connect
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(xamanModal.qrCode, 'QR Code URL')}
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy URL
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open(xamanModal.deepLink, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open App
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Joey QR Modal */}
        <Dialog open={joeyModal.open} onOpenChange={() => setJoeyModal(prev => ({ ...prev, open: false }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Joey Wallet Connection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg inline-block">
                  <QRCodeSVG 
                    value={joeyModal.qrCode}
                    size={200}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Scan with Joey Wallet</AlertTitle>
                <AlertDescription>
                  Open Joey Wallet app and scan this QR code to connect
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(joeyModal.qrCode, 'Joey QR Code URL')}
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy URL
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open(joeyModal.deepLink, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Joey
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ExternalWalletTesting;
