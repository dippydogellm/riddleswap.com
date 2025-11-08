import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sword, Shield, Castle, Coins, Users, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface SquadronCreateDialogProps {
  onSquadronCreated: () => void;
}

const squadronTypes = [
  {
    value: "military",
    label: "Military",
    icon: Sword,
    description: "Focus on army power and combat effectiveness",
    color: "text-red-600",
    bgColor: "bg-red-50",
    bonus: "+20% Army Power"
  },
  {
    value: "religious",
    label: "Religious",
    icon: Shield,
    description: "Specialize in religion and divine power",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    bonus: "+20% Religion Power"
  },
  {
    value: "diplomatic",
    label: "Diplomatic",
    icon: Castle,
    description: "Balance civilization and economic power",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    bonus: "+15% Civilization, +15% Economic"
  },
  {
    value: "economic",
    label: "Economic",
    icon: Coins,
    description: "Maximize economic power and resources",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    bonus: "+20% Economic Power"
  }
];

export default function SquadronCreateDialog({ onSquadronCreated }: SquadronCreateDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    squadron_type: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.squadron_type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const token = sessionStorage.getItem('sessionToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/squadrons/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to create squadron');
      }

      const result = await response.json() as any;

      toast({
        title: "Success!",
        description: `Squadron "${formData.name}" created successfully!`,
      });

      setFormData({ name: "", description: "", squadron_type: "" });
      setOpen(false);
      onSquadronCreated();

    } catch (error: any) {
      console.error('Error creating squadron:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create squadron",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedType = squadronTypes.find(type => type.value === formData.squadron_type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 border-2 border-purple-400 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Squadron
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Create New Squadron
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Squadron Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Squadron Name *</Label>
            <Input
              id="name"
              placeholder="Enter squadron name..."
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          {/* Squadron Type */}
          <div className="space-y-2">
            <Label>Squadron Type *</Label>
            <Select
              value={formData.squadron_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, squadron_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select squadron specialization..." />
              </SelectTrigger>
              <SelectContent>
                {squadronTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Type Preview */}
          {selectedType && (
            <Card className={`p-4 ${selectedType.bgColor} border-2`}>
              <div className="flex items-center gap-3">
                <selectedType.icon className={`w-8 h-8 ${selectedType.color}`} />
                <div>
                  <h3 className="font-bold text-lg">{selectedType.label} Squadron</h3>
                  <p className="text-sm text-gray-600">{selectedType.description}</p>
                  <Badge variant="outline" className="mt-1">
                    {selectedType.bonus}
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe your squadron's purpose and strategy..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? "Creating..." : "Create Squadron"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
