import React from 'react';
import { Link } from 'wouter';
import { 
  Users, Heart, Lightbulb, Target, Star, Rocket, 
  Shield, Zap, Globe, TrendingUp, ArrowLeft, Sparkles
} from 'lucide-react';

export default function OurStoryPage() {
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
            Our Story
          </h1>
          <p className="text-2xl text-white/90 max-w-3xl">
            Building the future of multi-chain DeFi, one block at a time
          </p>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Our Mission
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
              To democratize access to multi-chain DeFi by creating the most user-friendly, 
              secure, and feature-rich trading platform that bridges 19 different blockchain 
              ecosystems - all while maintaining true community ownership and governance.
            </p>
          </div>
        </div>
      </section>

      {/* The Journey */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            <Rocket className="inline h-10 w-10 mr-3 text-blue-600" />
            The RiddleSwap Journey
          </h2>
          
          <div className="space-y-12">
            {/* Genesis */}
            <div className="flex items-start gap-6">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">The Genesis</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                  It started with a simple question: why is multi-chain trading so complicated? 
                  Born from the XRPL community, RiddleSwap emerged with a vision to make DeFi 
                  accessible across all blockchains. We believed users shouldn't have to choose 
                  between chains - they should be able to trade freely across all of them.
                </p>
              </div>
            </div>

            {/* Community First */}
            <div className="flex items-start gap-6">
              <div className="bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Community-Driven Development</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                  From day one, RiddleSwap has been built by the community, for the community. 
                  No venture capital. No corporate overlords. Just passionate individuals building 
                  something amazing together. Every decision is made transparently, with community 
                  input driving our roadmap and feature development.
                </p>
              </div>
            </div>

            {/* Technical Innovation */}
            <div className="flex items-start gap-6">
              <div className="bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Technical Excellence</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                  We integrate with the best infrastructure available: 1inch for EVM chains, 
                  Jupiter for Solana, and Bithomp for XRPL. This ensures our users get the best 
                  rates and liquidity while maintaining enterprise-grade security. Our platform 
                  now supports 19 blockchains with production-ready swap systems and 1% platform fees.
                </p>
              </div>
            </div>

            {/* Expansion */}
            <div className="flex items-start gap-6">
              <div className="bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                <Globe className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Multi-Chain Expansion</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                  What started as an XRPL-focused platform evolved into a comprehensive multi-chain 
                  ecosystem. We now support 19 blockchains including Ethereum, Solana, Bitcoin, BNB Chain, 
                  Polygon, Base, Arbitrum, Optimism, and many more. Our cross-chain bridge and liquidity 
                  vault provide seamless asset transfers and earning opportunities.
                </p>
              </div>
            </div>

            {/* Future */}
            <div className="flex items-start gap-6">
              <div className="bg-pink-100 dark:bg-pink-900/30 border-2 border-pink-300 dark:border-pink-700 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-8 h-8 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">The Future</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                  RiddleSwap isn't just a DEX - it's evolving into a complete DeFi ecosystem. With NFT 
                  marketplace, gaming integration (The Trolls Inquisition), developer tools, token launchpad, 
                  and comprehensive analytics, we're building the all-in-one platform for decentralized finance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Our Core Values
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Community Governance */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Community Governance</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Every major decision is made by the community, for the community. 
                Transparency and inclusivity are at the heart of our governance model.
              </p>
            </div>

            {/* User-Centric Design */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <div className="bg-green-100 dark:bg-green-900/30 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">User-Centric Design</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Complex DeFi made simple. We prioritize intuitive interfaces and 
                seamless experiences without compromising on powerful features.
              </p>
            </div>

            {/* Innovation */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <div className="bg-purple-100 dark:bg-purple-900/30 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Innovation</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Pushing the boundaries of what's possible in DeFi while maintaining 
                security and reliability as our top priorities.
              </p>
            </div>

            {/* Security */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <div className="bg-red-100 dark:bg-red-900/30 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Security First</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your assets are protected with bank-grade encryption, secure session 
                management, and comprehensive authentication systems.
              </p>
            </div>

            {/* Accessibility */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <div className="bg-orange-100 dark:bg-orange-900/30 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Accessibility</h3>
              <p className="text-gray-600 dark:text-gray-300">
                DeFi for everyone, regardless of technical expertise or background. 
                Breaking down barriers to financial sovereignty.
              </p>
            </div>

            {/* Long-term Vision */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
              <div className="bg-pink-100 dark:bg-pink-900/30 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-pink-600 dark:text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Long-term Vision</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Building for the future, not just today. Creating sustainable, 
                scalable solutions that serve the community for years to come.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We've Built */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            What We've Built
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🔄 Multi-Chain Trading</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• Support for 19 blockchains</li>
                <li>• Best price routing with 1% platform fee</li>
                <li>• External wallet integration (MetaMask, Phantom, Xaman, Joey)</li>
                <li>• Real-time price feeds and analytics</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🖼️ NFT Marketplace</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• Brokered marketplace with atomic settlement</li>
                <li>• Multi-chain NFT support</li>
                <li>• Project launchpad with IPFS integration</li>
                <li>• Minting escrow systems</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🎮 Gaming Ecosystem</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• The Trolls Inquisition battle system</li>
                <li>• AI-powered game narration</li>
                <li>• Tournament and badge achievements</li>
                <li>• Medieval land NFT marketplace</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🔧 Developer Tools</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• Token and NFT creation tools</li>
                <li>• Airdrop and snapshot utilities</li>
                <li>• Project verification system</li>
                <li>• Vanity URLs with SEO optimization</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🌉 Cross-Chain Bridge</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• Transfer assets between 17 blockchains</li>
                <li>• Multi-step transaction tracking</li>
                <li>• Automatic banker wallet routing</li>
                <li>• Chain-specific payload handling</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🔒 Liquidity Vault</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• 2.76% APY on deposits</li>
                <li>• Multi-chain native token support</li>
                <li>• Separate reward claim/withdrawal tracking</li>
                <li>• Admin control panel</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Join the Journey */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Join Our Journey
          </h2>
          <p className="text-2xl text-white/90 mb-10">
            RiddleSwap's story is still being written. Be part of the next chapter.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link 
              href="/create-wallet"
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-xl font-bold text-blue-600 shadow-2xl hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              <Sparkles className="h-6 w-6" />
              Start Trading
            </Link>
            <Link 
              href="/our-history"
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-white/10 border-2 border-white px-8 py-4 text-xl font-bold text-white hover:bg-white/20 transition-all"
            >
              View Our History
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/" className="text-white/90 hover:text-white underline">
              Home
            </Link>
            <Link href="/roadmap" className="text-white/90 hover:text-white underline">
              Roadmap
            </Link>
            <Link href="/contact" className="text-white/90 hover:text-white underline">
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
