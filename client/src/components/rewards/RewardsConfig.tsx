import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Save } from "lucide-react";

export default function RewardsConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    swapFeePercentage: 1.0,
    bridgeFeePercentage: 1.0,
    rewardsPoolPercentage: 25.0,
    rdlHoldingMultiplier: 2.0,
    nftHoldingMultiplier: 1.5,
    socialActionPoints: {
      post: 10,
      like: 2,
      comment: 5,
      follow: 8,
      share: 3,
    },
  });

  // Fetch current config
  const { data: configData } = useQuery({
    queryKey: ["/api/rewards/config"],
    onSuccess: (data) => {
      if (data) setConfig(data);
    },
  });

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async (newConfig: typeof config) => {
      const response = await fetch("/api/rewards/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error("Failed to update config");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "Rewards configuration has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/config"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateConfig.mutate(config);
  };

  const handleInputChange = (section: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    if (section === "socialActionPoints") {
      setConfig(prev => ({
        ...prev,
        socialActionPoints: {
          ...prev.socialActionPoints,
          [field]: numValue,
        },
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [field]: numValue,
      }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fee Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="config-grid">
            <div className="config-item">
              <Label htmlFor="swapFee">Swap Fee Percentage</Label>
              <div className="config-value">
                <Input
                  id="swapFee"
                  type="number"
                  step="0.1"
                  value={config.swapFeePercentage}
                  onChange={(e) => handleInputChange("", "swapFeePercentage", e.target.value)}
                  className="config-input"
                />
                <span>%</span>
              </div>
            </div>
            
            <div className="config-item">
              <Label htmlFor="bridgeFee">Bridge Fee Percentage</Label>
              <div className="config-value">
                <Input
                  id="bridgeFee"
                  type="number"
                  step="0.1"
                  value={config.bridgeFeePercentage}
                  onChange={(e) => handleInputChange("", "bridgeFeePercentage", e.target.value)}
                  className="config-input"
                />
                <span>%</span>
              </div>
            </div>

            <div className="config-item">
              <Label htmlFor="rewardsPool">Rewards Pool Percentage</Label>
              <div className="config-value">
                <Input
                  id="rewardsPool"
                  type="number"
                  step="0.1"
                  value={config.rewardsPoolPercentage}
                  onChange={(e) => handleInputChange("", "rewardsPoolPercentage", e.target.value)}
                  className="config-input"
                />
                <span>%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holding Multipliers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="config-grid">
            <div className="config-item">
              <Label htmlFor="rdlMultiplier">RDL Holding Multiplier</Label>
              <div className="config-value">
                <Input
                  id="rdlMultiplier"
                  type="number"
                  step="0.1"
                  value={config.rdlHoldingMultiplier}
                  onChange={(e) => handleInputChange("", "rdlHoldingMultiplier", e.target.value)}
                  className="config-input"
                />
                <span>x</span>
              </div>
            </div>

            <div className="config-item">
              <Label htmlFor="nftMultiplier">NFT Holding Multiplier</Label>
              <div className="config-value">
                <Input
                  id="nftMultiplier"
                  type="number"
                  step="0.1"
                  value={config.nftHoldingMultiplier}
                  onChange={(e) => handleInputChange("", "nftHoldingMultiplier", e.target.value)}
                  className="config-input"
                />
                <span>x</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Action Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="config-grid">
            {Object.entries(config.socialActionPoints).map(([action, points]) => (
              <div key={action} className="config-item">
                <Label htmlFor={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)} Points
                </Label>
                <div className="config-value">
                  <Input
                    id={action}
                    type="number"
                    value={points}
                    onChange={(e) => handleInputChange("socialActionPoints", action, e.target.value)}
                    className="config-input"
                  />
                  <span>pts</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="distribution-button"
        >
          <Save size={16} className="mr-2" />
          {updateConfig.isPending ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
