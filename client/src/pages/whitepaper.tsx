import { useState } from "react";
import { Book, Globe, Code, TrendingUp, Calendar, DollarSign, Users, Zap, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Whitepaper() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10"></div>
        <div className="relative container mx-auto px-4 py-16 sm:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full mb-6">
              <Book className="w-5 h-5 text-orange-400" />
              <span className="text-orange-300 font-semibold">Technical White Paper v1.0</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
              The Trolls Inquisition
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 mb-4">
              XRPL-Native NFT Gaming Battle System
            </p>
            <p className="text-lg text-gray-400 mb-8">
              A Comprehensive Technical Framework for Cross-Metaverse NFT Gaming Integration
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Published: October 2025</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>RiddleSwap Development Team</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Documentation */}
      <div className="container mx-auto px-4 py-12">
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 backdrop-blur mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Book className="w-6 h-6 text-blue-400" />
              Complete Platform Documentation
            </CardTitle>
            <p className="text-gray-400 mt-2">Explore all RiddleSwap technical white papers and documentation</p>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <a href="/docs/platform-overview" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">🌐</div>
              <div className="font-semibold text-white mb-1">Platform Overview</div>
              <div className="text-xs text-gray-400">Vision, architecture & ecosystem</div>
            </a>
            <a href="/docs/wallet-walletconnect" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">👛</div>
              <div className="font-semibold text-white mb-1">Wallet & WalletConnect</div>
              <div className="text-xs text-gray-400">Multi-chain wallet management</div>
            </a>
            <a href="/docs/multi-chain-swap" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">🔄</div>
              <div className="font-semibold text-white mb-1">Multi-Chain Swap</div>
              <div className="text-xs text-gray-400">DEX aggregation & trading</div>
            </a>
            <a href="/docs/cross-chain-bridge" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">🌉</div>
              <div className="font-semibold text-white mb-1">Cross-Chain Bridge</div>
              <div className="text-xs text-gray-400">Asset transfers between chains</div>
            </a>
            <a href="/docs/nft-marketplace" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">🎨</div>
              <div className="font-semibold text-white mb-1">NFT Marketplace</div>
              <div className="text-xs text-gray-400">XRPL XLS-20 brokered sales</div>
            </a>
            <a href="/docs/token-scanner" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold text-white mb-1">Token Scanner</div>
              <div className="text-xs text-gray-400">Real-time token analytics</div>
            </a>
            <a href="/docs/developer-tools" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">🛠️</div>
              <div className="font-semibold text-white mb-1">Developer Tools</div>
              <div className="text-xs text-gray-400">APIs, webhooks & integrations</div>
            </a>
            <a href="/docs/oracle-social-media" className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-blue-500/20 hover:border-blue-500/50">
              <div className="text-2xl mb-2">🤖</div>
              <div className="font-semibold text-white mb-1">Oracle Social Media</div>
              <div className="text-xs text-gray-400">AI automation & engagement</div>
            </a>
          </CardContent>
        </Card>

        {/* Table of Contents */}
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Book className="w-6 h-6 text-orange-400" />
              Table of Contents - Gaming White Paper
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {[
              { id: "1", title: "Executive Summary", icon: "📋" },
              { id: "2", title: "Technical Architecture", icon: "🏗️" },
              { id: "3", title: "Current Platform Statistics", icon: "📊" },
              { id: "4", title: "Metaverse Integration Framework", icon: "🌐" },
              { id: "5", title: "Past Achievements & Timeline", icon: "🎯" },
              { id: "6", title: "Development Roadmap (2025-2026)", icon: "🗺️" },
              { id: "7", title: "Economic Model & Tokenomics", icon: "💰" },
              { id: "8", title: "API Documentation", icon: "⚙️" },
              { id: "9", title: "Market Analysis", icon: "📈" },
              { id: "10", title: "Security & Compliance", icon: "🔒" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#section-${item.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-gray-300 hover:text-orange-400"
              >
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="text-xs text-gray-500">Section {item.id}</div>
                  <div className="font-medium">{item.title}</div>
                </div>
              </a>
            ))}
          </CardContent>
        </Card>

        {/* Section 1: Executive Summary */}
        <section id="section-1" className="mt-12">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("1")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">1.</span> Executive Summary
                </span>
                {expandedSections["1"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["1"] && (
              <CardContent className="text-gray-300 space-y-4">
                <p className="text-lg leading-relaxed">
                  <strong className="text-orange-400">The Trolls Inquisition</strong> is a production-ready, blockchain-native NFT gaming battle system built on the XRP Ledger (XRPL). Our platform represents the convergence of decentralized finance, NFT ownership, and competitive gaming mechanics.
                </p>
                
                <div className="bg-slate-800/50 p-6 rounded-lg border border-orange-500/20">
                  <h4 className="text-xl font-semibold text-orange-400 mb-3">Core Value Proposition</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Zap className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <span><strong>True NFT Utility:</strong> Transform static NFT collections into dynamic gaming assets with trait-based power calculations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <span><strong>AI-Powered Experience:</strong> Integrated OpenAI GPT-4 Oracle providing real-time battle commentary, strategic guidance, and DALL-E 3 image generation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Cross-Metaverse Ready:</strong> Modular architecture designed for integration with Unity, Unreal Engine, and web-based metaverse platforms</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Automated Wagering:</strong> Blockchain-based escrow system with 80% winner payouts supporting XRP, RDL tokens, and NFT offers</span>
                    </li>
                  </ul>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mt-6">
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-4 rounded-lg border border-orange-500/20">
                    <div className="text-3xl font-bold text-orange-400">4</div>
                    <div className="text-sm text-gray-400">XRPL NFT Collections</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-4 rounded-lg border border-orange-500/20">
                    <div className="text-3xl font-bold text-orange-400">1,000</div>
                    <div className="text-sm text-gray-400">Fantasy Land Plots</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-4 rounded-lg border border-orange-500/20">
                    <div className="text-3xl font-bold text-orange-400">14</div>
                    <div className="text-sm text-gray-400">Achievement Badges</div>
                  </div>
                </div>

                <p className="text-gray-400 italic border-l-4 border-orange-500 pl-4">
                  "Our vision is to create a universal gaming ecosystem where NFT assets maintain their value and utility across multiple virtual worlds and gaming platforms. The Trolls Inquisition serves as the foundational layer for this cross-metaverse gaming infrastructure."
                </p>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Section 2: Technical Architecture */}
        <section id="section-2" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("2")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">2.</span> Technical Architecture
                </span>
                {expandedSections["2"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["2"] && (
              <CardContent className="text-gray-300 space-y-6">
                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-3">Technology Stack</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h5 className="font-semibold text-white mb-2">Frontend</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• React 18 with TypeScript</li>
                        <li>• Vite for build optimization</li>
                        <li>• Tailwind CSS + shadcn/ui</li>
                        <li>• @react-three/fiber for 3D rendering</li>
                        <li>• Capacitor for mobile deployment</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h5 className="font-semibold text-white mb-2">Backend</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• Node.js + Express.js</li>
                        <li>• PostgreSQL (Neon Database)</li>
                        <li>• Drizzle ORM</li>
                        <li>• Session-based authentication</li>
                        <li>• Rate limiting & CORS protection</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-3">Blockchain Integration</h4>
                  <div className="bg-slate-800/50 p-6 rounded-lg space-y-4">
                    <div>
                      <h5 className="font-semibold text-white mb-2">XRPL Integration Layer</h5>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Code className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                          <span><strong>NFT Scanning:</strong> Real-time trait analysis using Bithomp API and XRPL.js</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Code className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                          <span><strong>Power Calculation Engine:</strong> Deterministic hash-based trait scoring system</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Code className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                          <span><strong>Broker Wallet System:</strong> Automated escrow for battle wagering and NFT transactions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Code className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                          <span><strong>Smart Payment Distribution:</strong> 80% winner payout, 20% platform fee with automatic execution</span>
                        </li>
                      </ul>
                    </div>

                    <div className="border-t border-slate-700 pt-4">
                      <h5 className="font-semibold text-white mb-2">Database Schema</h5>
                      <div className="bg-slate-900 p-4 rounded font-mono text-xs overflow-x-auto">
                        <code className="text-green-400">
{`// Core Gaming Tables
gaming_players          // Player profiles & power levels
gaming_nfts            // NFT metadata & trait analysis
squadrons              // NFT squadron management (up to 10 NFTs)
squadron_members       // NFT-squadron relationships
battles                // Battle state management
battle_participants    // Player participation tracking
gaming_alliances       // Guild/alliance system
land_inventory         // Land plot item placement
player_civilizations   // Civilization progress tracking`}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-3">AI Integration (The Oracle)</h4>
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6 rounded-lg border border-purple-500/20">
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <span><strong>GPT-4 Integration:</strong> Real-time battle commentary and strategic guidance</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <span><strong>DALL-E 3:</strong> Dynamic image generation for land plots, commanders, and victory scenes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <span><strong>Voice Narration:</strong> Text-to-speech for immersive battle experiences</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <span><strong>Social Media Automation:</strong> AI-powered Twitter and Telegram engagement</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-3">Security Architecture</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <Shield className="w-8 h-8 text-green-400 mb-2" />
                      <h5 className="font-semibold text-white mb-2">Wallet Security</h5>
                      <ul className="space-y-1 text-sm text-gray-400">
                        <li>• AES-256-GCM encryption</li>
                        <li>• Client-side key generation</li>
                        <li>• No private key exposure</li>
                        <li>• Session-based authentication</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <Shield className="w-8 h-8 text-blue-400 mb-2" />
                      <h5 className="font-semibold text-white mb-2">Battle Anti-Cheat</h5>
                      <ul className="space-y-1 text-sm text-gray-400">
                        <li>• Server-side hash computation</li>
                        <li>• Deterministic trait scoring</li>
                        <li>• Immutable battle logs</li>
                        <li>• Ownership verification</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Section 3: Current Platform Statistics */}
        <section id="section-3" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("3")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">3.</span> Current Platform Statistics
                </span>
                {expandedSections["3"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["3"] && (
              <CardContent className="text-gray-300 space-y-6">
                <p className="text-gray-400 mb-4">
                  <strong>Data Collection Period:</strong> October 2025 (Live Production Environment)
                </p>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 rounded-lg border border-blue-500/20">
                    <Users className="w-8 h-8 text-blue-400 mb-2" />
                    <div className="text-3xl font-bold text-white">31</div>
                    <div className="text-sm text-gray-400">Total Registered Players</div>
                    <div className="text-xs text-gray-500 mt-2">9 verified | 8 completed setup</div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-lg border border-orange-500/20">
                    <Zap className="w-8 h-8 text-orange-400 mb-2" />
                    <div className="text-3xl font-bold text-white">646,061</div>
                    <div className="text-sm text-gray-400">Total Platform Power</div>
                    <div className="text-xs text-gray-500 mt-2">Avg: 20,841 per player</div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-lg border border-purple-500/20">
                    <TrendingUp className="w-8 h-8 text-purple-400 mb-2" />
                    <div className="text-3xl font-bold text-white">208,976</div>
                    <div className="text-sm text-gray-400">Highest Player Power</div>
                    <div className="text-xs text-gray-500 mt-2">Top 1% threshold</div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-lg border border-green-500/20">
                    <Globe className="w-8 h-8 text-green-400 mb-2" />
                    <div className="text-3xl font-bold text-white">1</div>
                    <div className="text-sm text-gray-400">Active Squadrons</div>
                    <div className="text-xs text-gray-500 mt-2">Early access phase</div>
                  </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-lg mt-6">
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">Power Distribution Analysis</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Army Power</span>
                        <span className="text-white font-semibold">Highest contributor</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 w-[35%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Religion Power</span>
                        <span className="text-white font-semibold">Secondary</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 w-[25%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Civilization Power</span>
                        <span className="text-white font-semibold">Growing</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 w-[20%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Economic Power</span>
                        <span className="text-white font-semibold">Emerging</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 w-[20%]"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-400">1,000</div>
                    <div className="text-sm text-gray-400">Land Plots Available</div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-400">4</div>
                    <div className="text-sm text-gray-400">Supported NFT Collections</div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-400">14</div>
                    <div className="text-sm text-gray-400">Achievement Types</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 p-6 rounded-lg border border-orange-500/20 mt-6">
                  <h4 className="font-semibold text-white mb-2">📊 Growth Metrics (Oct 2025)</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>User Activation Rate:</strong> 29% (9/31 verified players)</li>
                    <li>• <strong>Setup Completion Rate:</strong> 89% (8/9 verified players completed wizard)</li>
                    <li>• <strong>Average Power per Verified Player:</strong> 71,785 (3.4x platform average)</li>
                    <li>• <strong>Platform Status:</strong> Early Access - Production Ready</li>
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Section 4: Metaverse Integration Framework */}
        <section id="section-4" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("4")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">4.</span> Metaverse Integration Framework
                </span>
                {expandedSections["4"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["4"] && (
              <CardContent className="text-gray-300 space-y-6">
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6 rounded-lg border border-cyan-500/20">
                  <h4 className="text-xl font-semibold text-cyan-400 mb-3">🌐 Vision for Cross-Platform Integration</h4>
                  <p className="text-gray-300 mb-4">
                    The Trolls Inquisition is designed as a <strong>platform-agnostic gaming layer</strong> that can integrate with any metaverse or gaming environment. Our modular architecture allows NFT power calculations, battle mechanics, and player progression to seamlessly translate across different virtual worlds.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">Integration Options</h4>
                  <div className="grid gap-4">
                    {/* Unity SDK */}
                    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Code className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h5 className="text-lg font-semibold text-white mb-2">Unity SDK (Planned Q3 2025)</h5>
                          <p className="text-sm text-gray-400 mb-3">
                            Native C# SDK for Unity developers to integrate Trolls Inquisition battle mechanics into their games.
                          </p>
                          <div className="bg-slate-900 p-4 rounded font-mono text-xs overflow-x-auto">
                            <code className="text-green-400">
{`// Unity Integration Example
using TrollsInquisition;

public class BattleController : MonoBehaviour 
{
    private TrollsAPI api;
    
    void Start() 
    {
        api = new TrollsAPI("YOUR_API_KEY");
        var squadron = await api.GetSquadron(playerId);
        var battleResult = await api.StartBattle(squadron, opponent);
    }
}`}
                            </code>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">Cross-platform</span>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">Real-time sync</span>
                            <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">NFT verification</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* REST API */}
                    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Globe className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h5 className="text-lg font-semibold text-white mb-2">REST API (Production Ready)</h5>
                          <p className="text-sm text-gray-400 mb-3">
                            Comprehensive HTTP API for web-based metaverse platforms (Decentraland, The Sandbox, Cryptovoxels).
                          </p>
                          <div className="bg-slate-900 p-4 rounded font-mono text-xs overflow-x-auto">
                            <code className="text-blue-400">
{`// API Endpoints
GET  /api/gaming/player/profile           // Player stats & power
GET  /api/squadrons/player                // Squadron management
POST /api/battles/create                  // Initiate battle
GET  /api/battles/:battleId               // Battle state
POST /api/battles/:battleId/join          // Join battle
GET  /api/land-inventory/user/:handle     // Land & inventory`}
                            </code>
                          </div>
                          <div className="mt-3 text-sm text-gray-400">
                            <strong className="text-white">Base URL:</strong> <code className="text-orange-400">https://riddleswap.com/api</code>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* WebSocket Integration */}
                    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h5 className="text-lg font-semibold text-white mb-2">WebSocket Real-Time Events (Planned Q2 2025)</h5>
                          <p className="text-sm text-gray-400 mb-3">
                            Live battle updates, Oracle commentary, and multiplayer synchronization for immersive experiences.
                          </p>
                          <div className="bg-slate-900 p-4 rounded font-mono text-xs overflow-x-auto">
                            <code className="text-cyan-400">
{`// WebSocket Events
ws://api.riddleswap.com/gaming

Events:
- battle:started       // Battle initiation
- battle:turn          // Turn-by-turn updates
- battle:oracle        // AI commentary
- battle:completed     // Final results
- squadron:updated     // NFT changes
- alliance:event       // Guild notifications`}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unreal Engine Plugin */}
                    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Code className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h5 className="text-lg font-semibold text-white mb-2">Unreal Engine Plugin (Planned Q4 2025)</h5>
                          <p className="text-sm text-gray-400 mb-3">
                            Blueprint-compatible C++ plugin for AAA-quality metaverse integration.
                          </p>
                          <ul className="space-y-1 text-sm text-gray-400">
                            <li>• Native Blueprint nodes for battle creation</li>
                            <li>• Visual NFT scanner widget</li>
                            <li>• Integrated payment gateway</li>
                            <li>• Oracle AI voice integration</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">Cross-Metaverse NFT Compatibility</h4>
                  <div className="bg-slate-800/50 p-6 rounded-lg">
                    <p className="text-gray-300 mb-4">
                      Our NFT power calculation system is <strong>blockchain-agnostic</strong> and can analyze NFTs from:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h5 className="font-semibold text-white">Currently Supported</h5>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>✅ XRPL (XLS-20 NFTs)</li>
                          <li>✅ 4 Featured XRPL Collections</li>
                          <li>✅ Trait-based power analysis</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h5 className="font-semibold text-white">Planned Support (2025-2026)</h5>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>🔄 Ethereum (ERC-721)</li>
                          <li>🔄 Solana (Metaplex)</li>
                          <li>🔄 Polygon NFTs</li>
                          <li>🔄 Cross-chain bridging</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6 rounded-lg border border-purple-500/20">
                  <h4 className="text-lg font-semibold text-purple-400 mb-3">🎮 Target Metaverse Platforms</h4>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <strong className="text-white">Gaming Metaverses:</strong>
                      <ul className="text-gray-400 mt-1 space-y-1">
                        <li>• Decentraland</li>
                        <li>• The Sandbox</li>
                        <li>• Cryptovoxels</li>
                        <li>• Somnium Space</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-white">Development Platforms:</strong>
                      <ul className="text-gray-400 mt-1 space-y-1">
                        <li>• Unity 2021+</li>
                        <li>• Unreal Engine 5</li>
                        <li>• Web3 browsers</li>
                        <li>• Custom game engines</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Section 5: Past Achievements */}
        <section id="section-5" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("5")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">5.</span> Past Achievements & Timeline
                </span>
                {expandedSections["5"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["5"] && (
              <CardContent className="text-gray-300">
                <div className="relative border-l-2 border-orange-500/30 pl-8 space-y-8">
                  {[
                    {
                      quarter: "Q2 2024",
                      title: "Platform Foundation",
                      achievements: [
                        "RiddleSwap multi-chain DeFi platform launched",
                        "XRPL wallet integration with Xaman & Joey",
                        "NFT marketplace broker system established",
                        "PostgreSQL database architecture deployed"
                      ]
                    },
                    {
                      quarter: "Q3 2024",
                      title: "Gaming System Development",
                      achievements: [
                        "NFT trait analysis engine completed",
                        "Power calculation algorithm implemented",
                        "Squadron management system (up to 10 NFTs)",
                        "Gaming dashboard UI/UX design finalized"
                      ]
                    },
                    {
                      quarter: "Q4 2024",
                      title: "Battle System & AI Integration",
                      achievements: [
                        "Turn-based battle mechanics deployed",
                        "OpenAI GPT-4 Oracle integration",
                        "DALL-E 3 image generation for land plots",
                        "Automated wagering system (80% payout)",
                        "Alliance/guild system launched"
                      ]
                    },
                    {
                      quarter: "Q1 2025",
                      title: "Land & Inventory System",
                      achievements: [
                        "1,000 fantasy land plots created",
                        "Land marketplace with XRP/RDL payments",
                        "Land inventory system (NFTs, buildings, weapons)",
                        "25% RDL discount implementation",
                        "Production deployment & optimization"
                      ]
                    },
                    {
                      quarter: "October 2025",
                      title: "Current Status: Production Ready",
                      achievements: [
                        "31 registered players, 9 verified",
                        "646,061 total platform power",
                        "Gaming Dashboard v3 deployed",
                        "Mobile-first responsive design",
                        "Early access program active"
                      ]
                    }
                  ].map((milestone, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[33px] w-4 h-4 bg-orange-500 rounded-full border-4 border-slate-900"></div>
                      <div className="bg-slate-800/50 p-6 rounded-lg">
                        <div className="text-orange-400 font-semibold mb-1">{milestone.quarter}</div>
                        <h5 className="text-xl font-bold text-white mb-3">{milestone.title}</h5>
                        <ul className="space-y-2">
                          {milestone.achievements.map((achievement, aidx) => (
                            <li key={aidx} className="flex items-start gap-2 text-sm text-gray-400">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span>{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Section 6: Roadmap */}
        <section id="section-6" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("6")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">6.</span> Development Roadmap (2025-2026)
                </span>
                {expandedSections["6"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["6"] && (
              <CardContent className="text-gray-300 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Q1 2025 */}
                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-6 h-6 text-blue-400" />
                      <h4 className="text-xl font-semibold text-white">Q1 2025 (Current)</h4>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Production launch & early access</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Gaming Dashboard v3 deployment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400">→</span>
                        <span>Community building & marketing push</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400">→</span>
                        <span>First tournament event (100 XRP prize pool)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400">→</span>
                        <span>Mobile app beta (iOS & Android)</span>
                      </li>
                    </ul>
                  </div>

                  {/* Q2 2025 */}
                  <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-6 h-6 text-purple-400" />
                      <h4 className="text-xl font-semibold text-white">Q2 2025</h4>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>WebSocket real-time battles:</strong> Live turn-by-turn updates</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Metaverse SDK alpha:</strong> Unity integration beta</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Cross-chain expansion:</strong> Ethereum NFT support</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Enhanced AI Oracle:</strong> Voice synthesis & advanced commentary</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Tournament system v2:</strong> Bracket automation & livestreaming</span>
                      </li>
                    </ul>
                  </div>

                  {/* Q3 2025 */}
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-lg border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Code className="w-6 h-6 text-orange-400" />
                      <h4 className="text-xl font-semibold text-white">Q3 2025</h4>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Unity SDK production release:</strong> Full C# library</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Decentraland integration:</strong> First metaverse deployment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Solana NFT support:</strong> Multi-chain power calculations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Land development system:</strong> Building construction mechanics</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Weapon crafting:</strong> NFT weapon minting system</span>
                      </li>
                    </ul>
                  </div>

                  {/* Q4 2025 */}
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-6 h-6 text-green-400" />
                      <h4 className="text-xl font-semibold text-white">Q4 2025</h4>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Unreal Engine plugin:</strong> AAA-quality graphics integration</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>The Sandbox integration:</strong> Second major metaverse</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Mobile app full release:</strong> iOS & Android app stores</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Alliance wars:</strong> Guild vs guild battles</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">○</span>
                        <span><strong>Esports tournament:</strong> $10,000 prize pool event</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-lg mt-6">
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">2026 Vision</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-semibold text-white mb-2">Platform Expansion</h5>
                      <ul className="space-y-1 text-sm text-gray-400">
                        <li>• 5+ metaverse integrations</li>
                        <li>• Cross-chain bridge (XRPL ↔ ETH ↔ SOL)</li>
                        <li>• 10,000+ active players target</li>
                        <li>• Developer marketplace for custom NFTs</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-white mb-2">Advanced Features</h5>
                      <ul className="space-y-1 text-sm text-gray-400">
                        <li>• VR/AR battle experiences</li>
                        <li>• AI-generated quest system</li>
                        <li>• Dynamic world events</li>
                        <li>• NFT rental marketplace</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Section 7: Economic Model */}
        <section id="section-7" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection("7")}>
              <CardTitle className="text-2xl text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">7.</span> Economic Model & Tokenomics
                </span>
                {expandedSections["7"] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {expandedSections["7"] && (
              <CardContent className="text-gray-300 space-y-6">
                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">Revenue Streams</h4>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-lg border border-green-500/20">
                      <DollarSign className="w-8 h-8 text-green-400 mb-3" />
                      <h5 className="font-semibold text-white mb-2">Battle Wagering</h5>
                      <p className="text-sm text-gray-400 mb-3">
                        20% platform fee on all battle wagers (XRP, RDL, NFTs)
                      </p>
                      <div className="text-2xl font-bold text-green-400">20%</div>
                      <div className="text-xs text-gray-500">of prize pool</div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-lg border border-orange-500/20">
                      <DollarSign className="w-8 h-8 text-orange-400 mb-3" />
                      <h5 className="font-semibold text-white mb-2">Land Sales</h5>
                      <p className="text-sm text-gray-400 mb-3">
                        Primary sales of 1,000 fantasy land plots
                      </p>
                      <div className="text-2xl font-bold text-orange-400">100%</div>
                      <div className="text-xs text-gray-500">primary market</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-lg border border-purple-500/20">
                      <DollarSign className="w-8 h-8 text-purple-400 mb-3" />
                      <h5 className="font-semibold text-white mb-2">NFT Marketplace</h5>
                      <p className="text-sm text-gray-400 mb-3">
                        1% broker fee on all NFT trades
                      </p>
                      <div className="text-2xl font-bold text-purple-400">1%</div>
                      <div className="text-xs text-gray-500">per transaction</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">RDL Token Utility</h4>
                  <div className="bg-slate-800/50 p-6 rounded-lg">
                    <p className="text-gray-300 mb-4">
                      <strong className="text-orange-400">RDL (Riddle Token)</strong> serves as the primary in-game currency with multiple use cases:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h5 className="font-semibold text-white">Current Utility</h5>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>• <strong className="text-orange-400">25% discount</strong> on land purchases</li>
                          <li>• Battle wager payments</li>
                          <li>• Tournament entry fees</li>
                          <li>• Alliance treasury contributions</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h5 className="font-semibold text-white">Planned Utility (2025-2026)</h5>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>• Weapon crafting fees</li>
                          <li>• Building construction</li>
                          <li>• NFT enhancement upgrades</li>
                          <li>• Premium Oracle features</li>
                          <li>• Governance voting rights</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">Battle Economy</h4>
                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6 rounded-lg border border-blue-500/20">
                    <h5 className="font-semibold text-white mb-3">Wagering System Breakdown</h5>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded">
                        <span className="text-gray-300">Total Prize Pool</span>
                        <span className="text-white font-semibold">100%</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-green-500/10 rounded">
                        <span className="text-gray-300">Winner Payout</span>
                        <span className="text-green-400 font-bold text-xl">80%</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-orange-500/10 rounded">
                        <span className="text-gray-300">Platform Fee</span>
                        <span className="text-orange-400 font-bold text-xl">20%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mt-4 italic">
                      Example: 100 XRP wager → Winner receives 80 XRP, Platform keeps 20 XRP
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-orange-400 mb-4">Revenue Projections (Conservative Estimates)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-gray-400 font-semibold">Metric</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-semibold">Q2 2025</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-semibold">Q4 2025</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-semibold">Q4 2026</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        <tr className="border-b border-slate-800">
                          <td className="py-3 px-4">Active Players</td>
                          <td className="py-3 px-4 text-right font-semibold">500</td>
                          <td className="py-3 px-4 text-right font-semibold">2,500</td>
                          <td className="py-3 px-4 text-right font-semibold">10,000</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-3 px-4">Daily Battles</td>
                          <td className="py-3 px-4 text-right">50</td>
                          <td className="py-3 px-4 text-right">300</td>
                          <td className="py-3 px-4 text-right">1,500</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-3 px-4">Avg. Wager (XRP)</td>
                          <td className="py-3 px-4 text-right">10</td>
                          <td className="py-3 px-4 text-right">20</td>
                          <td className="py-3 px-4 text-right">25</td>
                        </tr>
                        <tr className="border-b border-slate-800 bg-orange-500/5">
                          <td className="py-3 px-4 font-semibold">Monthly Revenue (XRP)</td>
                          <td className="py-3 px-4 text-right font-bold text-orange-400">3,000</td>
                          <td className="py-3 px-4 text-right font-bold text-orange-400">36,000</td>
                          <td className="py-3 px-4 text-right font-bold text-orange-400">225,000</td>
                        </tr>
                        <tr className="border-b border-slate-800 bg-green-500/5">
                          <td className="py-3 px-4 font-semibold">Annual Revenue (XRP)</td>
                          <td className="py-3 px-4 text-right font-bold text-green-400">36,000</td>
                          <td className="py-3 px-4 text-right font-bold text-green-400">432,000</td>
                          <td className="py-3 px-4 text-right font-bold text-green-400">2,700,000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    *Projections based on 20% platform fee. Does not include land sales, NFT marketplace fees, or additional revenue streams.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Sections 8-10 abbreviated for space - would expand similarly */}
        <section id="section-8" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <span className="text-orange-400">8.</span> API Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="mb-4">Complete API documentation available at:</p>
              <div className="bg-slate-900 p-4 rounded font-mono text-sm">
                <code className="text-cyan-400">https://riddleswap.com/api/docs</code>
              </div>
              <div className="mt-4 text-sm text-gray-400">
                <p>Key endpoints include player management, squadron operations, battle creation, land marketplace, and inventory management. Full SDK documentation will be released with Unity integration in Q3 2025.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="section-9" className="mt-8">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <span className="text-orange-400">9.</span> Market Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-4">
              <p>The NFT gaming market is projected to reach <strong className="text-orange-400">$3.2 billion by 2027</strong>. The Trolls Inquisition targets the intersection of competitive gaming, NFT utility, and metaverse integration - a rapidly growing segment with limited competition offering true cross-platform NFT gaming infrastructure.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <h5 className="font-semibold text-white mb-2">Competitive Advantages</h5>
                  <ul className="space-y-1 text-sm text-gray-400">
                    <li>• XRPL-native with low transaction costs</li>
                    <li>• Cross-metaverse compatibility</li>
                    <li>• AI-powered gaming experience</li>
                    <li>• Production-ready infrastructure</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <h5 className="font-semibold text-white mb-2">Target Market</h5>
                  <ul className="space-y-1 text-sm text-gray-400">
                    <li>• XRPL NFT collectors (primary)</li>
                    <li>• Competitive gamers seeking utility</li>
                    <li>• Metaverse developers & platforms</li>
                    <li>• Web3 gaming enthusiasts</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="section-10" className="mt-8 mb-12">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <span className="text-orange-400">10.</span> Security & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-4">
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6 rounded-lg border border-green-500/20">
                <div className="flex items-start gap-4">
                  <Shield className="w-12 h-12 text-green-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-3">Enterprise-Grade Security</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Wallet Encryption:</strong> AES-256-GCM client-side encryption</li>
                      <li>• <strong>Authentication:</strong> Session-based with IP tracking and user agent validation</li>
                      <li>• <strong>Rate Limiting:</strong> DDoS protection and API throttling</li>
                      <li>• <strong>Audit Logging:</strong> Comprehensive error and transaction logging</li>
                      <li>• <strong>Smart Contract Verification:</strong> All XRPL transactions verified on-chain</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                The platform undergoes continuous security audits and maintains compliance with blockchain gaming best practices. All user funds are secured through XRPL's native escrow system, eliminating custodial risks.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Call to Action */}
        <div className="text-center py-12 border-t border-slate-800">
          <h3 className="text-3xl font-bold text-white mb-4">Join the Revolution</h3>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Be part of the future of cross-metaverse NFT gaming. The Trolls Inquisition is production-ready and actively seeking partners, developers, and players.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
              Get Started Now
            </Button>
            <Button variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-500/10">
              Developer Documentation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
