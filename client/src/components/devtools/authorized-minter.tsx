import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Coins, Crown, Settings, CheckCircle2, Clock, 
  ArrowRight, AlertTriangle, Copy, ExternalLink, Wallet
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { XamanPaymentModal } from '@/components/xaman/XamanPaymentModal';

interface Collection {
  id: string;
  name: string;
  mintPrice: number;
  remainingToMint: number;
  totalSupply: number;
  nextTokenId: number;
}

interface CollectionStatus extends Collection {
  mintedCount: number;
  issuerAddress: string;
  partnerType?: string;
}

export default function AuthorizedMinter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupData, setSetupData] = useState({
    minterAddress: '',
    issuerSeed: ''
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'riddle-wallet' | 'xaman'>('riddle-wallet');

  // Fetch available collections
  const { data: collections = [], isLoading: collectionsLoading } = useQuery<Collection[]>({
    queryKey: ['/api/authorized-minter/collections'],
  });

  // Fetch specific collection status
  const { data: collectionStatus, refetch: refetchStatus } = useQuery<{ collection: CollectionStatus }>({
    queryKey: ['/api/authorized-minter/status', selectedCollection],
    enabled: !!selectedCollection,
  });

  // Setup authorized minter
  const setupMinter = useMutation({
    mutationFn: async (data: { collectionId: string; minterAddress: string; issuerSeed: string }) => {
      return apiRequest('/api/authorized-minter/authorize-minter', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Minter Authorized",
        description: "The authorized minter has been set up successfully!",
      });
      setIsSetupMode(false);
      setSetupData({ minterAddress: '', issuerSeed: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/authorized-minter/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to authorize minter",
        variant: "destructive",
      });
    },
  });

  // Create mint payment
  const createPayment = useMutation({
    mutationFn: async (data: { collectionId: string; paymentMethod: 'riddle-wallet' | 'xaman' }) => {
      return apiRequest('/api/authorized-minter/create-mint-payment', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      setPaymentData(data);
      setIsPaymentModalOpen(true);
      toast({
        title: "Payment Ready",
        description: "Complete payment via XAMAN to mint your NFT",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to create payment",
        variant: "destructive",
      });
    },
  });

  const handleSetupMinter = () => {
    if (!selectedCollection || !setupData.minterAddress || !setupData.issuerSeed) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setupMinter.mutate({
      collectionId: selectedCollection,
      minterAddress: setupData.minterAddress,
      issuerSeed: setupData.issuerSeed
    });
  };

  const handleMint = () => {
    if (!selectedCollection) return;
    createPayment.mutate({ 
      collectionId: selectedCollection, 
      paymentMethod: selectedPaymentMethod 
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  if (collectionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
          <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Authorized Minter</h2>
          <p className="text-muted-foreground">
            Mint NFTs from existing collections using authorized minter accounts
          </p>
        </div>
      </div>

      {/* Collection Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>Available Collections</span>
          </CardTitle>
          <CardDescription>
            Select a collection to mint from or set up authorized minting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {collections.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No collections available for authorized minting.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {collections.map((collection) => (
                <Card 
                  key={collection.id}
                  className={`cursor-pointer transition-all ${
                    selectedCollection === collection.id 
                      ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/10' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedCollection(collection.id)}
                  data-testid={`card-collection-${collection.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{collection.name}</h3>
                        <Badge variant="outline" className="mt-1 text-xs">
                          Riddle Partner Project
                        </Badge>
                      </div>
                      <Badge variant="secondary">
                        {collection.mintPrice} XRP
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-medium" data-testid={`text-remaining-${collection.id}`}>
                          {collection.remainingToMint}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Supply:</span>
                        <span className="font-medium">{collection.totalSupply}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Next Token ID:</span>
                        <span className="font-medium">#{collection.nextTokenId}</span>
                      </div>
                      
                      <Progress 
                        value={((collection.totalSupply - collection.remainingToMint) / collection.totalSupply) * 100}
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Details & Actions */}
      {selectedCollection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Collection Management</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSetupMode(!isSetupMode)}
                data-testid="button-setup-minter"
              >
                <Settings className="h-4 w-4 mr-2" />
                {isSetupMode ? 'Cancel Setup' : 'Setup Minter'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Setup Mode */}
            {isSetupMode && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-4 mt-2">
                    <p className="font-medium">One-time setup required for authorized minting:</p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="minterAddress">Minter Address</Label>
                        <Input
                          id="minterAddress"
                          placeholder="rMinter... (authorized minter XRPL address)"
                          value={setupData.minterAddress}
                          onChange={(e) => setSetupData(prev => ({ ...prev, minterAddress: e.target.value }))}
                          data-testid="input-minter-address"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="issuerSeed">Issuer Seed (One-time use)</Label>
                        <Input
                          id="issuerSeed"
                          type="password"
                          placeholder="sEd... (issuer wallet seed for authorization)"
                          value={setupData.issuerSeed}
                          onChange={(e) => setSetupData(prev => ({ ...prev, issuerSeed: e.target.value }))}
                          data-testid="input-issuer-seed"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This seed is only used once to authorize the minter and is not stored.
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleSetupMinter}
                      disabled={setupMinter.isPending}
                      className="w-full"
                      data-testid="button-authorize-minter"
                    >
                      {setupMinter.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Authorizing Minter...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Authorize Minter
                        </>
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Collection Status */}
            {collectionStatus && !isSetupMode && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600" data-testid="text-minted-count">
                        {collectionStatus.collection.mintedCount}
                      </div>
                      <p className="text-sm text-muted-foreground">Minted</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600" data-testid="text-remaining-count">
                        {collectionStatus.collection.remainingToMint}
                      </div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600" data-testid="text-mint-price">
                        {collectionStatus.collection.mintPrice} XRP
                      </div>
                      <p className="text-sm text-muted-foreground">Mint Price</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Issuer Address */}
                {collectionStatus.collection.issuerAddress && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Issuer Address</Label>
                        <p className="text-sm text-muted-foreground font-mono" data-testid="text-issuer-address">
                          {collectionStatus.collection.issuerAddress}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(collectionStatus.collection.issuerAddress)}
                          data-testid="button-copy-address"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="button-view-xrpscan"
                        >
                          <a
                            href={`https://xrpscan.com/account/${collectionStatus.collection.issuerAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <Select value={selectedPaymentMethod} onValueChange={(value: 'riddle-wallet' | 'xaman') => setSelectedPaymentMethod(value)}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue placeholder="Choose payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="riddle-wallet">
                        <div className="flex items-center space-x-2">
                          <Wallet className="h-4 w-4" />
                          <span>Riddle Wallet</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="xaman">
                        <div className="flex items-center space-x-2">
                          <Crown className="h-4 w-4" />
                          <span>XAMAN</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mint Button */}
                <Button
                  onClick={handleMint}
                  disabled={createPayment.isPending || collectionStatus.collection.remainingToMint <= 0}
                  className="w-full"
                  size="lg"
                  data-testid="button-mint-nft"
                >
                  {createPayment.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Creating Payment...
                    </>
                  ) : collectionStatus.collection.remainingToMint <= 0 ? (
                    'Sold Out'
                  ) : (
                    <>
                      <Coins className="h-4 w-4 mr-2" />
                      Mint NFT for {collectionStatus.collection.mintPrice} XRP via {selectedPaymentMethod === 'riddle-wallet' ? 'Riddle' : 'XAMAN'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* XAMAN Payment Modal */}
      {paymentData && (
        <XamanPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPaymentData(null);
          }}
          defaultAmount={paymentData.collection?.mintPrice?.toString() || ''}
          defaultDestination={paymentData.treasuryAddress || ''}
          defaultCurrency="XRP"
          defaultMemo={`Mint ${paymentData.collection?.name} NFT #${paymentData.collection?.nextTokenId}`}
          onPaymentSuccess={(data: any) => {
            toast({
              title: "Payment Successful!",
              description: `NFT mint initiated for ${paymentData.collection?.name}`,
            });
            setIsPaymentModalOpen(false);
            setPaymentData(null);
            // Refresh collection status
            if (selectedCollection) {
              refetchStatus();
            }
          }}
          onPaymentError={(error: string) => {
            toast({
              title: "Payment Failed",
              description: error,
              variant: "destructive",
            });
          }}
        />
      )}
    </div>
  );
}
