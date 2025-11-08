import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles,
  Wand2,
  Shield,
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Crown
} from "lucide-react";
import { useSession } from "@/utils/sessionManager";
import { useLocation } from "wouter";
import { BackButton } from "@/components/gaming/BackButton";

const CHARACTER_CLASSES = [
  { name: "Warrior", icon: "⚔️", description: "Master of melee combat and physical prowess" },
  { name: "Mage", icon: "🔮", description: "Wielder of arcane magic and elemental forces" },
  { name: "Rogue", icon: "🗡️", description: "Stealthy assassin with deadly precision" },
  { name: "Paladin", icon: "🛡️", description: "Holy knight blessed with divine power" },
  { name: "Ranger", icon: "🏹", description: "Expert archer and wilderness survivor" },
  { name: "Cleric", icon: "✨", description: "Divine healer and spiritual guide" },
  { name: "Warlock", icon: "👁️", description: "Dark sorcerer bound to otherworldly patrons" },
  { name: "Bard", icon: "🎵", description: "Charismatic performer with magical melodies" },
  { name: "Monk", icon: "🥋", description: "Martial artist channeling inner energy" },
  { name: "Druid", icon: "🌿", description: "Nature's guardian with shapeshifting powers" },
];

const InquisitionWizard = () => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [step, setStep] = useState(1);
  const [characterName, setCharacterName] = useState("");
  const [characterClass, setCharacterClass] = useState("");
  const [characterBio, setCharacterBio] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [crestImageUrl, setCrestImageUrl] = useState("");

  // Check if user already has a profile
  const { data: existingProfile, isLoading: profileLoading } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/inquisition/player/my-profile'],
    enabled: !!session.isLoggedIn,
  });

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/inquisition/player/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inquisition/player/my-profile'] });
    },
  });

  // Generate profile image mutation
  const generateProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inquisition/player/generate-profile-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setProfileImageUrl(data.data.imageUrl);
        toast({
          title: "Profile Image Generated!",
          description: "The Oracle has created your character portrait",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: data.error || "Failed to generate profile image",
          variant: "destructive",
        });
      }
    },
  });

  // Generate crest mutation
  const generateCrestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inquisition/player/generate-crest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setCrestImageUrl(data.data.imageUrl);
        toast({
          title: "Crest Generated!",
          description: "The Oracle has forged your personal emblem",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: data.error || "Failed to generate crest",
          variant: "destructive",
        });
      }
    },
  });

  // Complete wizard mutation
  const completeWizardMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inquisition/player/complete-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome to The Trolls Inquisition!",
        description: "Your character has been created successfully",
      });
      navigate('/inquisition');
    },
  });

  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-purple-500/50 max-w-md">
          <CardContent className="text-center py-12 space-y-4">
            <Shield className="w-16 h-16 text-gray-600 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Login Required</h2>
            <p className="text-gray-400">You need to login to create your character</p>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => navigate('/login')}>
              Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
      </div>
    );
  }

  // If user already has a complete profile, redirect to dashboard
  if (existingProfile?.data?.is_profile_complete) {
    navigate('/inquisition');
    return null;
  }

  const handleNext = async () => {
    if (step === 1 && !characterName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your character name",
        variant: "destructive",
      });
      return;
    }

    if (step === 2 && !characterClass) {
      toast({
        title: "Class Required",
        description: "Please select a character class",
        variant: "destructive",
      });
      return;
    }

    if (step === 3) {
      // Save profile before generating images
      const result = await createProfileMutation.mutateAsync({
        characterName,
        characterClass,
        characterBio,
        profileMetadata: {},
      });

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to save profile",
          variant: "destructive",
        });
        return;
      }
    }

    setStep(step + 1);
  };

  const handleGenerateBoth = async () => {
    // Generate both images sequentially
    await generateProfileMutation.mutateAsync();
    await generateCrestMutation.mutateAsync();
  };

  const handleComplete = async () => {
    await completeWizardMutation.mutateAsync();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        
        {/* Back Button */}
        <div className="mb-6">
          <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
        </div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            Character Creation
          </h1>
          <p className="text-gray-400">The Oracle awaits to forge your destiny</p>
          
          {/* Progress Indicator */}
          <div className="flex justify-center items-center gap-2 mt-6">
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className={`w-3 h-3 rounded-full ${
                  step >= num ? 'bg-purple-500' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Character Name */}
        {step === 1 && (
          <Card className="bg-slate-900/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400">What is your name, warrior?</CardTitle>
              <CardDescription>Choose a name that will echo through the ages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Enter your character name..."
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                className="bg-slate-800 border-purple-500/30 text-white text-lg p-6"
                maxLength={50}
              />
              <Button
                onClick={handleNext}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Character Class */}
        {step === 2 && (
          <Card className="bg-slate-900/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400">Choose your path</CardTitle>
              <CardDescription>Select the class that defines your combat style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                {CHARACTER_CLASSES.map((cls) => (
                  <button
                    key={cls.name}
                    onClick={() => setCharacterClass(cls.name)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      characterClass === cls.name
                        ? 'border-purple-500 bg-purple-900/30'
                        : 'border-slate-700 bg-slate-800 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{cls.icon}</span>
                      <div>
                        <h3 className="font-bold text-white">{cls.name}</h3>
                        <p className="text-xs text-gray-400">{cls.description}</p>
                      </div>
                      {characterClass === cls.name && (
                        <Check className="w-5 h-5 text-purple-400 ml-auto" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  size="lg"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Character Bio (Optional) */}
        {step === 3 && (
          <Card className="bg-slate-900/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400">Tell your story (Optional)</CardTitle>
              <CardDescription>
                Add a background to help The Oracle craft your unique portrait
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe your character's background, personality, or appearance..."
                value={characterBio}
                onChange={(e) => setCharacterBio(e.target.value)}
                className="bg-slate-800 border-purple-500/30 text-white min-h-32"
                maxLength={500}
              />
              <p className="text-sm text-gray-400">{characterBio.length}/500 characters</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  size="lg"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="lg"
                  disabled={createProfileMutation.isPending}
                >
                  {createProfileMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <>Save & Continue<ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Generate Images */}
        {step === 4 && (
          <Card className="bg-slate-900/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">
                <Wand2 className="w-6 h-6" />
                Summon The Oracle
              </CardTitle>
              <CardDescription>
                The Oracle will create your unique character portrait and personal crest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg border border-purple-500/30">
                <div className="text-center space-y-2 mb-4">
                  <Sparkles className="w-12 h-12 text-purple-400 mx-auto" />
                  <h3 className="font-bold text-white">AI-Powered Generation</h3>
                  <p className="text-sm text-gray-400">
                    The Oracle uses advanced AI to create unique artwork based on your character details and NFT collection
                  </p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Character:</span>
                    <span className="text-white">{characterName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Class:</span>
                    <span className="text-white">{characterClass}</span>
                  </div>
                </div>
              </div>

              {!profileImageUrl && !crestImageUrl && (
                <Button
                  onClick={handleGenerateBoth}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  size="lg"
                  disabled={generateProfileMutation.isPending || generateCrestMutation.isPending}
                >
                  {generateProfileMutation.isPending || generateCrestMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> The Oracle is crafting...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" /> Generate Images with The Oracle</>
                  )}
                </Button>
              )}

              {/* Display Generated Images */}
              {(profileImageUrl || crestImageUrl) && (
                <div className="grid md:grid-cols-2 gap-4">
                  {profileImageUrl && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-purple-400">Character Portrait</h4>
                      <img
                        src={profileImageUrl}
                        alt="Character Portrait"
                        className="w-full rounded-lg border-2 border-purple-500"
                      />
                    </div>
                  )}
                  {crestImageUrl && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-purple-400">Personal Crest</h4>
                      <img
                        src={crestImageUrl}
                        alt="Personal Crest"
                        className="w-full rounded-lg border-2 border-purple-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {profileImageUrl && crestImageUrl && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setStep(3)}
                    variant="outline"
                    size="lg"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(5)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Complete */}
        {step === 5 && (
          <Card className="bg-slate-900/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">
                <Crown className="w-6 h-6" />
                Your Legend Begins
              </CardTitle>
              <CardDescription>Review your character and enter The Trolls Inquisition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  {profileImageUrl && (
                    <img
                      src={profileImageUrl}
                      alt="Character Portrait"
                      className="w-full rounded-lg border-2 border-purple-500"
                    />
                  )}
                  <div className="bg-slate-800 p-4 rounded-lg space-y-1">
                    <h3 className="font-bold text-white text-xl">{characterName}</h3>
                    <p className="text-purple-400">{characterClass}</p>
                    {characterBio && (
                      <p className="text-sm text-gray-400 mt-2">{characterBio}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {crestImageUrl && (
                    <img
                      src={crestImageUrl}
                      alt="Personal Crest"
                      className="w-full rounded-lg border-2 border-purple-500"
                    />
                  )}
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg">
                <p className="text-sm text-amber-400">
                  ℹ️ You can regenerate your images once per month to keep your character fresh!
                </p>
              </div>

              <Button
                onClick={handleComplete}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
                disabled={completeWizardMutation.isPending}
              >
                {completeWizardMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entering...</>
                ) : (
                  <><Crown className="w-4 h-4 mr-2" /> Enter The Inquisition</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InquisitionWizard;
