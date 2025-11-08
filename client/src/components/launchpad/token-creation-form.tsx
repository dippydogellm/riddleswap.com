import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  X, 
  Upload, 
  Rocket, 
  DollarSign, 
  Timer, 
  Users,
  Shield,
  Info,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChainLogo } from "@/components/ChainLogo";
import { getAllChains, getChainInfo } from "@/utils/chains";

interface TokenCreationFormProps {
  onClose: () => void;
  userWallet: string;
}

interface TokenFormData {
  chainType: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenLogo: string;
  totalSupply: string;
  presaleAmount: string;
  presalePrice: string;
  liquidityThreshold: string;
  softCap: string;
  hardCap: string;
}

export function TokenCreationForm({ onClose, userWallet }: TokenCreationFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TokenFormData>({
    chainType: "xrpl",
    tokenName: "",
    tokenSymbol: "",
    tokenDescription: "",
    tokenLogo: "",
    totalSupply: "",
    presaleAmount: "",
    presalePrice: "",
    liquidityThreshold: "",
    softCap: "",
    hardCap: ""
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const chains = getAllChains();

  const createTokenMutation = useMutation({
    mutationFn: async (data: TokenFormData) => {
      return apiRequest('/api/launchpad/create', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          creatorWallet: userWallet
        })
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Token Launch Created Successfully!",
        description: `${formData.tokenName} launch is now active and ready for contributors!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/launches'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create token launch",
        variant: "destructive",
      });
    }
  });

  const handleInputChange = (field: keyof TokenFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      // TODO: Upload to object storage and get URL
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, tokenLogo: previewUrl }));
    }
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        return formData.chainType && formData.tokenName && formData.tokenSymbol;
      case 2:
        return formData.totalSupply && formData.presaleAmount && formData.presalePrice;
      case 3:
        return formData.softCap && formData.hardCap && formData.liquidityThreshold;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    createTokenMutation.mutate(formData);
    setIsSubmitting(false);
  };

  const getSelectedChain = () => getChainInfo(formData.chainType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Rocket className="h-8 w-8 text-primary" />
              RiddlePad Token Launch
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
                </div>
                {step < 4 && <div className={`w-12 h-0.5 ${step < currentStep ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Basic Token Information</h3>
                <p className="text-muted-foreground">Define your token's core details and select the blockchain for your RiddlePad launch</p>
              </div>

              {/* Chain Selection */}
              <div className="space-y-3">
                <Label>Select Blockchain</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {chains.map((chain) => (
                    <Button
                      key={chain.id}
                      variant={formData.chainType === chain.id ? "default" : "outline"}
                      onClick={() => handleInputChange("chainType", chain.id)}
                      className="p-4 h-auto flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105"
                      data-testid={`chain-button-${chain.id}`}
                    >
                      <ChainLogo 
                        chainId={chain.id} 
                        size="lg" 
                        data-testid={`chain-logo-${chain.id}`}
                      />
                      <span className="font-medium">{chain.name}</span>
                      {formData.chainType === chain.id && (
                        <CheckCircle className="h-4 w-4 text-green-500" data-testid={`chain-selected-${chain.id}`} />
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenName">Token Name *</Label>
                  <Input
                    id="tokenName"
                    placeholder="e.g., MyAwesome Token"
                    value={formData.tokenName}
                    onChange={(e) => handleInputChange("tokenName", e.target.value)}
                    data-testid="input-token-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tokenSymbol">Token Symbol *</Label>
                  <Input
                    id="tokenSymbol"
                    placeholder="e.g., MAT"
                    value={formData.tokenSymbol}
                    onChange={(e) => handleInputChange("tokenSymbol", e.target.value.toUpperCase())}
                    maxLength={10}
                    data-testid="input-token-symbol"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokenDescription">Description</Label>
                <Textarea
                  id="tokenDescription"
                  placeholder="Describe your token's purpose, utility, and vision..."
                  value={formData.tokenDescription}
                  onChange={(e) => handleInputChange("tokenDescription", e.target.value)}
                  rows={3}
                  data-testid="input-token-description"
                />
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Token Logo</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  {formData.tokenLogo ? (
                    <div className="flex items-center justify-center gap-4">
                      <img src={formData.tokenLogo} alt="Token logo" className="w-16 h-16 rounded-full" />
                      <Button variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
                        Change Logo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Upload token logo (recommended: 512x512px)</p>
                      <Button variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
                        Choose File
                      </Button>
                    </div>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Token Economics */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Token Economics</h3>
                <p className="text-muted-foreground">Configure your token's supply and presale pricing</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalSupply">Total Supply *</Label>
                  <Input
                    id="totalSupply"
                    type="number"
                    placeholder="1000000"
                    value={formData.totalSupply}
                    onChange={(e) => handleInputChange("totalSupply", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Total number of tokens to be created</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="presaleAmount">Presale Amount *</Label>
                  <Input
                    id="presaleAmount"
                    type="number"
                    placeholder="500000"
                    value={formData.presaleAmount}
                    onChange={(e) => handleInputChange("presaleAmount", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Tokens available for presale</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="presalePrice">Presale Price (in {getSelectedChain()?.nativeCurrency || 'Native Currency'}) *</Label>
                <Input
                  id="presalePrice"
                  type="number"
                  step="0.000001"
                  placeholder="0.001"
                  value={formData.presalePrice}
                  onChange={(e) => handleInputChange("presalePrice", e.target.value)}
                  data-testid="input-presale-price"
                />
                <p className="text-xs text-muted-foreground">Price per token in {getSelectedChain()?.nativeCurrency || 'native currency'}</p>
              </div>

              {/* Economics Preview */}
              {formData.presaleAmount && formData.presalePrice && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Presale Economics
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Presale Value:</span>
                        <div className="font-medium">
                          {(parseFloat(formData.presaleAmount) * parseFloat(formData.presalePrice)).toFixed(2)} {getSelectedChain()?.nativeCurrency || 'tokens'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Platform Fee (1%):</span>
                        <div className="font-medium">
                          {((parseFloat(formData.presaleAmount) * parseFloat(formData.presalePrice)) * 0.01).toFixed(2)} {getSelectedChain()?.nativeCurrency || 'tokens'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Presale Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">RiddlePad Launch Configuration</h3>
                <p className="text-muted-foreground">Set your fundraising targets and liquidity requirements</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="softCap">Soft Cap ({getSelectedChain()?.nativeCurrency || 'Native Currency'}) *</Label>
                  <Input
                    id="softCap"
                    type="number"
                    placeholder="100"
                    value={formData.softCap}
                    onChange={(e) => handleInputChange("softCap", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Minimum amount to proceed with launch</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hardCap">Hard Cap ({getSelectedChain()?.nativeCurrency || 'Native Currency'}) *</Label>
                  <Input
                    id="hardCap"
                    type="number"
                    placeholder="1000"
                    value={formData.hardCap}
                    onChange={(e) => handleInputChange("hardCap", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Maximum amount to raise</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="liquidityThreshold">Liquidity Creation Threshold ({getSelectedChain()?.nativeCurrency || 'Native Currency'}) *</Label>
                <Input
                  id="liquidityThreshold"
                  type="number"
                  placeholder="500"
                  value={formData.liquidityThreshold}
                  onChange={(e) => handleInputChange("liquidityThreshold", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Amount needed to automatically create liquidity pool</p>
              </div>

              {/* Configuration Preview */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    RiddlePad Launch Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Blockchain:</span>
                      <Badge variant="secondary">{getSelectedChain()?.name}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Launch Fee:</span>
                      <span className="font-medium text-green-600">FREE</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Fee:</span>
                      <span className="font-medium">1% of raised amount</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Liquidity Creation:</span>
                      <span className="font-medium">Automatic when threshold met</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Review & Launch */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Review & Launch on RiddlePad</h3>
                <p className="text-muted-foreground">Review your token details before creating the launch</p>
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    {formData.tokenLogo && (
                      <img src={formData.tokenLogo} alt="Token logo" className="w-16 h-16 rounded-full" />
                    )}
                    <div>
                      <h3 className="text-xl font-bold">{formData.tokenName}</h3>
                      <p className="text-lg text-muted-foreground">${formData.tokenSymbol}</p>
                      <Badge variant="secondary" className="mt-1">
                        {getSelectedChain()?.name}
                      </Badge>
                    </div>
                  </div>

                  {formData.tokenDescription && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{formData.tokenDescription}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Supply</span>
                      <div className="font-medium">{parseFloat(formData.totalSupply).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Presale Amount</span>
                      <div className="font-medium">{parseFloat(formData.presaleAmount).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price per Token</span>
                      <div className="font-medium">{formData.presalePrice} {getSelectedChain()?.nativeCurrency || 'tokens'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hard Cap</span>
                      <div className="font-medium">{formData.hardCap} {getSelectedChain()?.nativeCurrency || 'tokens'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Launch Benefits Info */}
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800">Free RiddlePad Launch</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Your token launch will be activated immediately on RiddlePad with no upfront fees. Revenue sharing applies only after successful funding completion.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              data-testid="button-previous-step"
            >
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {currentStep < 4 ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!validateStep(currentStep)}
                  data-testid="button-next-step"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!validateStep(currentStep) || isSubmitting}
                  className="bg-primary text-primary-foreground"
                  data-testid="button-create-launch"
                >
                  {isSubmitting ? "Creating..." : "Create Launch"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
