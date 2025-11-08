import { useDynamicMetadata, GAMING_METADATA } from "@/hooks/use-dynamic-metadata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Crown, Swords, Users, MapPin, Trophy } from "lucide-react";

interface ArmyCivilizationProfileProps {
  armyName: string;
  crestImage: string;
  stats: {
    totalPower: number;
    territories: number;
    activeMembers: number;
    battlesWon: number;
    battlesLost: number;
    rank: number;
  };
  description?: string;
  achievements?: string[];
  territories?: Array<{
    name: string;
    coordinates: string;
    conquered: string;
  }>;
}

export const ArmyCivilizationProfile = ({ 
  armyName, 
  crestImage, 
  stats, 
  description,
  achievements = [],
  territories = []
}: ArmyCivilizationProfileProps) => {
  // Set army civilization metadata with crest image
  useDynamicMetadata(GAMING_METADATA.armyCivilizationProfile(armyName, crestImage));

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-950 dark:via-orange-950 dark:to-red-950">
      {/* Army Header with Crest */}
      <div className="relative bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Army Crest */}
            <div className="relative">
              <div className="w-32 h-32 lg:w-48 lg:h-48 rounded-full border-4 border-white/20 overflow-hidden bg-white/10">
                <img 
                  src={crestImage} 
                  alt={`${armyName} Army Crest`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white rounded-full p-2">
                <Crown className="w-6 h-6" />
              </div>
            </div>
            
            {/* Army Info */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl lg:text-6xl font-bold mb-4">{armyName}</h1>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-6">
                <Badge variant="secondary" className="bg-white/20 text-white">
                  <Shield className="w-4 h-4 mr-2" />
                  Rank #{stats.rank}
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  <Swords className="w-4 h-4 mr-2" />
                  {stats.totalPower} Power
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  <Users className="w-4 h-4 mr-2" />
                  {stats.activeMembers} Members
                </Badge>
              </div>
              {description && (
                <p className="text-lg opacity-90 max-w-2xl">{description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-amber-600" />
              <div className="text-2xl font-bold">{stats.territories}</div>
              <div className="text-sm text-muted-foreground">Territories</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">{stats.battlesWon}</div>
              <div className="text-sm text-muted-foreground">Battles Won</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Swords className="w-8 h-8 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold">{stats.battlesLost}</div>
              <div className="text-sm text-muted-foreground">Battles Lost</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold">{stats.activeMembers}</div>
              <div className="text-sm text-muted-foreground">Active Members</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Achievements */}
          {achievements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-600" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {achievements.map((achievement, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                      <Crown className="w-4 h-4 text-amber-600" />
                      <span>{achievement}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Territory Control */}
          {territories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Controlled Territories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {territories.map((territory, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="font-semibold">{territory.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {territory.coordinates} • Conquered {territory.conquered}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
