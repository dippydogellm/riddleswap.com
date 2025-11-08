import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  DollarSign, 
  TrendingUp,
  Coins,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function RDLTokenPage() {
  // Fetch RDL token data from DexScreener
  const { data: tokenData, isLoading } = useQuery({
    queryKey: ['/api/dexscreener/token/xrpl/rdl.r9xvnzuwzjpdu3na6mkhmkhkjqtrqcrgu9_xrp'],
    queryFn: async () => {
      const response = await fetch('/api/dexscreener/token/xrpl/rdl.r9xvnzuwzjpdu3na6mkhmkhkjqtrqcrgu9_xrp');
      if (!response.ok) throw new Error('Failed to fetch RDL token data');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  const pair = tokenData?.pairs?.[0] || {};
  const priceUsd = pair.priceUsd || '0.049358';
  const priceChange24h = pair.priceChange?.h24 || 5.03;
  const volume24h = pair.volume?.h24 || 277;
  const liquidity = pair.liquidity?.usd || 23000;
  const fdv = pair.fdv || 66000;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-red-500/10 to-purple-500/10" />
        
        <div className="relative container mx-auto px-4 py-16">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Token Logo */}
            <div className="flex-shrink-0">
              <div className="relative group">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-3xl group-hover:bg-orange-500/30 transition-all duration-500" />
                <div className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 relative z-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-2xl border-4 border-white/10">
                  <span className="text-8xl font-bold text-white">RDL</span>
                </div>
              </div>
            </div>

            {/* Right: Token Info */}
            <div className="flex-1 space-y-6">
              <div>
                <Badge className="mb-4 bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  XRPL Token
                </Badge>
                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent mb-4">
                  RDL Token
                </h1>
                <p className="text-xl text-gray-300 leading-relaxed">
                  "What makes a riddle? What makes us ask? Explore the mystery together as we journey through a vibrantly abstract and absurdist tale of the riddle and the blockchain."
                </p>
              </div>

              {/* Price Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-400">Price</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${priceUsd}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span className="text-xs font-medium">{priceChange24h.toFixed(2)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400">24h Volume</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${volume24h.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400">Liquidity</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${liquidity.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-gray-400">FDV</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${fdv.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-gray-400">Market Cap</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      $66K
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-400">Txns (24h)</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      20
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <a href="https://dexscreener.com/xrpl/rdl.r9xvnzuwzjpdu3na6mkhmkhkjqtrqcrgu9_xrp" target="_blank" rel="noopener noreferrer">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                  >
                    <TrendingUp className="w-5 h-5 mr-2" />
                    View on DexScreener
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
                
                <a href="/swap">
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-slate-600 text-white hover:bg-slate-800"
                  >
                    Swap RDL
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Price Chart</h2>
            <div className="w-full h-96 flex items-center justify-center">
              <iframe
                src="https://dexscreener.com/xrpl/rdl.r9xvnzuwzjpdu3na6mkhmkhkjqtrqcrgu9_xrp?embed=1&theme=dark"
                className="w-full h-full rounded-lg"
                title="RDL Price Chart"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About Section */}
      <div className="container mx-auto px-4 py-16 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">About RDL Token</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              RDL is the native utility token of the RiddleSwap ecosystem, powering a multi-chain DeFi platform 
              that facilitates cryptocurrency swaps across XRPL, EVM chains, and Solana.
            </p>
            <p>
              Built on the XRPL with a focus on community, riddles, and blockchain exploration, RDL represents 
              the journey through the abstract and absurdist tale of the riddle and the blockchain.
            </p>
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div>
                <div className="text-sm text-gray-400">Token Address</div>
                <div className="font-mono text-sm text-orange-400">RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
