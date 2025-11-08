/**
 * First-Time User Wizard for "The Trolls Inquisition Multi-Chain Mayhem Edition"
 * 
 * Comprehensive wizard for setting up new players including:
 * - Civilization setup (name, colors, motto, flag)
 * - Current game round display
 * - Ally request system
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Crown, 
  Shield, 
  Flag, 
  Palette, 
  Scroll, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Sparkles,
  Castle,
  Swords,
  Heart,
  User,
  Cross,
  Church
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import "./first-time-wizard.css";

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (playerData: any) => void;
  userHandle: string;
  currentRound: number;
}

interface CivilizationData {
  civilization_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  motto: string;
}

interface ProfileData {
  player_name: string;
  commander_class: string;
  commander_profile_image?: string;
  religion: string;
}

interface NFTVerificationData {
  verification_status: 'pending' | 'in_progress' | 'completed';
  verified_nfts: any[];
  religion_power: number;
  army_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
}

interface RiddleWalletUser {
  user_handle: string;
  player_name?: string;
  total_power_level: number;
  gaming_rank: string;
}

const WIZARD_STEPS = [
  { id: 'welcome', title: 'Welcome to the Realm', icon: Crown },
  { id: 'nft-verification', title: 'Verify Your NFTs', icon: Shield },
  { id: 'profile-commander', title: 'Profile & Commander', icon: User },
  { id: 'civilization-religion', title: 'Civilization & Religion', icon: Castle },
  { id: 'customization', title: 'Colors & Motto', icon: Palette },
  { id: 'allies-complete', title: 'Allies & Enter Realm', icon: Sparkles }
];

export default function FirstTimeWizard({ isOpen, onClose, onCompleted, userHandle, currentRound }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [civilizationData, setCivilizationData] = useState<CivilizationData>({
    civilization_name: '',
    primary_color: '#8B4513', // Medieval brown
    secondary_color: '#DAA520', // Gold
    accent_color: '#DC143C', // Crimson
    motto: ''
  });
  
  const [profileData, setProfileData] = useState<ProfileData>({
    player_name: '',
    commander_class: 'warrior',
    commander_profile_image: '',
    religion: ''
  });
  
  const [nftVerification, setNftVerification] = useState<NFTVerificationData>({
    verification_status: 'pending',
    verified_nfts: [],
    religion_power: 0,
    army_power: 0,
    civilization_power: 0,
    economic_power: 0,
    total_power: 0
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available riddle wallet users for ally requests
  const { data: riddleWalletUsers = [] } = useQuery({
    queryKey: ['riddle-wallet-users'],
    queryFn: () => apiRequest('/api/nft-gaming/riddle-wallet-users'),
    enabled: isOpen && currentStep === 5 // Only fetch when on allies-complete step
  });
  
  // Fetch NFT verification data
  const { data: nftData, refetch: refetchNFTs } = useQuery({
    queryKey: ['nft-verification', userHandle],
    queryFn: () => apiRequest(`/api/gaming/player/nft-verification`),
    enabled: isOpen && currentStep === 1 // Only fetch when on NFT verification step
  });

  // Create civilization mutation
  const createCivilizationMutation = useMutation({
    mutationFn: (data: CivilizationData) => 
      apiRequest('/api/nft-gaming/civilization', { 
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({
        title: "🏰 Civilization Founded!",
        description: `Your civilization "${civilizationData.civilization_name}" has been established in Round ${currentRound}.`
      });
      queryClient.invalidateQueries({ queryKey: ['gaming-dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to create civilization",
        variant: "destructive"
      });
    }
  });

  // Send ally request mutation
  const sendAllyRequestMutation = useMutation({
    mutationFn: (data: { receiver_handle: string; message?: string }) =>
      apiRequest('/api/nft-gaming/ally-request', { 
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({
        title: "🤝 Ally Request Sent!",
        description: "Your alliance proposal has been sent."
      });
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to send ally request",
        variant: "destructive"
      });
    }
  });

  // Update player profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileData) => 
      apiRequest('/api/gaming/player/profile', { 
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({
        title: "👤 Profile Updated!",
        description: `Welcome to the realm, ${profileData.player_name}!`
      });
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    }
  });
  
  // Start NFT verification mutation using enhanced scanner
  const startNFTVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/gaming/player/verify-nfts', { method: 'POST' });
      return await response.json() as any; // Parse the JSON response
    },
    onSuccess: (data: any) => {
      console.log('🔍 [WIZARD] NFT verification complete:', data);
      console.log('🔍 [WIZARD] Data type:', typeof data);
      console.log('🔍 [WIZARD] Data keys:', Object.keys(data || {}));
      
      // Only include NFTs from verified collections
      const VERIFIED_COLLECTION_ISSUERS = [
        'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH' // The Inquisition Collectors Deck
      ];
      
      const verified_nfts = Object.values(data.collections || {}).flatMap((collection: any) => {
        // Check if this collection is from a verified issuer
        const nfts = collection.nfts || [];
        return nfts.filter((nft: any) => 
          VERIFIED_COLLECTION_ISSUERS.includes(nft.issuer)
        );
      });
      
      setNftVerification({
        verification_status: 'completed',
        verified_nfts: verified_nfts,
        total_power: data.total_power || 0,
        religion_power: Math.floor((data.total_power || 0) * 0.25),
        army_power: Math.floor((data.total_power || 0) * 0.25),
        civilization_power: Math.floor((data.total_power || 0) * 0.25),
        economic_power: Math.floor((data.total_power || 0) * 0.25)
      });
      toast({
        title: "🛡️ NFTs Verified!",
        description: `Found ${data.total_nfts || 0} NFTs across ${Object.keys(data.collections || {}).length} collections with ${data.total_power || 0} total power.`
      });
      
      // Show collection summary if available
      if (data.collections && Object.keys(data.collections).length > 0) {
        const collectionNames = Object.values(data.collections).map((col: any) => col.name).join(', ');
        toast({
          title: "📦 Collections Found",
          description: `${collectionNames}`,
          variant: "default"
        });
      }
      
      refetchNFTs();
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Verification Failed",
        description: error.message || "Failed to verify NFTs",
        variant: "destructive"
      });
    }
  });
  
  // Complete wizard setup - save all data to database
  const completeWizardMutation = useMutation({
    mutationFn: async () => {
      // Save profile and civilization data together
      const wizardData = {
        ...profileData,
        ...civilizationData,
        nft_verification: nftVerification,
        wizard_completed: true
      };
      
      const response = await apiRequest('/api/gaming/player/complete-setup', { 
        method: 'POST',
        body: JSON.stringify(wizardData)
      });
      return await response.json() as any;
    },
    onSuccess: () => {
      toast({
        title: "🎉 Welcome to the Realm!",
        description: "Your journey in The Trolls Inquisition begins now. Moving to Step 2..."
      });
      queryClient.invalidateQueries({ queryKey: ['gaming-dashboard'] });
      
      // Pass player data to Step 2
      const playerData = {
        ...profileData,
        ...civilizationData
      };
      onCompleted(playerData);
    }
  });

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinishWizard = async () => {
    try {
      // Update profile first
      await updateProfileMutation.mutateAsync(profileData);
      
      // Try to create civilization, but handle case where it already exists
      try {
        await createCivilizationMutation.mutateAsync(civilizationData);
      } catch (civilizationError: any) {
        // If civilization already exists, that's ok - just continue with wizard completion
        if (civilizationError.message && civilizationError.message.includes("already have a civilization")) {
          toast({
            title: "🏰 Civilization Already Exists",
            description: "You already have a civilization set up. Continuing with setup completion...",
          });
        } else {
          // If it's a different error, re-throw it
          throw civilizationError;
        }
      }
      
      // Complete wizard regardless of civilization creation outcome
      await completeWizardMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to complete wizard:', error);
      toast({
        title: "⚠️ Setup Error",
        description: "There was an issue completing your setup. Please try again.",
        variant: "destructive"
      });
    }
  };

  const sendAllyRequest = (receiverHandle: string) => {
    sendAllyRequestMutation.mutate({
      receiver_handle: receiverHandle,
      message: `Greetings from ${civilizationData.civilization_name}! Let us form an alliance in Round ${currentRound}.`
    });
  };

  const renderStepContent = () => {
    const step = WIZARD_STEPS[currentStep];

    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6" data-testid="wizard-welcome-step">
            <div className="space-y-4">
              <Crown className="h-16 w-16 mx-auto text-yellow-500" />
              <h2 className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                🏰 Welcome to The Trolls Inquisition Multi-Chain Mayhem Edition!
              </h2>
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-2">⚔️ Current Round: {currentRound}</h3>
                <p className="text-blue-100">The realm awaits your leadership, noble {userHandle}!</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-lg text-gray-700 dark:text-gray-300">
                You have successfully verified your NFTs and proven your worth! 
                Now it's time to establish your civilization and forge alliances.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <Shield className="h-8 w-8 text-green-600 mb-2" />
                  <p className="font-semibold text-green-800 dark:text-green-400">NFTs Verified ✅</p>
                  <p className="text-green-600 dark:text-green-300">Your power has been calculated</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <Castle className="h-8 w-8 text-blue-600 mb-2" />
                  <p className="font-semibold text-blue-800 dark:text-blue-400">Ready to Rule</p>
                  <p className="text-blue-600 dark:text-blue-300">Found your civilization</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'profile-commander':
        return (
          <div className="space-y-6" data-testid="wizard-profile-commander-step">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto text-blue-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">👤 Create Your Profile & Commander</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Set up your commander profile for Round {currentRound}
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="player-name" className="text-base font-semibold">
                    Player Name
                  </Label>
                  <Input
                    id="player-name"
                    data-testid="input-player-name"
                    placeholder="Enter your commander name"
                    value={profileData.player_name}
                    onChange={(e) => setProfileData({
                      ...profileData,
                      player_name: e.target.value
                    })}
                    className="text-lg"
                  />
                </div>
                
                <div>
                  <Label className="text-base font-semibold">Commander Class</Label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {['warrior', 'strategist', 'diplomat'].map((commanderClass) => (
                      <Button
                        key={commanderClass}
                        variant={profileData.commander_class === commanderClass ? "default" : "outline"}
                        onClick={() => setProfileData({
                          ...profileData,
                          commander_class: commanderClass
                        })}
                        className="h-auto flex flex-col p-3 text-center"
                        data-testid={`button-commander-${commanderClass}`}
                      >
                        <div className="text-lg mb-1">
                          {commanderClass === 'warrior' && '⚔️'}
                          {commanderClass === 'strategist' && '🧠'}
                          {commanderClass === 'diplomat' && '🤝'}
                        </div>
                        <div className="text-sm font-medium capitalize">{commanderClass}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {commanderClass === 'warrior' && 'Combat focused'}
                          {commanderClass === 'strategist' && 'Tactical genius'}
                          {commanderClass === 'diplomat' && 'Alliance master'}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              {profileData.player_name && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <h3 className="font-bold text-blue-800 dark:text-blue-300 text-lg">
                    🏆 Commander Preview:
                  </h3>
                  <p className="text-blue-700 dark:text-blue-400 italic">
                    "Commander {profileData.player_name} ({userHandle}) - {profileData.commander_class} class joins the battlefield in Round {currentRound}..."
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'nft-verification':
        return (
          <div className="space-y-6" data-testid="wizard-nft-verification-step">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">🛡️ Verify Your NFTs</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Scan your connected wallets to calculate your power level
              </p>
            </div>
            
            {/* Always show rescan button for debugging */}
            <div className="text-center mb-4">
              <Button
                onClick={() => startNFTVerificationMutation.mutate()}
                disabled={startNFTVerificationMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4"
                data-testid="button-rescan-nfts"
              >
                {startNFTVerificationMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Scanning...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {nftVerification.verification_status === 'pending' ? 'Start NFT Scan' : 'Rescan NFTs'}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              {nftVerification.verification_status === 'pending' && (
                <div className="text-center space-y-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                      🔍 Ready to Scan
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-400 text-sm mb-4">
                      We'll scan your connected wallets for eligible NFTs and calculate your total power level.
                    </p>
                    <Button
                      onClick={() => {
                        setNftVerification({ ...nftVerification, verification_status: 'in_progress' });
                        startNFTVerificationMutation.mutate();
                      }}
                      disabled={startNFTVerificationMutation.isPending}
                      className="w-full"
                      data-testid="button-start-nft-verification"
                    >
                      {startNFTVerificationMutation.isPending ? (
                        "🔄 Scanning Wallets..."
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Start NFT Verification
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              {nftVerification.verification_status === 'in_progress' && (
                <div className="text-center space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <div className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600">
                      🔄
                    </div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
                      Scanning Your Wallets...
                    </h3>
                    <p className="text-blue-700 dark:text-blue-400 text-sm">
                      Please wait while we verify your NFT ownership and calculate power levels.
                    </p>
                  </div>
                </div>
              )}
              
              {nftVerification.verification_status === 'completed' && (
                <div className="space-y-4">
                  {nftVerification.verified_nfts.length === 0 ? (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg border-2 border-orange-200 dark:border-orange-800">
                      <h3 className="font-bold text-orange-800 dark:text-orange-300 text-lg mb-4">
                        ⚠️ No Gaming NFTs Found
                      </h3>
                      
                      <div className="space-y-4">
                        <p className="text-orange-700 dark:text-orange-400 text-sm">
                          We scanned your wallets but didn't find any eligible gaming NFTs from the RIDDLE_COLLECTIONS. 
                        </p>
                        
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                          <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">What you can do:</h4>
                          <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                            <li>• Purchase eligible gaming NFTs from the marketplace</li>
                            <li>• Try the Rescan button above if you recently acquired NFTs</li>
                            <li>• Continue playing with starter power level (100 points)</li>
                          </ul>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">0</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Gaming NFTs</div>
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">100</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Starter Power</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border-2 border-green-200 dark:border-green-800">
                      <h3 className="font-bold text-green-800 dark:text-green-300 text-lg mb-4">
                        ✅ Verification Complete!
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4 text-center mb-6">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{nftVerification.verified_nfts.length}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">NFTs Verified</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{nftVerification.total_power.toLocaleString()}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Total Power</div>
                        </div>
                      </div>

                    {/* Display Verified NFTs */}
                    {nftVerification.verified_nfts.length > 0 && (
                      <div className="space-y-3 mb-6">
                        <h4 className="font-semibold text-green-800 dark:text-green-300 text-base mb-3">
                          🎨 Your Verified NFTs:
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {nftVerification.verified_nfts.map((nft: any, index: number) => (
                            <div 
                              key={index}
                              className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                  {nft.name || nft.collection_name || `NFT #${nft.nft_id || index + 1}`}
                                </div>
                                {nft.collection_name && nft.name !== nft.collection_name && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {nft.collection_name}
                                  </div>
                                )}
                                {nft.chain && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400">
                                    {nft.chain.toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                  {nft.power_level || nft.power || 100} ⚡
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Power
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-green-700 dark:text-green-400 text-sm text-center">
                      Your commander is ready for battle with {nftVerification.total_power.toLocaleString()} power points!
                    </p>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
        );

      case 'civilization-religion':
        return (
          <div className="space-y-6" data-testid="wizard-civilization-religion-step">
            <div className="text-center">
              <Castle className="h-12 w-12 mx-auto text-purple-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">🏰 Found Your Civilization & Religion</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Establish your civilization and choose your spiritual path
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Civilization Name */}
              <div>
                <Label className="text-base font-semibold">Civilization Name</Label>
                <Input
                  placeholder="Name your great civilization"
                  value={civilizationData.civilization_name}
                  onChange={(e) => setCivilizationData({
                    ...civilizationData,
                    civilization_name: e.target.value
                  })}
                  className="text-lg"
                  data-testid="input-civilization-name"
                />
              </div>
              
              {/* Religion Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Choose Your Religion</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'christianity', name: 'Christianity', icon: '✝️', desc: 'Faith, hope, and love' },
                    { id: 'islam', name: 'Islam', icon: '☪️', desc: 'Submission to Allah' },
                    { id: 'buddhism', name: 'Buddhism', icon: '☸️', desc: 'Path to enlightenment' },
                    { id: 'hinduism', name: 'Hinduism', icon: '🕉️', desc: 'Eternal dharma' }
                  ].map((religion) => (
                    <Button
                      key={religion.id}
                      variant={profileData.religion === religion.id ? "default" : "outline"}
                      onClick={() => setProfileData({ ...profileData, religion: religion.id })}
                      className="h-auto flex flex-col p-3 text-center"
                      data-testid={`button-religion-${religion.id}`}
                    >
                      <div className="text-2xl mb-1">{religion.icon}</div>
                      <div className="text-sm font-medium">{religion.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{religion.desc}</div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {civilizationData.civilization_name && profileData.religion && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                  <h3 className="font-bold text-purple-800 dark:text-purple-300 text-lg mb-2">
                    🏛️ Civilization Preview:
                  </h3>
                  <p className="text-purple-700 dark:text-purple-400">
                    "The great civilization of {civilizationData.civilization_name} follows the path of {profileData.religion.charAt(0).toUpperCase() + profileData.religion.slice(1)} in Round {currentRound}..."
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'customization':
        return (
          <div className="space-y-6" data-testid="wizard-customization-step">
            <div className="text-center">
              <Palette className="h-12 w-12 mx-auto text-pink-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">🎨 Colors & Motto</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Customize your civilization's appearance and create your motto
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Color Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Choose Your Colors</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={civilizationData.primary_color}
                        onChange={(e) => setCivilizationData({
                          ...civilizationData,
                          primary_color: e.target.value
                        })}
                        className="w-12 h-8 rounded border"
                        data-testid="input-primary-color"
                      />
                      <span className="text-sm text-gray-600">{civilizationData.primary_color}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Secondary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={civilizationData.secondary_color}
                        onChange={(e) => setCivilizationData({
                          ...civilizationData,
                          secondary_color: e.target.value
                        })}
                        className="w-12 h-8 rounded border"
                        data-testid="input-secondary-color"
                      />
                      <span className="text-sm text-gray-600">{civilizationData.secondary_color}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={civilizationData.accent_color}
                        onChange={(e) => setCivilizationData({
                          ...civilizationData,
                          accent_color: e.target.value
                        })}
                        className="w-12 h-8 rounded border"
                        data-testid="input-accent-color"
                      />
                      <span className="text-sm text-gray-600">{civilizationData.accent_color}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Motto */}
              <div>
                <Label className="text-base font-semibold">Civilization Motto</Label>
                <Textarea
                  placeholder="Enter your civilization's motto or battle cry..."
                  value={civilizationData.motto}
                  onChange={(e) => setCivilizationData({
                    ...civilizationData,
                    motto: e.target.value
                  })}
                  className="text-lg"
                  rows={3}
                  data-testid="input-motto"
                />
                <p className="text-xs text-gray-500 mt-1">This will inspire your people and strike fear into your enemies</p>
              </div>

              {/* Preview */}
              <div className="bg-gradient-to-br text-white p-6 rounded-lg" 
                   style={{ background: `linear-gradient(to bottom right, ${civilizationData.primary_color}, ${civilizationData.secondary_color})` }}>
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-bold">{civilizationData.civilization_name || 'Your Civilization'}</h3>
                  <div className="flex justify-center space-x-4">
                    <div className="w-8 h-8 rounded border-2 border-white" 
                         style={{ backgroundColor: civilizationData.primary_color }}></div>
                    <div className="w-8 h-8 rounded border-2 border-white" 
                         style={{ backgroundColor: civilizationData.secondary_color }}></div>
                    <div className="w-8 h-8 rounded border-2 border-white" 
                         style={{ backgroundColor: civilizationData.accent_color }}></div>
                  </div>
                  {civilizationData.motto && (
                    <p className="italic text-lg">'{civilizationData.motto}'</p>
                  )}
                  <p className="text-sm opacity-90">Round {currentRound} • Founded by {userHandle}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'allies-complete':
        return (
          <div className="space-y-6" data-testid="wizard-allies-complete-step">
            <div className="text-center">
              <Sparkles className="h-12 w-12 mx-auto text-purple-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">🎆 Seek Allies & Enter the Realm</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Form alliances and complete your civilization setup
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Allies Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">🤝 Potential Allies</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {Array.isArray(riddleWalletUsers) && riddleWalletUsers.length > 0 ? (
                    riddleWalletUsers.map((user: RiddleWalletUser) => (
                      <Card key={user.user_handle} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarFallback className="bg-purple-600 text-white">
                                {user.user_handle.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-semibold">{user.player_name || user.user_handle}</h4>
                              <p className="text-sm text-gray-600">@{user.user_handle}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {user.gaming_rank}
                                </Badge>
                                <span className="text-yellow-600 text-xs font-medium">
                                  {user.total_power_level.toLocaleString()} power
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => sendAllyRequest(user.user_handle)}
                            disabled={sendAllyRequestMutation.isPending}
                            data-testid={`button-ally-${user.user_handle}`}
                          >
                            🤝 Ally
                          </Button>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No other verified players found.</p>
                      <p className="text-sm">You can seek allies later from your dashboard.</p>
                    </div>
                  )}
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mt-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    ⚠️ <strong>Note:</strong> You can skip this step and seek allies later from your civilization dashboard.
                  </p>
                </div>
              </div>

              {/* Final Summary */}
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white p-6 rounded-lg">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">{civilizationData.civilization_name}</h3>
                  <div className="flex justify-center space-x-4">
                    <div className="w-8 h-8 rounded border-2 border-white" 
                         style={{ backgroundColor: civilizationData.primary_color }}></div>
                    <div className="w-8 h-8 rounded border-2 border-white" 
                         style={{ backgroundColor: civilizationData.secondary_color }}></div>
                    <div className="w-8 h-8 rounded border-2 border-white" 
                         style={{ backgroundColor: civilizationData.accent_color }}></div>
                  </div>
                  <p className="italic">'{civilizationData.motto}'</p>
                  <p className="text-blue-100">Round {currentRound} • Founded by {userHandle}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-green-600/20 p-3 rounded">
                      <Swords className="h-6 w-6 mb-1" />
                      <p className="font-semibold">Battle & Conquer</p>
                      <p className="text-xs text-blue-200">Use your NFT power in combat</p>
                    </div>
                    <div className="bg-blue-600/20 p-3 rounded">
                      <Users className="h-6 w-6 mb-1" />
                      <p className="font-semibold">Manage Alliances</p>
                      <p className="text-xs text-blue-200">Forge diplomatic relations</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete Setup Button */}
              <Button
                onClick={handleFinishWizard}
                disabled={createCivilizationMutation.isPending || completeWizardMutation.isPending}
                className="w-full text-lg py-6 bg-purple-600 hover:bg-purple-700"
                data-testid="button-finish-wizard"
              >
                {createCivilizationMutation.isPending || completeWizardMutation.isPending ? (
                  "⚡ Founding Civilization..."
                ) : (
                  <>
                    <Crown className="h-5 w-5 mr-2" />
                    Enter The Realm
                  </>
                )}
              </Button>
            </div>
          </div>
        );




      default:
        return null;
    }
  };

  const canContinue = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'welcome':
        return true;
      case 'nft-verification':
        return nftVerification.verification_status === 'completed';
      case 'profile-commander':
        return profileData.player_name.trim().length > 0 && profileData.commander_class;
      case 'civilization-religion':
        return civilizationData.civilization_name.trim().length > 0 && profileData.religion;
      case 'customization':
        return civilizationData.motto.trim().length > 0;
      case 'allies-complete':
        return true; // Final step is always accessible
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="first-time-wizard-dialog wizard-dialog-container" data-testid="first-time-wizard">
        <DialogHeader className="wizard-header">
          <DialogTitle className="wizard-title text-center font-bold text-white">
            🏰 First-Time Setup
          </DialogTitle>
          
          {/* Mobile-optimized Progress indicators */}
          <div className="flex justify-center mt-2 sm:mt-4">
            {/* Mobile: Show only current step number */}
            <div className="sm:hidden flex flex-col items-center gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Step</span>
                <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                  {currentStep + 1} / {WIZARD_STEPS.length}
                </span>
              </div>
              <span className="text-slate-300 text-center text-xs leading-tight">
                {WIZARD_STEPS[currentStep].title}
              </span>
            </div>
            
            {/* Desktop: Show all steps */}
            <div className="hidden sm:flex space-x-2">
              {WIZARD_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs ${
                    index === currentStep
                      ? 'bg-blue-600 text-white'
                      : index < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                  data-testid={`wizard-step-${index}`}
                >
                  <step.icon className="h-3 w-3" />
                  <span className="hidden md:inline">{step.title}</span>
                  {index < currentStep && <Check className="h-3 w-3" />}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>
        
        <div className="wizard-content">
          {renderStepContent()}
        </div>
        
        {/* Mobile-optimized Navigation buttons */}
        <div className="wizard-navigation">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="wizard-button border-slate-600 text-white hover:bg-slate-700"
            data-testid="button-wizard-previous"
          >
            <ArrowLeft className="wizard-icon-small sm:mr-2" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Back</span>
          </Button>
          
          {currentStep < WIZARD_STEPS.length - 1 && (
            <Button
              onClick={nextStep}
              disabled={!canContinue()}
              className="wizard-button bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-wizard-next"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Continue</span>
              <ArrowRight className="wizard-icon-small sm:ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
