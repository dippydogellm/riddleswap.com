import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, Trash2 } from "lucide-react";

interface DefenseTabProps {
  city: any;
  catalog: any;
  onRefresh: () => void;
}

export function DefenseTab({ city, catalog, onRefresh }: DefenseTabProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const activateDefenseMutation = useMutation({
    mutationFn: async (systemType: string) => {
      const response = await fetch('/api/riddlecity/defense/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify({ systemType })
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

  const deactivateDefenseMutation = useMutation({
    mutationFn: async (defenseId: number) => {
      const response = await fetch(`/api/riddlecity/defense/${defenseId}`, {
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

  const defenseSystems = catalog || [];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Active Defense Systems</CardTitle>
          <CardDescription>Your city's protective measures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Defense Rating</div>
                <div className="text-3xl font-bold text-red-600">{city.defenseRating}</div>
              </div>
              <Shield className="w-12 h-12 text-red-600" />
            </div>
          </div>

          {city.defenses && city.defenses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {city.defenses.map((defense: any) => (
                <Card key={defense.id} className="border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold capitalize">
                          {defense.systemType.replace(/_/g, ' ')}
                        </h4>
                        <Badge variant="outline" className="mt-1">Level {defense.level}</Badge>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Strength: <span className="font-medium text-red-600">{defense.strength}</span>
                    </div>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deactivateDefenseMutation.mutate(defense.id)}
                      disabled={deactivateDefenseMutation.isPending}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deactivate
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No active defenses. Your city is vulnerable!
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Defense Systems Catalog</CardTitle>
          <CardDescription>Available defensive structures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defenseSystems.map((system: any) => (
              <Card key={system.id} className="border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold">{system.name}</h4>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {system.description}
                  </p>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Credits:</span>
                      <span className="font-medium">{parseFloat(system.creditCost).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Materials:</span>
                      <span className="font-medium">{parseFloat(system.materialCost).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Defense Strength:</span>
                      <span className="font-medium text-red-600">+{system.defenseStrength}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Upkeep:</span>
                      <span className="font-medium">{parseFloat(system.upkeepCost).toLocaleString()}/tick</span>
                    </div>
                    {system.requiredCityLevel > 1 && (
                      <div className="flex justify-between">
                        <span>Requires Level:</span>
                        <span className="font-medium">{system.requiredCityLevel}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => activateDefenseMutation.mutate(system.systemType)}
                    disabled={activateDefenseMutation.isPending || city.cityLevel < system.requiredCityLevel}
                    className="w-full"
                  >
                    {activateDefenseMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Activate
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
