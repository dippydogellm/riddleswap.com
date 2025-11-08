import { Castle, Map, Zap, Building2, TrendingUp, Coins, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LandMarketplace } from "./LandMarketplace";
import { useState } from "react";

interface CivilizationCommandProps {
  civilization: {
    civilization_name?: string;
    military_strength: number;
    culture_level: number;
    research_level: number;
    total_wealth: string;
    reputation: number;
    wonders_built: number;
  };
  theme: 'light' | 'dark';
}

export function CivilizationCommand({ civilization, theme }: CivilizationCommandProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-purple-500/30' : 'bg-white border-purple-300'} backdrop-blur-sm transition-all duration-300 hover:shadow-2xl`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-lg sm:text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
          <Castle className="w-5 h-5 text-purple-400" />
          Civilization Command
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="land">
              <MapPin className="w-4 h-4 mr-1" />
              Land Plots
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
        {/* Power Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Military Strength */}
          <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Military</span>
              <span className="text-sm font-bold text-red-400">{civilization.military_strength}</span>
            </div>
            <Progress value={Math.min(civilization.military_strength / 100, 100)} className="h-2" />
          </div>

          {/* Culture Level */}
          <div className={`${theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'} border rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Culture</span>
              <span className="text-sm font-bold text-purple-400">{civilization.culture_level}</span>
            </div>
            <Progress value={Math.min(civilization.culture_level / 100, 100)} className="h-2" />
          </div>

          {/* Research Level */}
          <div className={`${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Research</span>
              <span className="text-sm font-bold text-blue-400">{civilization.research_level}</span>
            </div>
            <Progress value={Math.min(civilization.research_level / 100, 100)} className="h-2" />
          </div>
        </div>

        {/* Resources & Buildings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Wealth */}
          <div className={`${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-3 flex items-center gap-3`}>
            <Coins className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Wealth</p>
              <p className="text-sm font-bold text-green-400">{civilization.total_wealth} XRP</p>
            </div>
          </div>

          {/* Reputation */}
          <div className={`${theme === 'dark' ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3 flex items-center gap-3`}>
            <TrendingUp className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Reputation</p>
              <p className="text-sm font-bold text-amber-400">{civilization.reputation}</p>
            </div>
          </div>

          {/* Wonders */}
          <div className={`${theme === 'dark' ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'} border rounded-lg p-3 flex items-center gap-3`}>
            <Building2 className="w-8 h-8 text-indigo-400 flex-shrink-0" />
            <div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Wonders</p>
              <p className="text-sm font-bold text-indigo-400">{civilization.wonders_built}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-purple-500/20 border-purple-500 text-purple-400"
              onClick={() => setActiveTab('land')}
            >
              <Map className="w-3 h-3 mr-1" />
              Manage Land
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-blue-500/20 border-blue-500 text-blue-400">
              <Building2 className="w-3 h-3 mr-1" />
              Build
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-amber-500/20 border-amber-500 text-amber-400">
              <Zap className="w-3 h-3 mr-1" />
              Upgrade
            </Badge>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="land" className="mt-4">
            <LandMarketplace theme={theme} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
