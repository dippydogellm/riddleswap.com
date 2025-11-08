import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, Castle, Palette } from 'lucide-react';

interface SetupWizardProps {
  userHandle: string;
  onComplete?: () => void;
}

export function SetupWizard({ userHandle, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [civilizationData, setCivilizationData] = useState({
    civilization_name: '',
    motto: '',
    primary_color: '#8B4513',
    secondary_color: '#DAA520',
    accent_color: '#CD7F32'
  });

  const queryClient = useQueryClient();

  const createCivilization = useMutation({
    mutationFn: async (data: typeof civilizationData) => {
      const response = await fetch('/api/gaming/nft-gaming/civilization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || error.message || 'Failed to create civilization');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
      onComplete?.();
    }
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    createCivilization.mutate(civilizationData);
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return civilizationData.civilization_name.trim().length > 0;
      case 2:
        return civilizationData.motto.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="max-w-lg w-full bg-gradient-to-br from-purple-900 via-blue-900 to-purple-900 text-white p-6 shadow-2xl my-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome, {userHandle}!</h1>
          <p className="text-gray-300 text-sm">Let's set up your civilization</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-all ${
                  s <= step ? 'bg-yellow-400' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[250px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-3">
                <Castle className="w-7 h-7 text-yellow-400" />
                <h2 className="text-xl font-bold">Name Your Civilization</h2>
              </div>
              
              <div className="space-y-2">
                <Label className="text-lg">Civilization Name</Label>
                <Input
                  placeholder="The Great Empire of..."
                  value={civilizationData.civilization_name}
                  onChange={(e) => setCivilizationData({
                    ...civilizationData,
                    civilization_name: e.target.value
                  })}
                  className="text-lg bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  autoFocus
                />
                <p className="text-sm text-gray-400">
                  Choose a memorable name that represents your kingdom
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-7 h-7 text-yellow-400" />
                <h2 className="text-xl font-bold">Create Your Motto</h2>
              </div>
              
              <div className="space-y-2">
                <Label className="text-lg">Motto / Battle Cry</Label>
                <Input
                  placeholder="Victory or Glory!"
                  value={civilizationData.motto}
                  onChange={(e) => setCivilizationData({
                    ...civilizationData,
                    motto: e.target.value
                  })}
                  className="text-lg bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  autoFocus
                />
                <p className="text-sm text-gray-400">
                  A motto that inspires your troops and strikes fear in your enemies
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-3">
                <Palette className="w-7 h-7 text-yellow-400" />
                <h2 className="text-xl font-bold">Choose Your Colors</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <input
                    type="color"
                    value={civilizationData.primary_color}
                    onChange={(e) => setCivilizationData({
                      ...civilizationData,
                      primary_color: e.target.value
                    })}
                    className="w-full h-12 rounded cursor-pointer"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <input
                    type="color"
                    value={civilizationData.secondary_color}
                    onChange={(e) => setCivilizationData({
                      ...civilizationData,
                      secondary_color: e.target.value
                    })}
                    className="w-full h-12 rounded cursor-pointer"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <input
                    type="color"
                    value={civilizationData.accent_color}
                    onChange={(e) => setCivilizationData({
                      ...civilizationData,
                      accent_color: e.target.value
                    })}
                    className="w-full h-12 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div 
                className="p-4 rounded-lg text-center"
                style={{
                  background: `linear-gradient(to bottom right, ${civilizationData.primary_color}, ${civilizationData.secondary_color})`
                }}
              >
                <h3 className="text-xl font-bold text-white mb-1">
                  {civilizationData.civilization_name}
                </h3>
                <p className="text-white/90 italic text-sm">"{civilizationData.motto}"</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          <Button
            onClick={handleBack}
            disabled={step === 1 || createCivilization.isPending}
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Back
          </Button>
          
          <div className="text-center text-sm text-gray-400">
            Step {step} of 3
          </div>
          
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isStepValid() || createCivilization.isPending}
              className="bg-green-500 hover:bg-green-600 text-white font-bold"
            >
              {createCivilization.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          )}
        </div>

        {createCivilization.isError && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
            {createCivilization.error.message}
          </div>
        )}
      </Card>
    </div>
  );
}
