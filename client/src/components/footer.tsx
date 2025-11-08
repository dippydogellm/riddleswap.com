import { ExternalLink, Twitter, MessageCircle, Book, Gamepad2, Palette, Shield, TrendingUp } from "lucide-react";
import { SiDiscord } from "react-icons/si";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white py-16 px-4 border-t border-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/rdl-logo-official.png" 
                alt="RDL Official Logo" 
                className="h-12 w-12 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextEl) nextEl.style.display = 'flex';
                }}
              />
              <div 
                className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center shadow-lg" 
                style={{ display: 'none' }}
              >
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <div>
                <h2 className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
                  RiddleSwap
                </h2>
                <p className="text-sm text-gray-400">Multi-Chain DeFi Platform</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              The most advanced decentralized trading platform for XRPL, EVM chains, and Solana. 
              Experience lightning-fast swaps, NFT gaming, and cross-chain DeFi.
            </p>
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Secured by XRPL Technology</span>
            </div>
          </div>

          {/* Trading Platform */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-orange-400">
              <TrendingUp className="w-5 h-5" />
              Trading
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>
                <a href="/" className="hover:text-orange-400 transition-colors flex items-center gap-1">
                  Swap Tokens
                </a>
              </li>
              <li>
                <a href="/portfolio" className="hover:text-orange-400 transition-colors">
                  Portfolio
                </a>
              </li>
              <li>
                <a href="/analytics" className="hover:text-orange-400 transition-colors">
                  Analytics
                </a>
              </li>
              <li>
                <a href="/liquidity" className="hover:text-orange-400 transition-colors">
                  Liquidity Pools
                </a>
              </li>
              <li>
                <a href="/bridge" className="hover:text-orange-400 transition-colors">
                  Bridge Assets
                </a>
              </li>
            </ul>
          </div>

          {/* Gaming Section */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-purple-400">
              <Gamepad2 className="w-5 h-5" />
              Gaming
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>
                <a href="/whitepaper" className="hover:text-orange-400 transition-colors flex items-center gap-1 font-semibold">
                  ⚔️ Gaming Documentation
                </a>
              </li>
              <li>
                <a href="/gaming-dashboard" className="hover:text-purple-400 transition-colors">
                  Gaming Dashboard
                </a>
              </li>
              <li>
                <a href="/nft-marketplace" className="hover:text-purple-400 transition-colors">
                  NFT Marketplace
                </a>
              </li>
              <li>
                <a href="/battles" className="hover:text-purple-400 transition-colors">
                  Battle Arena
                </a>
              </li>
              <li>
                <a href="/land" className="hover:text-purple-400 transition-colors">
                  Land Marketplace
                </a>
              </li>
              <li>
                <a href="/leaderboard" className="hover:text-purple-400 transition-colors">
                  Leaderboards
                </a>
              </li>
            </ul>
          </div>

          {/* Documentation */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-blue-400">
              <Book className="w-5 h-5" />
              Documentation
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>
                <a href="/docs" className="hover:text-blue-400 transition-colors flex items-center gap-1 font-semibold">
                  <Book className="w-3 h-3" />
                  All Documentation
                </a>
              </li>
              <li>
                <a href="/whitepaper" className="hover:text-orange-400 transition-colors flex items-center gap-1">
                  ⚔️ Gaming White Paper
                </a>
              </li>
              <li>
                <a href="/docs/platform-overview" className="hover:text-blue-400 transition-colors">
                  Platform Overview
                </a>
              </li>
              <li>
                <a href="/docs/wallet-walletconnect" className="hover:text-blue-400 transition-colors">
                  Wallet & WalletConnect
                </a>
              </li>
              <li>
                <a href="/docs/multi-chain-swap" className="hover:text-blue-400 transition-colors">
                  Multi-Chain Swap
                </a>
              </li>
              <li>
                <a href="/docs/cross-chain-bridge" className="hover:text-blue-400 transition-colors">
                  Cross-Chain Bridge
                </a>
              </li>
              <li>
                <a href="/docs/nft-marketplace" className="hover:text-blue-400 transition-colors">
                  NFT Marketplace
                </a>
              </li>
              <li>
                <a href="/docs/token-scanner" className="hover:text-blue-400 transition-colors">
                  Token Scanner
                </a>
              </li>
              <li>
                <a href="/docs/developer-tools" className="hover:text-blue-400 transition-colors">
                  Developer Tools
                </a>
              </li>
              <li>
                <a href="/docs/oracle-social-media" className="hover:text-blue-400 transition-colors">
                  Oracle Social Media
                </a>
              </li>
            </ul>
          </div>

          {/* Community & Legal Combined */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-green-400">Community</h3>
            <ul className="space-y-2 text-gray-300 text-sm mb-6">
              <li>
                <a 
                  href="https://discord.gg/NfKPdjxF" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-green-400 flex items-center gap-2 transition-colors"
                >
                  <SiDiscord className="h-4 w-4" />
                  Discord
                </a>
              </li>
              <li>
                <a 
                  href="https://x.com/RIDDLEXRPL" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-green-400 flex items-center gap-2 transition-colors"
                >
                  <Twitter className="h-4 w-4" />
                  Twitter
                </a>
              </li>
              <li>
                <a 
                  href="https://t.me/riddlexrp" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-green-400 flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Telegram
                </a>
              </li>
              <li>
                <a 
                  href="https://linktr.ee/riddlechain" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-green-400 flex items-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  All Links
                </a>
              </li>
            </ul>

            <h3 className="font-semibold text-base mb-3 text-gray-400">Legal</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Featured Banner */}
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Book className="w-8 h-8 text-orange-400" />
              <div>
                <h4 className="font-semibold text-white text-lg">
                  The Trolls Inquisition White Paper
                </h4>
                <p className="text-sm text-gray-400">
                  Technical documentation for cross-metaverse NFT gaming integration
                </p>
              </div>
            </div>
            <a 
              href="/whitepaper"
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
            >
              Read White Paper
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-slate-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-gray-400">
              <p className="text-center md:text-left">
                © 2025 RiddleSwap. All rights reserved.
              </p>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">•</span>
                <span>Built with ❤️ for the XRPL community</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Powered by</span>
                <a 
                  href="https://xrpl.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-1"
                >
                  XRPL
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="h-6 w-px bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">All Systems Operational</span>
              </div>
            </div>
          </div>

          {/* Version Info */}
          <div className="mt-4 text-center text-xs text-gray-600">
            <p>RiddleSwap Platform v2.0 • The Trolls Inquisition Gaming System v1.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
