import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Castle, Building2, Sofa, Store, Shield, Scroll, Users, TrendingUp, Coins, Share2, Eye, Swords, Image } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CityOverview } from "@/components/riddlecity/CityOverview";
import { BuildingsTab } from "@/components/riddlecity/BuildingsTab";
import { FurnishingsTab } from "@/components/riddlecity/FurnishingsTab";
import { EconomyTab } from "@/components/riddlecity/EconomyTab";
import { DefenseTab } from "@/components/riddlecity/DefenseTab";
import { PoliticsTab } from "@/components/riddlecity/PoliticsTab";
import { CitizensTab } from "@/components/riddlecity/CitizensTab";
import { CreateCityModal } from "@/components/riddlecity/CreateCityModal";
import { ResourceHUD } from "@/components/riddlecity/ResourceHUD";

export default function RiddleCity() {
  const session = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateCity, setShowCreateCity] = useState(false);

  const { data: landOwnershipData, isLoading: landCheckLoading } = useQuery({
    queryKey: ['/api/riddlecity/city/check-land-ownership'],
    enabled: !!session.handle,
  });

  const { data: cityData, isLoading: cityLoading, refetch: refetchCity } = useQuery({
    queryKey: ['/api/riddlecity/city/my-city'],
    enabled: !!session.handle && landOwnershipData?.data?.hasLand,
    retry: 1,
  });

  const { data: buildingCatalog } = useQuery({
    queryKey: ['/api/riddlecity/buildings/catalog'],
    enabled: !!session.handle,
  });

  const { data: furnishingCatalog } = useQuery({
    queryKey: ['/api/riddlecity/furnishings/catalog'],
    enabled: !!session.handle,
  });

  const { data: policyCatalog } = useQuery({
    queryKey: ['/api/riddlecity/policies/catalog'],
    enabled: !!session.handle,
  });

  const { data: defenseCatalog } = useQuery({
    queryKey: ['/api/riddlecity/defense/catalog'],
    enabled: !!session.handle,
  });

  const resourceTickMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/riddlecity/resources/tick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        }
      });
      if (!response.ok) throw new Error('Resource tick failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddlecity/city/my-city'] });
    }
  });

  useEffect(() => {
    if (!cityLoading && !cityData?.data) {
      setShowCreateCity(true);
    }
  }, [cityLoading, cityData]);

  useEffect(() => {
    if (!cityData?.data) return;

    const interval = setInterval(() => {
      resourceTickMutation.mutate();
    }, 300000);

    return () => clearInterval(interval);
  }, [cityData]);

  if (!session.handle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Castle className="w-6 h-6 text-orange-600" />
              Welcome to RiddleCity
            </CardTitle>
            <CardDescription>Please login to build your medieval empire</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (landCheckLoading || cityLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!landOwnershipData?.data?.hasLand) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Castle className="w-8 h-8 text-orange-600" />
              Land Required to Build Your City
            </CardTitle>
            <CardDescription className="text-base">
              You need to own a medieval land plot before you can build RiddleCity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
              <p className="text-amber-900 dark:text-amber-100">
                RiddleCity is built on medieval land plots. Each plot has unique terrain types and sizes that affect your city's development. Purchase a land plot from the marketplace to get started!
              </p>
            </div>
            
            <div className="flex gap-4">
              <Link href="/land/marketplace" className="flex-1">
                <Button className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white">
                  <Store className="w-4 h-4 mr-2" />
                  Visit Land Marketplace
                </Button>
              </Link>
              
              <Link href="/land/marketplace?view=public" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Eye className="w-4 h-4 mr-2" />
                  View Public Lands
                </Button>
              </Link>
            </div>

            <div className="text-sm text-muted-foreground text-center pt-4 border-t">
              Learn more about land plots and city building in the documentation
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cityData?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <CreateCityModal
          open={showCreateCity}
          onClose={() => setShowCreateCity(false)}
          onSuccess={() => {
            setShowCreateCity(false);
            refetchCity();
          }}
          landPlots={landOwnershipData?.data?.landPlots || []}
        />
      </div>
    );
  }

  const city = cityData.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="hidden lg:block w-64 border-r border-orange-200 dark:border-orange-900 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm min-h-screen">
          <div className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Quick Links</h3>
            <Link href="/gaming">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Swords className="w-4 h-4" />
                Gaming Dashboard
              </Button>
            </Link>
            <Link href="/land/marketplace">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Store className="w-4 h-4" />
                Land Marketplace
              </Button>
            </Link>
            <Link href="/inquisition">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Shield className="w-4 h-4" />
                Trolls Inquisition
              </Button>
            </Link>
            <Link href="/nft-marketplace">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Image className="w-4 h-4" />
                NFT Marketplace
              </Button>
            </Link>
            <div className="border-t border-orange-200 dark:border-orange-800 my-4" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">City Sections</h3>
            <Button
              variant={activeTab === "overview" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("overview")}
            >
              <Castle className="w-4 h-4" />
              Overview
            </Button>
            <Button
              variant={activeTab === "buildings" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("buildings")}
            >
              <Building2 className="w-4 h-4" />
              Buildings
            </Button>
            <Button
              variant={activeTab === "furnishings" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("furnishings")}
            >
              <Sofa className="w-4 h-4" />
              Furnishings
            </Button>
            <Button
              variant={activeTab === "economy" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("economy")}
            >
              <Store className="w-4 h-4" />
              Economy
            </Button>
            <Button
              variant={activeTab === "defense" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("defense")}
            >
              <Shield className="w-4 h-4" />
              Defense
            </Button>
            <Button
              variant={activeTab === "politics" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("politics")}
            >
              <Scroll className="w-4 h-4" />
              Politics
            </Button>
            <Button
              variant={activeTab === "citizens" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("citizens")}
            >
              <Users className="w-4 h-4" />
              Citizens
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <Castle className="w-10 h-10 text-orange-600" />
                    {city.cityName}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Level {city.cityLevel} Medieval City
                  </p>
                </div>
            <div className="flex gap-2">
              <Link href={`/riddlecity/city/${session.handle}`}>
                <Button variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">View Public Profile</span>
                </Button>
              </Link>
              <Button
                onClick={() => {
                  const url = `${window.location.origin}/riddlecity/city/${session.handle}`;
                  navigator.clipboard.writeText(url);
                  toast({
                    title: "Link Copied!",
                    description: "City link copied to clipboard. Share it with your friends!",
                  });
                }}
                variant="outline"
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share City</span>
              </Button>
              <Button
                onClick={() => resourceTickMutation.mutate()}
                disabled={resourceTickMutation.isPending}
                variant="outline"
                className="gap-2"
              >
                {resourceTickMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                Collect Resources
              </Button>
            </div>
          </div>

          <ResourceHUD city={city} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-7 w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-orange-200 dark:border-orange-900">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Castle className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="buildings" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Buildings</span>
            </TabsTrigger>
            <TabsTrigger value="furnishings" className="flex items-center gap-2">
              <Sofa className="w-4 h-4" />
              <span className="hidden sm:inline">Furnish</span>
            </TabsTrigger>
            <TabsTrigger value="economy" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Economy</span>
            </TabsTrigger>
            <TabsTrigger value="defense" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Defense</span>
            </TabsTrigger>
            <TabsTrigger value="politics" className="flex items-center gap-2">
              <Scroll className="w-4 h-4" />
              <span className="hidden sm:inline">Politics</span>
            </TabsTrigger>
            <TabsTrigger value="citizens" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Citizens</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CityOverview city={city} onRefresh={refetchCity} />
          </TabsContent>

          <TabsContent value="buildings">
            <BuildingsTab 
              city={city} 
              catalog={buildingCatalog?.data}
              onRefresh={refetchCity}
            />
          </TabsContent>

          <TabsContent value="furnishings">
            <FurnishingsTab
              city={city}
              catalog={furnishingCatalog?.data}
              onRefresh={refetchCity}
            />
          </TabsContent>

          <TabsContent value="economy">
            <EconomyTab
              city={city}
              onRefresh={refetchCity}
            />
          </TabsContent>

          <TabsContent value="defense">
            <DefenseTab
              city={city}
              catalog={defenseCatalog?.data}
              onRefresh={refetchCity}
            />
          </TabsContent>

          <TabsContent value="politics">
            <PoliticsTab
              city={city}
              catalog={policyCatalog?.data}
              onRefresh={refetchCity}
            />
          </TabsContent>

          <TabsContent value="citizens">
            <CitizensTab
              city={city}
              onRefresh={refetchCity}
            />
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
