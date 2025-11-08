import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scroll, Loader2, X, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PoliticsTabProps {
  city: any;
  catalog: any;
  onRefresh: () => void;
}

export function PoliticsTab({ city, catalog, onRefresh }: PoliticsTabProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const enactPolicyMutation = useMutation({
    mutationFn: async (policyType: string) => {
      const response = await fetch('/api/riddlecity/policies/enact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify({ policyType })
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

  const rescindPolicyMutation = useMutation({
    mutationFn: async (policyId: number) => {
      const response = await fetch(`/api/riddlecity/policies/${policyId}`, {
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

  const policies = catalog?.policies || [];
  const categories = catalog?.grouped ? Object.keys(catalog.grouped) : [];

  const renderModifier = (value: number | string, label: string, isPercentage: boolean = false) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numValue === 0) return null;

    const displayValue = isPercentage ? `${(numValue * 100).toFixed(0)}%` : numValue.toString();
    const icon = numValue > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
    const color = numValue > 0 ? "text-green-600" : "text-red-600";

    return (
      <div className={`flex items-center gap-1 text-xs ${color}`}>
        {icon}
        <span>{label}: {displayValue}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Active Policies</CardTitle>
          <CardDescription>Current governmental policies in effect</CardDescription>
        </CardHeader>
        <CardContent>
          {city.policies && city.policies.filter((p: any) => p.isActive).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {city.policies.filter((p: any) => p.isActive).map((policy: any) => {
                const policyDef = policies.find((pd: any) => pd.policyType === policy.policyType);
                
                return (
                  <Card key={policy.id} className="border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{policyDef?.name || policy.policyType}</h4>
                          <Badge variant="outline" className="mt-1 capitalize">
                            {policyDef?.category || 'policy'}
                          </Badge>
                        </div>
                      </div>

                      {policyDef && (
                        <div className="space-y-1">
                          {renderModifier(policyDef.happinessModifier, "Happiness")}
                          {renderModifier(policyDef.productionModifier, "Production", true)}
                          {renderModifier(policyDef.upkeepModifier, "Upkeep", true)}
                          {renderModifier(policyDef.populationGrowthModifier, "Growth", true)}
                        </div>
                      )}

                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Enacted {formatDistanceToNow(new Date(policy.enactedAt), { addSuffix: true })}
                      </div>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rescindPolicyMutation.mutate(policy.id)}
                        disabled={rescindPolicyMutation.isPending}
                        className="w-full"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Rescind
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No active policies. Enact some to shape your city!
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>Available Policies</CardTitle>
          <CardDescription>Choose policies to govern your city</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 capitalize">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catalog.grouped[category].map((policy: any) => {
                    const isActive = city.policies?.some(
                      (p: any) => p.policyType === policy.policyType && p.isActive
                    );

                    return (
                      <Card key={policy.id} className="border border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <h4 className="font-semibold">{policy.name}</h4>
                            {isActive && <Badge className="mt-1">Active</Badge>}
                          </div>

                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {policy.description}
                          </p>

                          <div className="space-y-1">
                            {renderModifier(policy.happinessModifier, "Happiness")}
                            {renderModifier(policy.productionModifier, "Production", true)}
                            {renderModifier(policy.upkeepModifier, "Upkeep", true)}
                            {renderModifier(policy.populationGrowthModifier, "Growth", true)}
                          </div>

                          <div className="space-y-1 text-xs border-t pt-2">
                            <div className="flex justify-between">
                              <span>Implementation Cost:</span>
                              <span className="font-medium">{parseFloat(policy.implementationCost).toLocaleString()}</span>
                            </div>
                            {parseFloat(policy.dailyCost) > 0 && (
                              <div className="flex justify-between">
                                <span>Daily Cost:</span>
                                <span className="font-medium">{parseFloat(policy.dailyCost).toLocaleString()}</span>
                              </div>
                            )}
                            {policy.requiredCityLevel > 1 && (
                              <div className="flex justify-between">
                                <span>Requires Level:</span>
                                <span className="font-medium">{policy.requiredCityLevel}</span>
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm"
                            onClick={() => enactPolicyMutation.mutate(policy.policyType)}
                            disabled={
                              enactPolicyMutation.isPending || 
                              isActive || 
                              city.cityLevel < policy.requiredCityLevel
                            }
                            className="w-full"
                          >
                            {enactPolicyMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Scroll className="w-4 h-4 mr-2" />
                                {isActive ? 'Already Active' : 'Enact'}
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
