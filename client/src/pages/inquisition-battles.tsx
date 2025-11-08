import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Swords,
  Trophy,
  Users,
  Zap,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { useSession } from "@/utils/sessionManager";
import { Link } from "wouter";
import { BackButton } from "@/components/gaming/BackButton";

const InquisitionBattles = () => {
  const session = useSession();
  const [activeTab, setActiveTab] = useState("battles");

  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-2 border-purple-600 max-w-md">
          <CardContent className="text-center py-12 space-y-4">
            <Swords className="w-16 h-16 text-gray-600 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Login Required</h2>
            <p className="text-gray-400">You need to login to enter battles</p>
            <Link href="/login">
              <Button className="bg-purple-600 border-2 border-purple-400 hover:bg-purple-700">
                Login Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b-2 border-purple-600">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <Swords className="w-8 h-8 text-red-400" />
                  Battle Arena
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  Challenge warriors and prove your might
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Battle Dashboard */}
          <Card className="bg-red-900 border-2 border-red-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Swords className="w-6 h-6" />
                Battle Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-200">
                Manage your squadrons, create battles, and join tournaments. Full battle system with Oracle AI narration!
              </p>
              <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Features:</span>
                  <span className="text-white">Squadrons, 1v1, Tournaments</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Entry Fee:</span>
                  <span className="text-white">10-1000 XRP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Winner Takes:</span>
                  <span className="text-green-400">80% of pot</span>
                </div>
              </div>
              <Link href="/battle-dashboard">
                <Button className="w-full bg-red-600 border-2 border-red-400 hover:bg-red-700">
                  <Swords className="w-4 h-4 mr-2" />
                  Enter Battle Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Spectate Battles */}
          <Card className="bg-purple-900 border-2 border-purple-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="w-6 h-6" />
                Spectate Live Battles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-200">
                Watch epic battles unfold in real-time! See Oracle AI narration, strategic moves, and battle outcomes live.
              </p>
              <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Features:</span>
                  <span className="text-white">Live updates, AI narration</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Access:</span>
                  <span className="text-white">Free for all</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Battle History:</span>
                  <span className="text-green-400">Full replay available</span>
                </div>
              </div>
              <Link href="/spectate-battles">
                <Button className="w-full bg-purple-600 border-2 border-purple-400 hover:bg-purple-700">
                  <Trophy className="w-4 h-4 mr-2" />
                  Watch Battles
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Alliance Battles */}
          <Card className="bg-blue-900 border-2 border-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-6 h-6" />
                Alliance Battles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-200">
                Form alliances and battle together as a team. Combine your NFT powers for massive advantages!
              </p>
              <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Team Size:</span>
                  <span className="text-white">Up to 20 members</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Format:</span>
                  <span className="text-white">Alliance vs Alliance</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Rewards:</span>
                  <span className="text-green-400">Shared treasury</span>
                </div>
              </div>
              <Link href="/inquisition/alliances">
                <Button className="w-full bg-blue-600 border-2 border-blue-400 hover:bg-blue-700">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Alliances
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Battles */}
          <Card className="bg-amber-900 border-2 border-amber-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="w-6 h-6" />
                AI Opponents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-200">
                Practice against AI opponents powered by The Oracle. Perfect your strategy before challenging real players!
              </p>
              <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Difficulty:</span>
                  <span className="text-white">Easy • Medium • Hard</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Entry Fee:</span>
                  <span className="text-white">Free (practice mode)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Rewards:</span>
                  <span className="text-amber-400">XP & Badges only</span>
                </div>
              </div>
              <Link href="/battle-dashboard">
                <Button className="w-full bg-amber-600 border-2 border-amber-400 hover:bg-amber-700">
                  <Zap className="w-4 h-4 mr-2" />
                  Practice vs AI
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* The Oracle Integration Notice */}
        <Card className="bg-purple-900 border-2 border-purple-600 mt-8">
          <CardContent className="p-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-2">The Oracle Awaits</h3>
            <p className="text-gray-200 mb-4">
              All battles are narrated by The Oracle AI, providing dynamic commentary, strategic insights, and epic storytelling as you fight!
            </p>
            <Link href="/riddleauthor">
              <Button className="bg-purple-600 border-2 border-purple-400 hover:bg-purple-700">
                <Sparkles className="w-4 h-4 mr-2" />
                Consult The Oracle
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InquisitionBattles;
