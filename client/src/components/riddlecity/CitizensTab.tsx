import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Loader2, Plus, UserPlus, Trash2 } from "lucide-react";
import { normalizeNftImage } from "@/utils/imageNormalizer";

interface CitizensTabProps {
  city: any;
  onRefresh: () => void;
}

export function CitizensTab({ city, onRefresh }: CitizensTabProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [showAssignCitizen, setShowAssignCitizen] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<any>(null);

  const { data: nftData } = useQuery<any>({
    queryKey: [`/api/inquisition-audit/player/nfts?handle=${session.handle}`],
    enabled: !!session.handle,
  });

  const assignCitizenMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/riddlecity/citizens/assign', {
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
      setShowAssignCitizen(false);
      setSelectedNFT(null);
    }
  });

  const removeCitizenMutation = useMutation({
    mutationFn: async (citizenId: number) => {
      const response = await fetch(`/api/riddlecity/citizens/${citizenId}`, {
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

  const handleAssignNFT = (nft: any) => {
    assignCitizenMutation.mutate({
      nftId: nft.nft_id || nft.tokenId,
      nftTokenId: nft.tokenId || nft.nft_token_id,
      nftCollection: 'Inquisition',
      assignedRole: 'worker'
    });
  };

  const availableNFTs = nftData?.data?.filter((nft: any) => 
    !city.citizens?.some((c: any) => c.nftTokenId === (nft.tokenId || nft.nft_token_id))
  ) || [];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>City Citizens</CardTitle>
              <CardDescription>NFTs assigned to your city</CardDescription>
            </div>
            <Button onClick={() => setShowAssignCitizen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Assign NFT
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Population</div>
                <div className="text-3xl font-bold text-purple-600">
                  {city.population} / {city.populationCapacity}
                </div>
              </div>
              <Users className="w-12 h-12 text-purple-600" />
            </div>
          </div>

          {city.citizens && city.citizens.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {city.citizens.map((citizen: any) => (
                <Card key={citizen.id} className="border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">Citizen #{citizen.nftTokenId}</h4>
                        <Badge variant="outline" className="mt-1 capitalize">
                          {citizen.assignedRole || 'Worker'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Economic Bonus:</span>
                        <span className="font-medium text-yellow-600">
                          +{(parseFloat(citizen.economicBonus) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Production Bonus:</span>
                        <span className="font-medium text-blue-600">
                          +{(parseFloat(citizen.productionBonus) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Defense Bonus:</span>
                        <span className="font-medium text-red-600">
                          +{citizen.defenseBonus}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Happiness Bonus:</span>
                        <span className="font-medium text-pink-600">
                          +{citizen.happinessBonus}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeCitizenMutation.mutate(citizen.id)}
                      disabled={removeCitizenMutation.isPending}
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
              No citizens assigned yet. Assign NFTs to boost your city!
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAssignCitizen} onOpenChange={setShowAssignCitizen}>
        <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign NFT Citizen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableNFTs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {availableNFTs.map((nft: any) => (
                  <Card key={nft.nft_id || nft.tokenId} className="border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h4 className="font-semibold">
                          {nft.metadata?.name || `NFT #${nft.tokenId || nft.nft_token_id}`}
                        </h4>
                        <Badge variant="outline" className="mt-1">
                          Inquisition
                        </Badge>
                      </div>

                      {nft.image_url && (
                        <img 
                          src={normalizeNftImage({ image_url: nft.image_url })} 
                          alt={nft.metadata?.name}
                          className="w-full h-32 object-cover rounded"
                        />
                      )}

                      <Button
                        size="sm"
                        onClick={() => handleAssignNFT(nft)}
                        disabled={assignCitizenMutation.isPending}
                        className="w-full"
                      >
                        {assignCitizenMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Assign to City
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                No available NFTs to assign. All your NFTs are already citizens!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
