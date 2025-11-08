import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Recharts removed to fix React hooks issue
import { 
  Coins, 
  TrendingUp, 
  Users, 
  Building, 
  Palette, 
  Gift, 
  Brain, 
  Castle, 
  Wand2, 
  Search,
  Calendar,
  DollarSign
} from 'lucide-react';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Revenue sources data
const revenueSources = [
  { name: 'Platform Fees', icon: DollarSign, color: '#8b5cf6' },
  { name: 'Subscriptions', icon: Users, color: '#06b6d4' },
  { name: 'Advertising', icon: Building, color: '#10b981' },
  { name: 'RiddlePad Revenue', icon: TrendingUp, color: '#f59e0b' },
  { name: 'NFT Income', icon: Palette, color: '#ef4444' },
];

// General revenue distribution
const generalRevenue = [
  { name: 'Development & Team', value: 50, color: '#8b5cf6' },
  { name: 'NFT Holders', value: 50, color: '#06b6d4' }
];

// NFT Collection data
const nftCollections = [
  { 
    name: 'The Inquiry', 
    icon: Brain,
    totalPercent: 20, 
    nftCount: 123, 
    perNftPercent: 0.1626,
    emoji: '🧠'
  },
  { 
    name: 'The Lost Emporium', 
    icon: Castle,
    totalPercent: 2.5, 
    nftCount: 123, 
    perNftPercent: 0.0203,
    emoji: '🏛️'
  },
  { 
    name: 'Dante Aurum', 
    icon: Wand2,
    totalPercent: 2.5, 
    nftCount: 42, 
    perNftPercent: 0.0595,
    emoji: '🧙'
  },
  { 
    name: 'Under The Bridge', 
    icon: DollarSign, // Using DollarSign instead of Bridge
    totalPercent: 15, 
    nftCount: 1230, 
    perNftPercent: 0.0122,
    emoji: '🌉'
  },
  { 
    name: 'The Inquisition', 
    icon: Search,
    totalPercent: 5, 
    nftCount: 3210, 
    perNftPercent: 0.0016,
    emoji: '🕵️'
  },
  { 
    name: 'Riddle Drop', 
    icon: Gift,
    totalPercent: 5, 
    nftCount: 1, 
    perNftPercent: 5.0000,
    emoji: '🎁'
  },
  { 
    name: 'The Shark', 
    icon: TrendingUp, // Using TrendingUp instead of Shark
    totalPercent: 0, 
    nftCount: 0, 
    perNftPercent: 0,
    emoji: '🦈'
  }
];

// Royalty data for each collection
const royaltyBreakdowns = {
  'The Inquiry': [
    { recipient: 'Development & Team', totalPercent: 50, nftCount: null, perNftPercent: null },
    { recipient: 'The Inquiry', totalPercent: 50, nftCount: 123, perNftPercent: 0.4065 }
  ],
  'The Lost Emporium': [
    { recipient: 'Development & Team', totalPercent: 50, nftCount: null, perNftPercent: null },
    { recipient: 'The Inquiry', totalPercent: 20, nftCount: 123, perNftPercent: 0.1626 },
    { recipient: 'The Lost Emporium', totalPercent: 25, nftCount: 123, perNftPercent: 0.2033 },
    { recipient: 'Dante Aurum', totalPercent: 5, nftCount: 42, perNftPercent: 0.1190 }
  ],
  'Dante Aurum': [
    { recipient: 'Development & Team', totalPercent: 50, nftCount: null, perNftPercent: null },
    { recipient: 'The Inquiry', totalPercent: 20, nftCount: 123, perNftPercent: 0.1626 },
    { recipient: 'The Lost Emporium', totalPercent: 5, nftCount: 123, perNftPercent: 0.0407 },
    { recipient: 'Dante Aurum', totalPercent: 25, nftCount: 42, perNftPercent: 0.5952 }
  ],
  'Under The Bridge': [
    { recipient: 'Development & Team', totalPercent: 50, nftCount: null, perNftPercent: null },
    { recipient: 'Under The Bridge', totalPercent: 30, nftCount: 1230, perNftPercent: 0.0244 },
    { recipient: 'The Inquiry', totalPercent: 20, nftCount: 123, perNftPercent: 0.1626 }
  ],
  'The Inquisition': [
    { recipient: 'Development & Team', totalPercent: 60, nftCount: null, perNftPercent: null },
    { recipient: 'The Inquiry', totalPercent: 10, nftCount: 123, perNftPercent: 0.0813 },
    { recipient: 'The Inquisition', totalPercent: 30, nftCount: 3210, perNftPercent: 0.0093 }
  ]
};

