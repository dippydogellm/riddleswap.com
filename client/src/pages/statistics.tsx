import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Users, Wallet, Activity, DollarSign } from "lucide-react";

export default function StatisticsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            RiddleSwap Statistics
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real-time platform metrics and community statistics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-blue-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">12,847</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">+324 this week</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-green-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">$2.4M</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">+18.2% this month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-purple-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">89,432</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">24h: 1,247</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Chain Distribution
              </CardTitle>
              <CardDescription>Transaction volume by blockchain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span>XRPL</span>
                  <span className="text-sm text-gray-600">45%</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Ethereum</span>
                  <span className="text-sm text-gray-600">28%</span>
                </div>
                <Progress value={28} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Solana</span>
                  <span className="text-sm text-gray-600">17%</span>
                </div>
                <Progress value={17} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Other EVM</span>
                  <span className="text-sm text-gray-600">10%</span>
                </div>
                <Progress value={10} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Platform Growth
              </CardTitle>
              <CardDescription>Key metrics over time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">98.7%</div>
                  <div className="text-sm text-gray-600">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">2.1s</div>
                  <div className="text-sm text-gray-600">Avg Swap Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">0.1%</div>
                  <div className="text-sm text-gray-600">Failed Txs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">247</div>
                  <div className="text-sm text-gray-600">Supported Tokens</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-indigo-600" />
              Financial Ecosystem
            </CardTitle>
            <CardDescription>Staking, lending, and NFT marketplace metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600 mb-2">$847K</div>
                <div className="text-sm text-gray-600 mb-1">Total Staked</div>
                <Badge variant="secondary">10% APY</Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600 mb-2">$234K</div>
                <div className="text-sm text-gray-600 mb-1">Active Loans</div>
                <Badge variant="secondary">72 Positions</Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-rose-600 mb-2">3,429</div>
                <div className="text-sm text-gray-600 mb-1">NFTs Traded</div>
                <Badge variant="secondary">$156K Volume</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
