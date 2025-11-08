import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Castle, 
  Building2, 
  Sofa,
  Store,
  Shield,
  Scroll,
  Users,
  TrendingUp,
  Coins,
  Zap,
  Wheat,
  Hammer,
  Heart,
  ArrowLeft,
  User,
  MapPin,
  Award,
  Star,
  ChevronRight
} from "lucide-react";
import { useParams, Link } from "wouter";
import { BackButton } from "@/components/gaming/BackButton";

interface City {
  id: number;
  userHandle: string;
  cityName: string;
  cityDescription: string | null;
  cityImage: string | null;
  landPlotId: number | null;
  plotSize: number;
  credits: string;
  materials: string;
  energy: string;
  food: string;
  population: number;
  populationCapacity: number;
  happiness: number;
  totalBuildings: number;
  economicValue: string;
  defenseRating: number;
  cityLevel: number;
  experiencePoints: number;
  linkedProjectId: string | null;
  contributeToProject: boolean;
  economySharePercent: number;
  foundedAt: string;
  lastActive: string;
  buildings: any[];
  furnishings: any[];
  shops: any[];
  defenses: any[];
  policies: any[];
  citizens: any[];
}

const RiddleCityPublicPage = () => {
  const { handle } = useParams<{ handle: string }>();
  const [activeTab, setActiveTab] = useState<"overview" | "buildings" | "economy" | "defense">("overview");

  const { data: cityData, isLoading, error } = useQuery<{ success: boolean; data: City; error?: string; message?: string }>({
    queryKey: [`/api/riddlecity/city/public/${handle}`],
    enabled: !!handle,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Castle className="w-12 h-12 animate-pulse text-orange-600 mx-auto mb-4" />
            <p className="text-lg text-slate-600 dark:text-slate-400">Loading city...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !cityData?.success || !cityData?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Castle className="w-6 h-6" />
              City Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              {cityData?.message || `No city found for user @${handle}`}
            </p>
            <div className="flex gap-2">
              <BackButton to="/gaming-dashboard" label="Back to Dashboard" theme="light" />
              <Link href="/riddlecity">
                <Button variant="outline" className="gap-2">
                  <Castle className="w-4 h-4" />
                  Explore RiddleCity
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const city = cityData.data;
  const activeBuildings = city.buildings?.filter(b => b.constructionStatus === 'active') || [];
  const activeShops = city.shops?.filter(s => s.isActive) || [];
  const activeDefenses = city.defenses?.filter(d => d.isActive) || [];
  const activePolicies = city.policies?.filter(p => p.isActive) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-900 to-red-900 border-b-4 border-amber-600 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <BackButton to="/gaming-dashboard" label="Back to Dashboard" theme="dark" />
          </div>
          
          {/* City Owner Banner */}
          <div className="bg-black/30 backdrop-blur-sm border-2 border-amber-500 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-amber-300" />
              <div>
                <p className="text-sm text-amber-300 font-medium">This city is owned by</p>
                <Link href={`/profile/${city.userHandle}`}>
                  <a className="text-2xl font-bold text-white hover:text-amber-300 transition-colors">
                    @{city.userHandle}
                  </a>
                </Link>
              </div>
            </div>
          </div>

          {/* City Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-5xl font-bold text-white flex items-center gap-3 mb-2">
                <Castle className="w-12 h-12 text-amber-300" />
                {city.cityName}
              </h1>
              {city.cityDescription && (
                <p className="text-lg text-amber-100 max-w-2xl">{city.cityDescription}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Badge className="bg-amber-600 text-white px-3 py-1 text-sm">
                  <Award className="w-4 h-4 mr-1" />
                  Level {city.cityLevel}
                </Badge>
                <Badge className="bg-purple-600 text-white px-3 py-1 text-sm">
                  <Star className="w-4 h-4 mr-1" />
                  {city.experiencePoints} XP
                </Badge>
                <Badge className="bg-blue-600 text-white px-3 py-1 text-sm">
                  <MapPin className="w-4 h-4 mr-1" />
                  {city.plotSize}㎡ Plot
                </Badge>
              </div>
            </div>
            {city.cityImage && (
              <img 
                src={city.cityImage} 
                alt={city.cityName}
                className="w-48 h-48 object-cover rounded-lg border-4 border-amber-500 shadow-xl"
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Resource Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 border-2 border-amber-600">
            <CardContent className="p-6 text-center">
              <Coins className="w-8 h-8 text-amber-600 dark:text-amber-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                {parseFloat(city.credits).toLocaleString()}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">Credits</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-2 border-blue-600">
            <CardContent className="p-6 text-center">
              <Zap className="w-8 h-8 text-blue-600 dark:text-blue-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {parseFloat(city.energy).toLocaleString()}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">Energy</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-2 border-green-600">
            <CardContent className="p-6 text-center">
              <Wheat className="w-8 h-8 text-green-600 dark:text-green-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                {parseFloat(city.food).toLocaleString()}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300 mt-1">Food</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-2 border-gray-600">
            <CardContent className="p-6 text-center">
              <Hammer className="w-8 h-8 text-gray-600 dark:text-gray-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {parseFloat(city.materials).toLocaleString()}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">Materials</div>
            </CardContent>
          </Card>
        </div>

        {/* City Stats */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <CardContent className="p-6 text-center">
              <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {city.population}/{city.populationCapacity}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Population</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <CardContent className="p-6 text-center">
              <Heart className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {city.happiness}%
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Happiness</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <CardContent className="p-6 text-center">
              <Building2 className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {city.totalBuildings}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Buildings</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <CardContent className="p-6 text-center">
              <Shield className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {city.defenseRating}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Defense</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {parseFloat(city.economicValue).toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Economy</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800 p-2 rounded-lg border-2 border-orange-300 dark:border-orange-700">
          <Button
            onClick={() => setActiveTab("overview")}
            variant={activeTab === "overview" ? "default" : "ghost"}
            className={activeTab === "overview" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            <Castle className="w-4 h-4 mr-2" />
            Overview
          </Button>
          <Button
            onClick={() => setActiveTab("buildings")}
            variant={activeTab === "buildings" ? "default" : "ghost"}
            className={activeTab === "buildings" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Buildings ({activeBuildings.length})
          </Button>
          <Button
            onClick={() => setActiveTab("economy")}
            variant={activeTab === "economy" ? "default" : "ghost"}
            className={activeTab === "economy" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            <Store className="w-4 h-4 mr-2" />
            Economy ({activeShops.length})
          </Button>
          <Button
            onClick={() => setActiveTab("defense")}
            variant={activeTab === "defense" ? "default" : "ghost"}
            className={activeTab === "defense" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            <Shield className="w-4 h-4 mr-2" />
            Defense ({activeDefenses.length})
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="bg-white dark:bg-slate-800 border-2 border-orange-300 dark:border-orange-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-400">
                  <Castle className="w-5 h-5" />
                  City Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Founded</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {new Date(city.foundedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Last Active</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {new Date(city.lastActive).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Sofa className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {city.furnishings?.length || 0}
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">Furnishings</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Scroll className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {activePolicies.length}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Active Policies</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {city.citizens?.length || 0}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">NFT Citizens</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NFT Citizens */}
            {city.citizens && city.citizens.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 border-2 border-purple-300 dark:border-purple-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-400">
                    <Users className="w-5 h-5" />
                    NFT Citizens ({city.citizens.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {city.citizens.map((citizen: any) => (
                      <div key={citizen.id} className="border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {citizen.assignedRole || 'Citizen'}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              NFT #{citizen.nftId || citizen.id}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "buildings" && (
          <Card className="bg-white dark:bg-slate-800 border-2 border-orange-300 dark:border-orange-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-400">
                <Building2 className="w-5 h-5" />
                Active Buildings ({activeBuildings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeBuildings.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">No active buildings yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeBuildings.map((building: any) => (
                    <div key={building.id} className="border-2 border-orange-200 dark:border-orange-800 rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-lg text-slate-900 dark:text-white">
                            {building.customName || building.buildingType}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Level {building.level}
                          </p>
                        </div>
                        <Badge className="bg-green-600 text-white">Active</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Position:</span>
                          <span className="text-slate-900 dark:text-white">
                            ({building.positionX}, {building.positionY})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Efficiency:</span>
                          <span className="text-green-600 dark:text-green-400">
                            {building.efficiency}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "economy" && (
          <Card className="bg-white dark:bg-slate-800 border-2 border-green-300 dark:border-green-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-400">
                <Store className="w-5 h-5" />
                Active Shops ({activeShops.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeShops.length === 0 ? (
                <div className="text-center py-12">
                  <Store className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">No active shops yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {activeShops.map((shop: any) => (
                    <div key={shop.id} className="border-2 border-green-200 dark:border-green-800 rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-lg text-slate-900 dark:text-white">
                            {shop.shopName}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {shop.shopType}
                          </p>
                        </div>
                        <Badge className="bg-green-600 text-white">
                          <Coins className="w-3 h-3 mr-1" />
                          {parseFloat(shop.monthlyRevenue || '0').toLocaleString()}
                        </Badge>
                      </div>
                      {shop.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {shop.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <MapPin className="w-3 h-3" />
                        Building #{shop.buildingId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "defense" && (
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-800 border-2 border-blue-300 dark:border-blue-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-400">
                  <Shield className="w-5 h-5" />
                  Defense Systems ({activeDefenses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeDefenses.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">No defense systems installed</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeDefenses.map((defense: any) => (
                      <div key={defense.id} className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-bold text-lg text-slate-900 dark:text-white">
                            {defense.defenseType}
                          </p>
                          <Badge className="bg-blue-600 text-white">Level {defense.level}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <MapPin className="w-3 h-3" />
                          Building #{defense.buildingId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Policies */}
            {activePolicies.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 border-2 border-purple-300 dark:border-purple-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-400">
                    <Scroll className="w-5 h-5" />
                    Active Policies ({activePolicies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activePolicies.map((policy: any) => (
                      <div key={policy.id} className="border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Scroll className="w-5 h-5 text-purple-600" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {policy.policyType}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Enacted {new Date(policy.enactedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Visit Owner's Profile */}
        <Card className="mt-8 bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border-2 border-orange-400 dark:border-orange-700">
          <CardContent className="p-6 text-center">
            <p className="text-lg text-slate-700 dark:text-slate-300 mb-4">
              Want to learn more about the city owner?
            </p>
            <Link href={`/profile/${city.userHandle}`}>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                <User className="w-4 h-4" />
                Visit @{city.userHandle}'s Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RiddleCityPublicPage;
