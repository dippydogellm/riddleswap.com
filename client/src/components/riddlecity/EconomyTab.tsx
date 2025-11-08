import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Store, Loader2, Plus, Edit, Trash2 } from "lucide-react";

interface EconomyTabProps {
  city: any;
  onRefresh: () => void;
}

export function EconomyTab({ city, onRefresh }: EconomyTabProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [shopName, setShopName] = useState("");
  const [shopType, setShopType] = useState("market");
  const [shopDescription, setShopDescription] = useState("");

  const createShopMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/riddlecity/shops/create', {
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
      setShowCreateShop(false);
      setShopName("");
      setShopDescription("");
    }
  });

  const deleteShopMutation = useMutation({
    mutationFn: async (shopId: number) => {
      const response = await fetch(`/api/riddlecity/shops/${shopId}`, {
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

  const handleCreateShop = () => {
    if (!selectedBuilding || !shopName.trim()) return;
    
    createShopMutation.mutate({
      buildingId: selectedBuilding,
      shopName,
      shopType,
      description: shopDescription
    });
  };

  const commercialBuildings = city.buildings?.filter((b: any) => 
    b.constructionStatus === 'active' && 
    (b.buildingType.includes('market') || b.buildingType.includes('shop'))
  ) || [];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>City Shops</CardTitle>
              <CardDescription>Manage your commercial establishments</CardDescription>
            </div>
            <Button onClick={() => setShowCreateShop(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Shop
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {city.shops && city.shops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {city.shops.map((shop: any) => (
                <Card key={shop.id} className="border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{shop.shopName}</h4>
                        <Badge variant="outline" className="mt-1 capitalize">{shop.shopType}</Badge>
                      </div>
                      <Badge variant={shop.isOpen ? "default" : "secondary"}>
                        {shop.isOpen ? "Open" : "Closed"}
                      </Badge>
                    </div>

                    {shop.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {shop.description}
                      </p>
                    )}

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Daily Revenue:</span>
                        <span className="font-medium text-green-600">
                          {parseFloat(shop.dailyRevenue).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Customers Today:</span>
                        <span className="font-medium">{shop.customersToday}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteShopMutation.mutate(shop.id)}
                      disabled={deleteShopMutation.isPending}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Close Shop
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No shops created yet. Create one to start generating revenue!
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateShop} onOpenChange={setShowCreateShop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shop</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Building</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedBuilding?.toString() || ""}
                onChange={(e) => setSelectedBuilding(parseInt(e.target.value))}
              >
                <option value="">Select a commercial building...</option>
                {commercialBuildings.map((building: any) => (
                  <option key={building.id} value={building.id}>
                    {building.buildingType.replace(/_/g, ' ')} (Level {building.level})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Enter shop name..."
              />
            </div>

            <div className="space-y-2">
              <Label>Shop Type</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={shopType}
                onChange={(e) => setShopType(e.target.value)}
              >
                <option value="market">Market</option>
                <option value="craftshop">Craft Shop</option>
                <option value="tavern">Tavern</option>
                <option value="bank">Bank</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={shopDescription}
                onChange={(e) => setShopDescription(e.target.value)}
                placeholder="Describe your shop..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleCreateShop}
              disabled={createShopMutation.isPending || !selectedBuilding || !shopName.trim()}
              className="w-full"
            >
              {createShopMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Store className="w-4 h-4 mr-2" />
              )}
              Create Shop
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
