import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Castle, MapPin } from "lucide-react";

interface CreateCityModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  landPlots?: any[];
}

export function CreateCityModal({ open, onClose, onSuccess, landPlots = [] }: CreateCityModalProps) {
  const session = useSession();
  const [cityName, setCityName] = useState("");
  const [selectedLandPlot, setSelectedLandPlot] = useState<string>("");

  const createCityMutation = useMutation({
    mutationFn: async ({ name, landPlotId }: { name: string; landPlotId: string }) => {
      const response = await fetch('/api/riddlecity/city/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        body: JSON.stringify({ cityName: name, landPlotId })
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to create city');
      }
      return response.json();
    },
    onSuccess: () => {
      onSuccess();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityName.trim() || !selectedLandPlot) return;
    createCityMutation.mutate({ name: cityName, landPlotId: selectedLandPlot });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Castle className="w-6 h-6 text-orange-600" />
            Create Your Medieval City
          </DialogTitle>
          <DialogDescription>
            Begin your journey as a city lord. Choose a name for your settlement!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="landPlot">Select Land Plot</Label>
            <Select value={selectedLandPlot} onValueChange={setSelectedLandPlot} disabled={createCityMutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a land plot..." />
              </SelectTrigger>
              <SelectContent>
                {landPlots.map((plot) => (
                  <SelectItem key={plot.id} value={plot.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Plot #{plot.plotNumber} - {plot.terrainType} ({plot.plotSize})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLandPlot && (
              <div className="text-xs text-muted-foreground">
                {landPlots.find(p => p.id === selectedLandPlot)?.terrainSubtype && (
                  <p>Terrain: {landPlots.find(p => p.id === selectedLandPlot)?.terrainSubtype}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cityName">City Name</Label>
            <Input
              id="cityName"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Enter city name..."
              disabled={createCityMutation.isPending}
            />
          </div>

          {createCityMutation.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {(createCityMutation.error as Error).message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={createCityMutation.isPending || !cityName.trim() || !selectedLandPlot}
          >
            {createCityMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating City...
              </>
            ) : (
              'Found Your City'
            )}
          </Button>
        </form>

        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>🎮 Starting Resources:</p>
          <ul className="list-disc list-inside pl-2 space-y-1">
            <li>10,000 Credits</li>
            <li>500 Materials</li>
            <li>1,000 Energy</li>
            <li>500 Food</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
