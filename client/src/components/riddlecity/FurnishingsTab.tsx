import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sofa, Loader2, Trash2 } from "lucide-react";

interface FurnishingsTabProps {
  city: any;
  catalog: any;
  onRefresh: () => void;
}

export function FurnishingsTab({ city, catalog, onRefresh }: FurnishingsTabProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");

  const placeFurnishingMutation = useMutation({
    mutationFn: async (data: { buildingId: number; furnishingType: string; positionX: number; positionY: number }) => {
      const response = await fetch('/api/riddlecity/furnishings/place', {
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

  const removeFurnishingMutation = useMutation({
    mutationFn: async (furnishingId: number) => {
      const response = await fetch(`/api/riddlecity/furnishings/${furnishingId}`, {
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

  const handlePlaceFurnishing = (furnishingType: string) => {
    if (!selectedBuilding) return;
    
    const randomX = Math.floor(Math.random() * 8) + 1;
    const randomY = Math.floor(Math.random() * 8) + 1;
    
    placeFurnishingMutation.mutate({
      buildingId: parseInt(selectedBuilding),
      furnishingType,
      positionX: randomX,
      positionY: randomY
    });
  };

  const activeBuildings = city.buildings?.filter((b: any) => b.constructionStatus === 'active') || [];
  const furnishings = catalog?.furnishings || [];
  const categories = catalog?.grouped ? Object.keys(catalog.grouped) : [];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Placed Furnishings</CardTitle>
          <CardDescription>Decorations and equipment in your buildings</CardDescription>
        </CardHeader>
        <CardContent>
          {city.furnishings && city.furnishings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {city.furnishings.map((furnishing: any) => (
                <Card key={furnishing.id} className="border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold capitalize">
                          {furnishing.furnishingType.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Position: ({furnishing.positionX}, {furnishing.positionY})
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeFurnishingMutation.mutate(furnishing.id)}
                      disabled={removeFurnishingMutation.isPending}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No furnishings placed yet
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Furnishing Catalog</CardTitle>
          <CardDescription>Add furniture and decorations to your buildings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Building:</label>
            <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a building..." />
              </SelectTrigger>
              <SelectContent>
                {activeBuildings.map((building: any) => (
                  <SelectItem key={building.id} value={building.id.toString()}>
                    {building.buildingType.replace(/_/g, ' ')} (Level {building.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {furnishings.map((furnishing: any) => (
              <Card key={furnishing.id} className="border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <div className="text-2xl mb-1">{furnishing.icon}</div>
                    <h4 className="font-semibold">{furnishing.name}</h4>
                    <Badge variant="outline" className="mt-1 capitalize">{furnishing.category}</Badge>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {furnishing.description}
                  </p>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span className="font-medium">{parseFloat(furnishing.creditCost).toLocaleString()} credits</span>
                    </div>
                    {furnishing.happinessBonus > 0 && (
                      <div className="flex justify-between">
                        <span>Happiness:</span>
                        <span className="font-medium text-green-600">+{furnishing.happinessBonus}</span>
                      </div>
                    )}
                    {parseFloat(furnishing.productionBonus) > 0 && (
                      <div className="flex justify-between">
                        <span>Production:</span>
                        <span className="font-medium text-blue-600">+{(parseFloat(furnishing.productionBonus) * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handlePlaceFurnishing(furnishing.furnishingType)}
                    disabled={placeFurnishingMutation.isPending || !selectedBuilding}
                    className="w-full"
                  >
                    {placeFurnishingMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sofa className="w-4 h-4 mr-2" />
                        Place
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
