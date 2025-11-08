/**
 * The Inquisition Landing Page
 * Professional gaming portal with leaderboards, player search, NFT showcase, and partners
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Trophy, 
  Crown, 
  Search, 
  Users, 
  Swords,
  ShoppingBag,
  ExternalLink,
  Gamepad2,
  ChevronDown,
  ChevronUp,
  Shield,
  Sparkles,
  Coins,
  Hammer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inquisitionTheme, collectionBranding } from "@/lib/inquisition-theme";
import { BackButton } from "@/components/gaming/BackButton";

interface BattleLeaderboardEntry {
  rank: number;
  player_handle: string;
  civilization_name: string | null;
  wins: number;
  win_rate: string;
}

interface CivilizationLeaderboardEntry {
  rank: number;
  civilization_name: string;
  player_handle: string;
  victories: number;
  military_strength: number;
}

export default function InquisitionLanding() {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"player" | "civilization">("player");

  // Fetch top 5 battle leaders
  const { data: battleLeaders } = useQuery<{
    success: boolean;
    data: BattleLeaderboardEntry[];
  }>({
    queryKey: ['/api/battles/leaderboard?limit=5'],
  });

  // Fetch top 5 civilizations
  const { data: civilizationLeaders } = useQuery<{
    success: boolean;
    data: CivilizationLeaderboardEntry[];
  }>({
    queryKey: ['/api/battles/civilizations/leaderboard?limit=5'],
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    if (searchType === "player") {
      window.location.href = `/gamerprofile/${searchQuery.trim()}`;
    } else {
      // Search civilization - navigate to dashboard with search
      window.location.href = `/gaming-dashboard?search=${searchQuery.trim()}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      
      {/* Back Button */}
      <div className="container mx-auto px-4 pt-6">
        <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
      </div>
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-red-500/10 to-blue-900/20 animate-pulse" />
        
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-8">
            {/* Logo */}
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-3xl group-hover:bg-orange-500/30 transition-all duration-500" />
              <img 
                src="/inquisition-logo.png" 
                alt="The Inquisition" 
                className="w-64 h-64 md:w-80 md:h-80 relative z-10 drop-shadow-[0_0_30px_rgba(255,140,0,0.5)] hover:drop-shadow-[0_0_50px_rgba(255,140,0,0.7)] transition-all duration-300"
              />
            </div>

            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-gold-500 bg-clip-text text-transparent">
                THE INQUISITION
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-2xl">
                Enter a medieval world of strategic battles, powerful NFT armies, and legendary civilizations
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Link href="/gaming-dashboard">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-6 text-lg font-bold shadow-[0_0_20px_rgba(255,140,0,0.5)] hover:shadow-[0_0_30px_rgba(255,140,0,0.7)] transition-all duration-300"
                >
                  <Gamepad2 className="w-6 h-6 mr-2" />
                  ENTER GAME DASHBOARD
                </Button>
              </Link>
              <Link href="/whitepaper">
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500 px-8 py-6 text-lg font-bold transition-all duration-300"
                >
                  📄 READ WHITEPAPER
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Preview Dropdown */}
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-slate-900/80 border-orange-500/30 shadow-[0_0_20px_rgba(255,140,0,0.2)]">
          <CardHeader 
            className="cursor-pointer hover:bg-slate-800/50 transition-colors"
            onClick={() => setLeaderboardOpen(!leaderboardOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-gold-500" />
                <CardTitle className="text-2xl text-white">Leaderboards</CardTitle>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                  Top 5
                </Badge>
              </div>
              {leaderboardOpen ? (
                <ChevronUp className="w-6 h-6 text-gray-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-400" />
              )}
            </div>
          </CardHeader>

          {leaderboardOpen && (
            <CardContent className="space-y-6">
              {/* Battle Leaders */}
              <div>
                <h3 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
                  <Swords className="w-5 h-5" />
                  Top Warriors
                </h3>
                <div className="space-y-2">
                  {battleLeaders?.data?.slice(0, 5).map((entry, index) => (
                    <div 
                      key={entry.player_handle}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold
                          ${index === 0 ? 'bg-amber-500 text-white' : ''}
                          ${index === 1 ? 'bg-gray-400 text-white' : ''}
                          ${index === 2 ? 'bg-orange-600 text-white' : ''}
                          ${index > 2 ? 'bg-slate-600 text-gray-300' : ''}
                        `}>
                          #{entry.rank}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {entry.civilization_name || entry.player_handle}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {entry.wins} wins • {entry.win_rate}% win rate
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Civilization Leaders */}
              <div>
                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Top Civilizations
                </h3>
                <div className="space-y-2">
                  {civilizationLeaders?.data?.slice(0, 5).map((entry, index) => (
                    <div 
                      key={entry.civilization_name}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold
                          ${index === 0 ? 'bg-amber-500 text-white' : ''}
                          ${index === 1 ? 'bg-gray-400 text-white' : ''}
                          ${index === 2 ? 'bg-orange-600 text-white' : ''}
                          ${index > 2 ? 'bg-slate-600 text-gray-300' : ''}
                        `}>
                          #{entry.rank}
                        </div>
                        <div>
                          <p className="text-white font-medium">{entry.civilization_name}</p>
                          <p className="text-gray-400 text-sm">
                            @{entry.player_handle} • {entry.victories}V • {entry.military_strength} power
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Link href="/inquisition-gaming">
                <Button variant="outline" className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                  View Full Leaderboards
                </Button>
              </Link>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Player & Civilization Search */}
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-slate-900/80 border-orange-500/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Search className="w-6 h-6 text-orange-400" />
              <CardTitle className="text-2xl text-white">Player & Civilization Search</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-400">
              Search for players by handle or find civilizations to view their stats, battle history, and achievements
            </p>
            
            <div className="flex gap-2 mb-4">
              <Button
                variant={searchType === "player" ? "default" : "outline"}
                onClick={() => setSearchType("player")}
                className={searchType === "player" ? "bg-orange-500 hover:bg-orange-600" : "border-orange-500/50 text-orange-400"}
              >
                <Users className="w-4 h-4 mr-2" />
                Player
              </Button>
              <Button
                variant={searchType === "civilization" ? "default" : "outline"}
                onClick={() => setSearchType("civilization")}
                className={searchType === "civilization" ? "bg-blue-500 hover:bg-blue-600" : "border-blue-500/50 text-blue-400"}
              >
                <Crown className="w-4 h-4 mr-2" />
                Civilization
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder={searchType === "player" ? "Enter player handle..." : "Enter civilization name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button 
                onClick={handleSearch}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NFT Collections Showcase */}
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-slate-900/80 border-orange-500/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-gold-500" />
              <CardTitle className="text-2xl text-white">NFT Collections</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-6">
              Build your army with powerful NFTs from our four legendary collections
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* The Inquisition */}
              <CollectionCard
                name="The Inquisition"
                icon={Shield}
                gradient="from-red-600 to-orange-600"
                role="Army"
                description="Military might and battlefield dominance"
                marketplaceUrl="/nft-marketplace"
              />

              {/* The Inquiry */}
              <CollectionCard
                name="The Inquiry"
                icon={Crown}
                gradient="from-yellow-600 to-amber-600"
                role="God-like"
                description="Divine powers and ultimate authority"
                marketplaceUrl="/nft-marketplace"
              />

              {/* The Lost Emporium */}
              <CollectionCard
                name="The Lost Emporium"
                icon={Hammer}
                gradient="from-amber-600 to-orange-600"
                role="Weapons"
                description="Forge legendary weapons"
                marketplaceUrl="/nft-marketplace"
              />

              {/* Dante's Aurum */}
              <CollectionCard
                name="DANTES AURUM"
                icon={Sparkles}
                gradient="from-purple-600 to-pink-600"
                role="Religion"
                description="Harness spiritual power"
                marketplaceUrl="/nft-marketplace"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Section */}
      <div className="container mx-auto px-4 py-8 pb-16">
        <Card className="bg-slate-900/80 border-orange-500/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <CardTitle className="text-2xl text-white">Our Partners</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-6">
              Collaborating with leading projects in the XRPL ecosystem
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <PartnerCard
                name="RiddleSwap"
                description="Multi-chain DeFi trading platform"
                url="https://riddleswap.com"
                logo="/inquisition-logo.png"
              />
              <PartnerCard
                name="XRPL Foundation"
                description="Supporting the XRPL ecosystem"
                url="https://xrpl.org"
                logo="/inquisition-card.png"
              />
              <PartnerCard
                name="Your Project"
                description="Become a partner today"
                url="mailto:partnerships@riddleswap.com"
                logo="/inquisition-logo.png"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto px-4 pb-16 text-center">
        <Link href="/inquisition-gaming">
          <Button 
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-12 py-6 text-xl font-bold shadow-[0_0_30px_rgba(255,140,0,0.5)] hover:shadow-[0_0_50px_rgba(255,140,0,0.7)] transition-all duration-300"
          >
            <Swords className="w-6 h-6 mr-2" />
            START YOUR JOURNEY
          </Button>
        </Link>
      </div>
    </div>
  );
}

// Collection Card Component
interface CollectionCardProps {
  name: string;
  icon: any;
  gradient: string;
  role: string;
  description: string;
  marketplaceUrl: string;
}

function CollectionCard({ name, icon: Icon, gradient, role, description, marketplaceUrl }: CollectionCardProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-orange-500/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,140,0,0.3)]">
      <CardContent className="p-6 space-y-4">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
          <Badge className="bg-slate-700 text-gray-300 text-xs">{role}</Badge>
        </div>
        <p className="text-sm text-gray-400">{description}</p>
        <Link href={marketplaceUrl}>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
          >
            View Collection
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Partner Card Component
interface PartnerCardProps {
  name: string;
  description: string;
  url: string;
  logo: string;
}

function PartnerCard({ name, description, url, logo }: PartnerCardProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all duration-300">
      <CardContent className="p-6 space-y-4">
        <img src={logo} alt={name} className="w-16 h-16 rounded-full mx-auto" />
        <div className="text-center">
          <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
          >
            Visit Website
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
