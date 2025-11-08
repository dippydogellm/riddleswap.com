import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Loader2, Clock, Trash2, ArrowUp, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BuildingsTabProps {
  city: any;
  catalog: any;
  onRefresh: () => void;
}

export function BuildingsTab({ city, catalog, onRefresh }: BuildingsTabProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const placeBuildingMutation = useMutation({
    mutationFn: async (data: { buildingType: string; positionX: number; positionY: number }) => {
      const response = await fetch('/api/riddlecity/buildings/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddlecity/city/my-city'] });
      onRefresh();
    }
  });

  const completeBuildingMutation = useMutation({
    mutationFn: async (buildingId: number) => {
      const response = await fetch(`/api/riddlecity/buildings/${buildingId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        }
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddlecity/city/my-city'] });
      onRefresh();
    }
  });

  const upgradeBuildingMutation = useMutation({
    mutationFn: async (buildingId: number) => {
      const response = await fetch(`/api/riddlecity/buildings/${buildingId}/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        }
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddlecity/city/my-city'] });
      onRefresh();
    }
  });

  const demolishBuildingMutation = useMutation({
    mutationFn: async (buildingId: number) => {
      const response = await fetch(`/api/riddlecity/buildings/${buildingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`
        }
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddlecity/city/my-city'] });
      onRefresh();
    }
  });

  const handlePlaceBuilding = (buildingType: string) => {
    const randomX = Math.floor(Math.random() * 90) + 5;
    const randomY = Math.floor(Math.random() * 90) + 5;
    placeBuildingMutation.mutate({ buildingType, positionX: randomX, positionY: randomY });
  };

  const categories = catalog?.grouped ? Object.keys(catalog.grouped) : [];
  const buildings = catalog?.buildings || [];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Your Buildings</CardTitle>
          <CardDescription>Manage your city's structures</CardDescription>
        </CardHeader>
        <CardContent>
          {city.buildings && city.buildings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {city.buildings.map((building: any) => {
                const canComplete = building.constructionStatus === 'constructing' && 
                  new Date() >= new Date(building.constructionEnds);
                
                return (
                  <Card key={building.id} className="border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold capitalize">{building.buildingType.replace(/_/g, ' ')}</h4>
                          <Badge variant={building.constructionStatus === 'active' ? 'default' : 'secondary'}>
                            {building.constructionStatus}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Lvl {building.level}
                        </div>
                      </div>

                      {building.constructionStatus === 'constructing' && building.constructionEnds && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          {canComplete ? 'Ready!' : formatDistanceToNow(new Date(building.constructionEnds), { addSuffix: true })}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {canComplete && (
                          <Button
                            size="sm"
                            onClick={() => completeBuildingMutation.mutate(building.id)}
                            disabled={completeBuildingMutation.isPending}
                            className="flex-1"
                          >
                            {completeBuildingMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Complete
                              </>
                            )}
                          </Button>
                        )}

                        {building.constructionStatus === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => upgradeBuildingMutation.mutate(building.id)}
                            disabled={upgradeBuildingMutation.isPending}
                            className="flex-1"
                          >
                            <ArrowUp className="w-4 h-4 mr-1" />
                            Upgrade
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => demolishBuildingMutation.mutate(building.id)}
                          disabled={demolishBuildingMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No buildings yet. Start building your city!
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Building Catalog</CardTitle>
          <CardDescription>Choose from available building types</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buildings.map((building: any) => (
                  <Card key={building.id} className="border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-2xl mb-1">{building.icon}</div>
                          <h4 className="font-semibold">{building.name}</h4>
                          <Badge variant="outline" className="mt-1 capitalize">{building.category}</Badge>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {building.description}
                      </p>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Credits:</span>
                          <span className="font-medium">{parseFloat(building.creditCost).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Materials:</span>
                          <span className="font-medium">{parseFloat(building.materialCost).toLocaleString()}</span>
                        </div>
                        {building.requiredCityLevel > 1 && (
                          <div className="flex justify-between">
                            <span>Requires Level:</span>
                            <span className="font-medium">{building.requiredCityLevel}</span>
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handlePlaceBuilding(building.buildingType)}
                        disabled={placeBuildingMutation.isPending || city.cityLevel < building.requiredCityLevel}
                        className="w-full"
                      >
                        {placeBuildingMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Building2 className="w-4 h-4 mr-2" />
                            Build
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {categories.map((cat) => (
              <TabsContent key={cat} value={cat}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catalog.grouped[cat].map((building: any) => (
                    <Card key={building.id} className="border border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-2xl mb-1">{building.icon}</div>
                            <h4 className="font-semibold">{building.name}</h4>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {building.description}
                        </p>

                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Credits:</span>
                            <span className="font-medium">{parseFloat(building.creditCost).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Materials:</span>
                            <span className="font-medium">{parseFloat(building.materialCost).toLocaleString()}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handlePlaceBuilding(building.buildingType)}
                          disabled={placeBuildingMutation.isPending || city.cityLevel < building.requiredCityLevel}
                          className="w-full"
                        >
                          {placeBuildingMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Building2 className="w-4 h-4 mr-2" />
                              Build
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
