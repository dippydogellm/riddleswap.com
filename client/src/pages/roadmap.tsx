import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Zap, Rocket, Star } from "lucide-react";

export default function RoadmapPage() {
  const roadmapItems = [
    {
      phase: "Q1 2025",
      title: "Foundation & Core Features",
      status: "completed",
      items: [
        "✅ Multi-chain wallet system (XRPL, EVM, Solana, Bitcoin)",
        "✅ DEX aggregation across all chains",
        "✅ NFT marketplace with cross-chain support",
        "✅ Bridge functionality for seamless transfers",
        "✅ Financial ecosystem (staking, lending, NFT swaps)"
      ]
    },
    {
      phase: "Q2 2025",
      title: "Advanced Trading & Security",
      status: "in-progress",
      items: [
        "🔄 Advanced market making tools",
        "🔄 Copy trading platform",
        "🔄 Enhanced security protocols",
        "⏳ Multi-signature wallet support",
        "⏳ Advanced analytics dashboard"
      ]
    },
    {
      phase: "Q3 2025",
      title: "Mobile & Expansion",
      status: "planned",
      items: [
        "📱 Mobile app release (iOS & Android)",
        "🌍 Additional blockchain integrations",
        "🤖 AI-powered trading assistance",
        "🔗 Cross-chain yield farming",
        "🎮 Gamified trading experience"
      ]
    },
    {
      phase: "Q4 2025",
      title: "Enterprise & Scaling",
      status: "planned",
      items: [
        "🏢 Enterprise API suite",
        "🔧 Developer SDK release",
        "📊 Institutional trading tools",
        "🌐 Global expansion",
        "🚀 Layer 2 scaling solutions"
      ]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "in-progress":
        return <Clock className="h-5 w-5 text-blue-600" />;
      case "planned":
        return <Rocket className="h-5 w-5 text-purple-600" />;
      default:
        return <Star className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
      case "in-progress":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>;
      case "planned":
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Planned</Badge>;
      default:
        return <Badge variant="secondary">Future</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            RiddleSwap Roadmap
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Our journey to becoming the leading multi-chain DeFi platform
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400"></div>

            <div className="space-y-8">
              {roadmapItems.map((item, index) => (
                <div key={index} className="relative">
                  {/* Timeline node */}
                  <div className="absolute left-6 mt-6 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-current flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-current"></div>
                  </div>

                  <Card className="ml-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <div>
                            <CardTitle className="text-xl">{item.title}</CardTitle>
                            <CardDescription className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                              {item.phase}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(item.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {item.items.map((feature, featureIndex) => (
                          <li key={featureIndex} className="text-gray-700 dark:text-gray-300">
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Zap className="h-6 w-6 text-yellow-600" />
                Join Our Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Stay updated with our progress and be the first to know about new features and updates.
              </p>
              <div className="flex justify-center gap-4">
                <Badge variant="outline" className="px-4 py-2">
                  Follow @RiddleSwap
                </Badge>
                <Badge variant="outline" className="px-4 py-2">
                  Join Discord
                </Badge>
                <Badge variant="outline" className="px-4 py-2">
                  Subscribe Newsletter
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
