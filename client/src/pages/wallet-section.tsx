import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Wallet, Code, Link2, FileText, Shield, Zap, Globe, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WalletSection() {
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopy = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    toast({
      title: "Copied!",
      description: `${item} copied to clipboard`,
    });
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const walletFeatures = [
    { icon: Shield, title: "Multi-Chain Support", description: "XRP, ETH, SOL, BNB, BTC and more" },
    { icon: Zap, title: "Instant Bridge", description: "Cross-chain swaps in seconds" },
    { icon: Globe, title: "WalletConnect v2", description: "Universal wallet protocol" },
    { icon: Link2, title: "Deep Links", description: "Direct app integration" },
  ];

  const deepLinks = [
    { 
      action: "Connect Wallet", 
      link: "riddlewallet://connect",
      description: "Open wallet connection flow"
    },
    { 
      action: "Bridge Tokens", 
      link: "riddlewallet://bridge?from=xrp&to=eth&amount=100",
      description: "Start bridge with parameters"
    },
    { 
      action: "Sign Transaction", 
      link: "riddlewallet://sign?tx={transaction_data}",
      description: "Request transaction signature"
    },
    { 
      action: "Sign NFT", 
      link: "riddlewallet://sign-nft?collection={address}&token={id}",
      description: "Sign NFT operations"
    },
  ];

  const apiEndpoints = [
    {
      method: "POST",
      endpoint: "/api/wallet/connect",
      description: "Initialize wallet connection",
      body: '{ "chain": "xrp", "provider": "walletconnect" }'
    },
    {
      method: "POST",
      endpoint: "/api/bridge/initiate",
      description: "Start bridge transaction",
      body: '{ "from": "xrp", "to": "eth", "amount": "100", "token": "RDL" }'
    },
    {
      method: "POST",
      endpoint: "/api/wallet/sign",
      description: "Request transaction signature",
      body: '{ "transaction": {...}, "type": "token" }'
    },
    {
      method: "POST",
      endpoint: "/api/wallet/sign-nft",
      description: "Sign NFT transaction",
      body: '{ "collection": "0x...", "tokenId": "1", "action": "transfer" }'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Riddle Wallet
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Universal Multi-Chain Wallet with WalletConnect Integration
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {walletFeatures.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-blue-500 transition-colors">
              <CardContent className="p-6">
                <feature.icon className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* WalletConnect Integration */}
        <Card className="mb-12 border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              WalletConnect Integration
            </CardTitle>
            <CardDescription>
              Connect Riddle Wallet to any dApp using WalletConnect v2 protocol
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm font-mono mb-2">WalletConnect Project ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded">
                    riddle-wallet-v2-4f8b9c2d
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy('riddle-wallet-v2-4f8b9c2d', 'Project ID')}
                  >
                    {copiedItem === 'Project ID' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button className="w-full" variant="default">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Register on WalletConnect
                </Button>
                <Button className="w-full" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  View Integration Guide
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Developer Tools Tabs */}
        <Tabs defaultValue="deeplinks" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deeplinks">Deep Links</TabsTrigger>
            <TabsTrigger value="api">API Endpoints</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
          </TabsList>

          {/* Deep Links Tab */}
          <TabsContent value="deeplinks">
            <Card>
              <CardHeader>
                <CardTitle>Deep Link Integration</CardTitle>
                <CardDescription>
                  Use these deep links to integrate Riddle Wallet into your application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deepLinks.map((link, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{link.action}</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(link.link, link.action)}
                        >
                          {copiedItem === link.action ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <code className="text-sm bg-gray-100 dark:bg-gray-900 p-2 rounded block mb-2">
                        {link.link}
                      </code>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>Bridge API Endpoints</CardTitle>
                <CardDescription>
                  RESTful API for wallet and bridge operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {apiEndpoints.map((endpoint, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={endpoint.method === 'POST' ? 'default' : 'secondary'}>
                          {endpoint.method}
                        </Badge>
                        <code className="font-mono text-sm">{endpoint.endpoint}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(`${endpoint.method} ${endpoint.endpoint}`, `API ${index}`)}
                        >
                          {copiedItem === `API ${index}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{endpoint.description}</p>
                      <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
                        <pre className="text-xs overflow-x-auto">{endpoint.body}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardTitle>Comprehensive Documentation</CardTitle>
                <CardDescription>
                  Complete guide for token and NFT signing capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Token Signing Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      Token Signing
                    </h3>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                      <Badge className="mb-2" variant="outline">Coming Soon</Badge>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Advanced token signing features are currently in development. Full documentation will be available upon release.
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p>• Support for ERC-20, SPL, and XRP tokens</p>
                      <p>• Batch transaction signing</p>
                      <p>• Hardware wallet integration</p>
                      <p>• Multi-signature support</p>
                    </div>
                  </div>

                  {/* NFT Signing Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      NFT Signing
                    </h3>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                      <Badge className="mb-2" variant="outline">Coming Soon</Badge>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        NFT signing and verification features are under active development. Documentation will be published soon.
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p>• ERC-721 and ERC-1155 support</p>
                      <p>• Metaplex NFT standard (Solana)</p>
                      <p>• XLS-20 NFT standard (XRPL)</p>
                      <p>• Cross-chain NFT bridging</p>
                    </div>
                  </div>

                  {/* Integration Examples */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Integration Examples</h3>
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                      <pre className="text-xs overflow-x-auto">
{`// Connect to Riddle Wallet
const wallet = await RiddleWallet.connect({
  chains: ['xrp', 'eth', 'sol'],
  features: ['bridge', 'sign', 'nft']
});

// Sign a token transaction
const signature = await wallet.signTransaction({
  type: 'token',
  chain: 'eth',
  data: transactionData
});

// Bridge tokens
const bridgeTx = await wallet.bridge({
  from: 'xrp',
  to: 'eth',
  token: 'RDL',
  amount: '100'
});`}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
