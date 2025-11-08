import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Book, FileText } from "lucide-react";

const DOCS = [
  {
    id: "platform-overview",
    title: "Platform Overview",
    description: "Comprehensive introduction to RiddleSwap's vision, architecture, and ecosystem",
    icon: "🌐"
  },
  {
    id: "wallet-walletconnect",
    title: "Wallet & WalletConnect",
    description: "Multi-chain wallet management and external wallet integration",
    icon: "👛"
  },
  {
    id: "multi-chain-swap",
    title: "Multi-Chain Swap System",
    description: "Advanced DEX aggregation across XRPL, EVM chains & Solana",
    icon: "🔄"
  },
  {
    id: "cross-chain-bridge",
    title: "Cross-Chain Bridge",
    description: "Seamless asset transfers between blockchains",
    icon: "🌉"
  },
  {
    id: "nft-marketplace",
    title: "NFT Marketplace",
    description: "XRPL XLS-20 brokered sales & project launchpad",
    icon: "🎨"
  },
  {
    id: "token-scanner",
    title: "Token Scanner",
    description: "Real-time token data & market analysis",
    icon: "📊"
  },
  {
    id: "developer-tools",
    title: "Developer Tools",
    description: "APIs, webhooks & integration guides",
    icon: "🛠️"
  },
  {
    id: "oracle-social-media",
    title: "Oracle Social Media System",
    description: "AI-powered automation, news feeds & community engagement",
    icon: "🤖"
  },
  {
    id: "gaming",
    title: "The Trolls Inquisition",
    description: "NFT gaming battle system with AI, squadrons, alliances & tournaments",
    icon: "⚔️",
    isSpecial: true
  }
];

export default function Documentation() {
  const [location, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Book className="w-12 h-12 text-blue-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Documentation
            </h1>
          </div>
          <p className="text-gray-300 text-lg max-w-3xl mx-auto">
            Comprehensive technical documentation for the RiddleSwap multi-chain DeFi platform
          </p>
        </div>

        {/* Documentation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {DOCS.map((doc) => (
            <Card 
              key={doc.id}
              className={`bg-slate-900/80 ${
                doc.isSpecial 
                  ? 'border-orange-500/50 hover:border-orange-400/70' 
                  : 'border-blue-500/30 hover:border-blue-400/50'
              } transition-all cursor-pointer group`}
              onClick={() => doc.id === 'gaming' ? navigate('/whitepaper') : navigate(`/docs/${doc.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-4xl">{doc.icon}</span>
                  <FileText className={`w-5 h-5 ${doc.isSpecial ? 'text-orange-400' : 'text-blue-400'} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
                <CardTitle className={`text-xl text-white ${doc.isSpecial ? 'group-hover:text-orange-400' : 'group-hover:text-blue-400'} transition-colors`}>
                  {doc.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">
                  {doc.description}
                </p>
                <Button 
                  className={`w-full mt-4 ${
                    doc.isSpecial 
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    doc.id === 'gaming' ? navigate('/whitepaper') : navigate(`/docs/${doc.id}`);
                  }}
                >
                  Read Documentation
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Resources */}
        <Card className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  The Trolls Inquisition White Paper
                </h3>
                <p className="text-gray-300">
                  Technical documentation for cross-metaverse NFT gaming integration
                </p>
              </div>
              <Button 
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 px-8"
                onClick={() => navigate('/whitepaper')}
              >
                Read Gaming White Paper
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-12 text-gray-400">
          <p className="text-sm">
            Documentation Version 1.0 | Last Updated: October 2025
          </p>
          <p className="text-xs mt-2">
            For technical support or questions, please contact our development team
          </p>
        </div>
      </div>
    </div>
  );
}
