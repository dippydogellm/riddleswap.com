import React from 'react';
import { Link } from 'wouter';
import { useMetadata } from '@/hooks/use-metadata';
import { 
  ArrowRight, 
  Shield, 
  Zap, 
  Globe, 
  CheckCircle, 
  ArrowLeftRight,
  Clock,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  Coins,
  Network,
  TrendingUp,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const BridgeInfo = () => {
  // Set SEO metadata for Bridge Info page
  useMetadata();
  
  const supportedChains = [
    { name: 'XRPL', symbol: 'XRP', color: 'bg-blue-500', logo: '/images/chains/xrp-logo.svg' },
    { name: 'Ethereum', symbol: 'ETH', color: 'bg-gray-700', logo: '/images/chains/ethereum-logo.svg' },
    { name: 'Solana', symbol: 'SOL', color: 'bg-purple-500', logo: '/images/chains/solana-logo.png' },
    { name: 'BSC', symbol: 'BNB', color: 'bg-yellow-500', logo: '/images/chains/bnb-logo.svg' },
    { name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-600', logo: '/images/chains/polygon-logo.svg' },
    { name: 'Base', symbol: 'BASE', color: 'bg-blue-600', logo: '/images/chains/base-logo.svg' },
    { name: 'Bitcoin', symbol: 'BTC', color: 'bg-orange-500', logo: '/images/chains/bitcoin-logo.svg' }
  ];

  const bridgeFeatures = [
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Multi-signature validation and smart contract audits ensure maximum security for all bridge transactions.',
      color: 'text-green-600'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Cross-chain transfers completed in minutes, not hours. Optimized routing for maximum efficiency.',
      color: 'text-blue-600'
    },
    {
      icon: DollarSign,
      title: 'Low Fees',
      description: 'Competitive bridging fees with transparent pricing. No hidden costs or surprise charges.',
      color: 'text-purple-600'
    },
    {
      icon: Globe,
      title: 'Multi-Chain Support',
      description: 'Bridge assets across 7+ major blockchain networks with unified interface and experience.',
      color: 'text-orange-600'
    }
  ];

  const bridgeSteps = [
    {
      step: '1',
      title: 'Connect Wallet',
      description: 'Connect your source chain wallet containing the assets you want to bridge',
      icon: CheckCircle
    },
    {
      step: '2',
      title: 'Select Chains',
      description: 'Choose source and destination blockchains for your cross-chain transfer',
      icon: ArrowLeftRight
    },
    {
      step: '3',
      title: 'Enter Amount',
      description: 'Specify the amount of tokens you want to bridge to the destination chain',
      icon: Coins
    },
    {
      step: '4',
      title: 'Confirm & Bridge',
      description: 'Review transaction details and confirm to initiate the secure bridge transfer',
      icon: TrendingUp
    }
  ];

  // Real bridge statistics will be fetched from API when available

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative bg-white dark:bg-gray-900 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Cross-Chain Bridge
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
              RiddleSwap Bridge
            </h1>
            <p className="text-xl leading-8 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Seamlessly transfer your digital assets across multiple blockchain networks with 
              enterprise-grade security and lightning-fast execution.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/bridge">
                <Button size="lg" className="text-lg px-8 py-3">
                  Start Bridging <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/bridge-countdown">
                <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                  <ExternalLink className="mr-2 h-5 w-5" />
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* Supported Chains */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Supported Blockchain Networks
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Bridge your assets across the most popular and secure blockchain networks
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {supportedChains.map((chain, index) => (
              <div key={index} className="text-center">
                <div className={`w-16 h-16 ${chain.color} rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                  <img 
                    src={chain.logo} 
                    alt={chain.name} 
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="text-white font-bold text-sm">${chain.symbol}</span>`;
                      }
                    }}
                  />
                </div>
                <div className="font-semibold text-gray-900 dark:text-white text-sm">
                  {chain.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {chain.symbol}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose RiddleSwap Bridge?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Built with cutting-edge technology to provide the safest and most efficient cross-chain experience
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {bridgeFeatures.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <feature.icon className={`h-12 w-12 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              How Bridge Works
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Simple 4-step process to bridge your assets across different blockchain networks
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {bridgeSteps.map((step, index) => (
              <div key={index} className="text-center relative">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
                {index < bridgeSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full">
                    <ArrowRight className="h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Trust */}
      <section className="py-16 bg-blue-50 dark:bg-blue-900/20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Enterprise-Grade Security
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Multi-Signature Validation</h3>
                    <p className="text-gray-600 dark:text-gray-400">Every bridge transaction requires multiple cryptographic signatures for enhanced security.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Smart Contract Audits</h3>
                    <p className="text-gray-600 dark:text-gray-400">All bridge contracts undergo rigorous security audits by leading blockchain security firms.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Real-Time Monitoring</h3>
                    <p className="text-gray-600 dark:text-gray-400">24/7 monitoring systems detect and prevent suspicious activities across all chains.</p>
                  </div>
                </div>

              </div>
            </div>
            <div className="relative">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="h-8 w-8 text-green-600" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Security Score</h3>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">99.9%</div>
                  <p className="text-gray-600 dark:text-gray-400">Uptime & Security Rating</p>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enterprise-grade security infrastructure with continuous monitoring
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Warning Section */}
      <section className="py-12 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mt-1" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Important Bridge Guidelines
              </h3>
              <div className="text-gray-700 dark:text-gray-300 space-y-2">
                <p>• Always verify destination addresses before initiating bridge transactions</p>
                <p>• Bridge transfers are irreversible once confirmed on the blockchain</p>
                <p>• Network congestion may affect bridge completion times</p>
                <p>• Minimum bridge amounts apply for each supported token</p>
                <p>• Keep transaction receipts for tracking and support purposes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Bridge Your Assets?
          </h2>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            Join thousands of users who trust RiddleSwap Bridge for secure cross-chain transfers
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/bridge">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                Start Bridging Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-blue-600">
                Contact Support
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BridgeInfo;