export default function RewardsPage() {
  const [selectedCollection, setSelectedCollection] = useState<string>('The Inquiry');

  const activeCollections = nftCollections.filter(collection => collection.totalPercent > 0);
  const pieData = activeCollections.map((collection, index) => ({
    name: collection.name,
    value: collection.totalPercent,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Coins className="h-8 w-8 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🧩 Riddle Rewards Breakdown
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Discover how rewards are distributed across our ecosystem. All rewards are paid out in RDL tokens 
            once monthly with a 24-hour collection window. Uncollected rewards are burnt!
          </p>
        </div>

        {/* How Rewards Work */}
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              💰 How Rewards Work
            </CardTitle>
            <CardDescription>
              Rewards come from five main sources across the RiddleSwap ecosystem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {revenueSources.map((source, index) => (
                <div 
                  key={source.name}
                  className="p-4 rounded-lg border-2 border-dashed hover:border-solid transition-all duration-300 hover:shadow-lg"
                  style={{ borderColor: source.color }}
                >
                  <source.icon className="h-8 w-8 mb-2" style={{ color: source.color }} />
                  <h3 className="font-semibold text-sm">{source.name}</h3>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-900 dark:text-blue-100">Payout Schedule</span>
              </div>
              <p className="text-blue-800 dark:text-blue-200">
                All rewards are available for collection on the 1st of each month for 24 hours only. Uncollected rewards are permanently burnt. Fixed percentages based on NFT collection ownership.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔁 General Revenue Distribution
              </CardTitle>
              <CardDescription>
                Platform Fees, Subscriptions, Ads, RiddlePad Revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generalRevenue.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {item.value}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 NFT Holder Distribution
              </CardTitle>
              <CardDescription>
                Breakdown of the 50% allocated to NFT holders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pieData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {item.value}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-500" 
                        style={{ 
                          backgroundColor: item.color,
                          width: `${item.value}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* NFT Collections Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 NFT Holder Breakdown
            </CardTitle>
            <CardDescription>
              Detailed breakdown of rewards per NFT collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">NFT Collection</th>
                    <th className="text-right p-3 font-semibold">Total %</th>
                    <th className="text-right p-3 font-semibold">NFT Count</th>
                    <th className="text-right p-3 font-semibold">% Per NFT</th>
                  </tr>
                </thead>
                <tbody>
                  {nftCollections.map((collection, index) => (
                    <tr key={collection.name} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{collection.emoji}</span>
                          <span className="font-medium">{collection.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Badge variant={collection.totalPercent > 0 ? "default" : "secondary"}>
                          {collection.totalPercent}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {collection.nftCount > 0 ? collection.nftCount.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <span className={collection.perNftPercent > 0 ? "font-semibold text-green-600" : "text-gray-400"}>
                          {collection.perNftPercent > 0 ? `${collection.perNftPercent.toFixed(4)}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* NFT Royalty Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🖼️ NFT Income (Royalties)
            </CardTitle>
            <CardDescription>
              Each collection has its own royalty split. Scroll down to see all collection breakdowns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {Object.entries(royaltyBreakdowns).map(([collectionName, breakdown]) => (
                <div key={collectionName} className="border rounded-lg p-6 bg-muted/20">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                    {nftCollections.find(c => c.name === collectionName)?.emoji} {collectionName}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold">Recipient</th>
                          <th className="text-right p-3 font-semibold">Total %</th>
                          <th className="text-right p-3 font-semibold">NFT Count</th>
                          <th className="text-right p-3 font-semibold">% Per NFT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="p-3 font-medium">{item.recipient}</td>
                            <td className="p-3 text-right">
                              <Badge variant="outline">{item.totalPercent}%</Badge>
                            </td>
                            <td className="p-3 text-right">
                              {item.nftCount ? item.nftCount.toLocaleString() : '—'}
                            </td>
                            <td className="p-3 text-right">
                              <span className={item.perNftPercent ? "font-semibold text-green-600" : "text-gray-400"}>
                                {item.perNftPercent ? `${item.perNftPercent.toFixed(4)}%` : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">🎯 Ready to Earn Rewards?</h2>
            <p className="text-lg mb-6 opacity-90">
              Start earning passive income by holding NFTs from our premium collections. 
              The more you hold, the more rewards you earn!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="secondary" size="lg" className="text-purple-600">
                Browse NFT Collections
              </Button>
              <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-purple-600">
                Learn More About RDL
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
