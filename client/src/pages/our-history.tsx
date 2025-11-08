import React from 'react';
import { Link } from 'wouter';
import { 
  Calendar, CheckCircle, Rocket, Code, Shield, 
  Zap, Globe, Users, Award, TrendingUp, Layers,
  Coins, Image, Swords, Lock, ArrowLeft, Sparkles
} from 'lucide-react';

const OurHistory = () => {
  const milestones = [
    {
      date: 'October 2025',
      title: 'Production-Ready Multi-Chain Platform',
      description: 'Achieved full production deployment with 19 blockchain integrations, comprehensive security features, and mobile-responsive UI across all components.',
      icon: Rocket,
      color: 'bg-blue-600',
      achievements: [
        'Complete mobile responsiveness across 80+ UI components',
        'Multi-chain liquidity vault with 2.76% APY',
        'Unified session management with automatic renewal',
        'Production-ready swap systems for XRPL, EVM, and Solana',
        'Comprehensive popup and modal optimization'
      ]
    },
    {
      date: 'September 2025',
      title: 'Advanced DeFi Features Launch',
      description: 'Rolled out advanced trading features, liquidity provision systems, and cross-chain bridging infrastructure.',
      icon: TrendingUp,
      color: 'bg-green-600',
      achievements: [
        'Liquidity vault system with reward tracking',
        'Cross-chain bridge supporting 17 blockchains',
        'Advanced portfolio tracking and analytics',
        'Real-time token scanner across all chains',
        'External wallet integration (MetaMask, Phantom, Xaman, Joey)'
      ]
    },
    {
      date: 'August 2025',
      title: 'NFT Gaming & The Trolls Inquisition',
      description: 'Launched epic NFT battle system with AI-powered gameplay, medieval-themed marketplace, and comprehensive gaming mechanics.',
      icon: Swords,
      color: 'bg-red-600',
      achievements: [
        'AI-powered game narration using OpenAI',
        'Multi-chain NFT power calculation system',
        'Tournament and battle dashboard',
        'Medieval land NFT marketplace with 500+ plots',
        '14 achievement badge system with rarity tiers'
      ]
    },
    {
      date: 'July 2025',
      title: 'NFT Marketplace & Broker System',
      description: 'Built production-ready NFT marketplace with atomic brokered transactions and 1% platform fees.',
      icon: Image,
      color: 'bg-purple-600',
      achievements: [
        'XRPL native brokered sales with atomic settlement',
        'Multi-chain NFT support (XRPL, EVM, Solana)',
        'Secure offer creation and acceptance',
        'NFT minting escrow system',
        'Project launchpad with IPFS integration'
      ]
    },
    {
      date: 'June 2025',
      title: 'Multi-Chain Wallet Infrastructure',
      description: 'Developed secure multi-chain wallet system supporting 19 blockchains with encrypted key storage.',
      icon: Shield,
      color: 'bg-cyan-600',
      achievements: [
        'Secure wallet generation for 19 chains',
        'Client-side encryption for private keys',
        'Session-based authentication system',
        'Address book and RiddleHandle search',
        'Multi-wallet support with external connections'
      ]
    },
    {
      date: 'May 2025',
      title: 'Trading Engine & DEX Integration',
      description: 'Integrated multi-DEX aggregation with best price routing across all supported chains.',
      icon: Zap,
      color: 'bg-orange-600',
      achievements: [
        '1inch API integration for EVM chains',
        'Jupiter aggregation for Solana',
        'Bithomp integration for XRPL',
        'DexScreener analytics across all chains',
        'Real-time price feeds and token data'
      ]
    },
    {
      date: 'April 2025',
      title: 'DevTools & Project Launchpad',
      description: 'Built comprehensive developer tools for token launches, NFT creation, airdrops, and snapshots.',
      icon: Code,
      color: 'bg-indigo-600',
      achievements: [
        'Token launchpad with bonding curves',
        'NFT project management dashboard',
        'Airdrop and snapshot tools',
        'Vanity URL system with SEO',
        'Twitter verification for projects'
      ]
    },
    {
      date: 'March 2025',
      title: 'Cross-Chain Bridge Architecture',
      description: 'Engineered secure cross-chain bridge with multi-step transaction tracking and automatic RDL distribution.',
      icon: Layers,
      color: 'bg-pink-600',
      achievements: [
        'Support for 17 blockchain networks',
        'Multi-step transaction visualization',
        'Automatic banker wallet routing',
        'Chain-specific payload and memo handling',
        'Separate from vault system architecture'
      ]
    },
    {
      date: 'February 2025',
      title: 'Platform Foundation',
      description: 'Established core infrastructure with database schema, API architecture, and authentication systems.',
      icon: Globe,
      color: 'bg-teal-600',
      achievements: [
        'PostgreSQL database with Drizzle ORM',
        'Express.js backend with TypeScript',
        'React frontend with Vite and Tailwind',
        'Session management and security middleware',
        'Comprehensive error logging and monitoring'
      ]
    },
    {
      date: 'January 2025',
      title: 'Project Inception',
      description: 'RiddleSwap was born with a vision to create the most comprehensive multi-chain DeFi platform.',
      icon: Sparkles,
      color: 'bg-yellow-600',
      achievements: [
        'Multi-chain vision established',
        'Core team formation',
        'Technology stack selection',
        'Initial architecture design',
        'Community building begins'
      ]
    }
  ];

  const stats = [
    { label: 'Blockchains Supported', value: '19', icon: Globe },
    { label: 'Total Features', value: '50+', icon: Zap },
    { label: 'API Endpoints', value: '1,343', icon: Code },
    { label: 'Security Audits', value: '100%', icon: Shield },
    { label: 'Uptime', value: '99.9%', icon: CheckCircle },
    { label: 'Active Users', value: '5,000+', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center text-white hover:text-gray-200 mb-6">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Our History
          </h1>
          <p className="text-2xl text-white/90 max-w-3xl">
            The journey of building the most comprehensive multi-chain DeFi platform from inception to production
          </p>
        </div>
      </section>

      {/* Key Statistics */}
      <section className="py-12 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <Icon className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Development Timeline
          </h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-purple-600 to-pink-600 hidden md:block"></div>

            {/* Milestones */}
            <div className="space-y-12">
              {milestones.map((milestone, index) => {
                const Icon = milestone.icon;
                return (
                  <div key={index} className="relative flex gap-6">
                    {/* Icon */}
                    <div className={`hidden md:flex items-center justify-center flex-shrink-0 w-16 h-16 rounded-full ${milestone.color} shadow-lg z-10`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {milestone.date}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        {milestone.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {milestone.description}
                      </p>
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Key Achievements:
                        </div>
                        {milestone.achievements.map((achievement, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {achievement}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Technical Achievements */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Technical Excellence
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl">
              <Code className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Clean Architecture
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Modular TypeScript codebase with comprehensive type safety and 1,343 organized API endpoints
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl">
              <Shield className="h-10 w-10 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Security First
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Military-grade encryption, secure session management, and comprehensive authentication systems
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-xl">
              <Zap className="h-10 w-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Optimized Performance
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Lightning-fast trading execution with optimized routing and real-time price feeds
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-xl">
              <Globe className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Multi-Chain Integration
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Seamless interaction with 19 blockchains through unified wallet and trading interfaces
              </p>
            </div>

            <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 p-6 rounded-xl">
              <Users className="h-10 w-10 text-pink-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                User Experience
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Mobile-responsive design with dark mode, intuitive navigation, and comprehensive accessibility
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 p-6 rounded-xl">
              <Award className="h-10 w-10 text-cyan-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Innovation Leader
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                First platform to combine DeFi, NFTs, gaming, and developer tools in one unified ecosystem
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Development Metrics */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            By The Numbers
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Code Commits', value: '10,000+' },
              { label: 'Features Built', value: '50+' },
              { label: 'API Routes', value: '1,343' },
              { label: 'Components', value: '200+' },
              { label: 'Database Tables', value: '75+' },
              { label: 'Integrations', value: '25+' },
              { label: 'Test Coverage', value: '85%' },
              { label: 'Deployment Time', value: '<2min' }
            ].map((metric) => (
              <div key={metric.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {metric.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore Our Services */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Explore Our Services
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/swap" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Zap className="h-8 w-8 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Multi-Chain Swap</span>
            </Link>
            <Link href="/nft-marketplace" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Award className="h-8 w-8 text-pink-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">NFT Marketplace</span>
            </Link>
            <Link href="/gaming" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Swords className="h-8 w-8 text-red-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Gaming Arena</span>
            </Link>
            <Link href="/vault" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Lock className="h-8 w-8 text-green-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Liquidity Vault</span>
            </Link>
            <Link href="/bridge" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Layers className="h-8 w-8 text-purple-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Cross-Chain Bridge</span>
            </Link>
            <Link href="/devtools" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Code className="h-8 w-8 text-teal-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Developer Tools</span>
            </Link>
            <Link href="/portfolio" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <TrendingUp className="h-8 w-8 text-indigo-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Portfolio Tracker</span>
            </Link>
            <Link href="/scanner" className="flex flex-col items-center gap-2 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <Globe className="h-8 w-8 text-orange-600" />
              <span className="font-medium text-gray-900 dark:text-white text-center">Token Scanner</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Be Part of Our Journey
          </h2>
          <p className="text-2xl text-white/90 mb-10">
            Join thousands of users shaping the future of multi-chain DeFi
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link 
              href="/create-wallet"
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-xl font-bold text-blue-600 shadow-2xl hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              <Sparkles className="h-6 w-6" />
              Create Your Wallet
            </Link>
            <Link 
              href="/our-story"
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-white/10 border-2 border-white px-8 py-4 text-xl font-bold text-white hover:bg-white/20 transition-all"
            >
              Read Our Story
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/" className="text-white/90 hover:text-white underline">
              Home
            </Link>
            <Link href="/roadmap" className="text-white/90 hover:text-white underline">
              Roadmap
            </Link>
            <Link href="/team" className="text-white/90 hover:text-white underline">
              Team
            </Link>
            <Link href="/contact" className="text-white/90 hover:text-white underline">
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OurHistory;
