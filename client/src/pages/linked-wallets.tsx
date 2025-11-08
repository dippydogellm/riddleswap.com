import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Wallet, 
  Home, 
  ArrowLeft, 
  Trash2, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Copy,
  Link,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LinkedWallet {
  id: string;
  address: string;
  chain: string;
  wallet_type: string;
  verified: boolean;
  wallet_label: string;
  source: string;
  created_at: string;
  verified_at?: string;
  last_activity?: string;
}

export default function LinkedWallets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // UI State
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [currentVerification, setCurrentVerification] = useState<{
    address: string;
    chain: string;
    walletType: string;
    nonce: string;
    message: string;
    expiresAt: Date;
  } | null>(null);
  
  // Form state
  const [newWallet, setNewWallet] = useState({
    address: '',
    chain: 'ethereum',
    walletType: 'metamask',
    walletLabel: ''
  });

  // Load linked wallets
  const { data: linkedWallets = [], isLoading, error } = useQuery<LinkedWallet[]>({
    queryKey: ['/api/linked-wallets'],
    staleTime: 30000,
    refetchInterval: 60000 // Refresh every minute
  });

  // Start verification mutation
  const startVerificationMutation = useMutation({
    mutationFn: async (payload: { address: string; chain: string; walletType: string }) => {
      return apiRequest('/api/linked-wallets/start', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (data: any, variables) => {
      setCurrentVerification({
        address: variables.address,
        chain: variables.chain,
        walletType: variables.walletType,
        nonce: data.nonce,
        message: data.message,
        expiresAt: new Date(data.expiresAt)
      });
      setShowVerification(true);
      setShowAddWallet(false);
      
      toast({
        title: "Verification Started",
        description: "Please sign the verification message in your wallet"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.error || "Failed to start wallet verification",
        variant: "destructive"
      });
    }
  });

  // Verify wallet mutation
  const verifyWalletMutation = useMutation({
    mutationFn: async (payload: { 
      address: string; 
      chain: string; 
      walletType: string; 
      signature: string; 
      nonce: string;
      walletLabel?: string;
    }) => {
      return apiRequest('/api/linked-wallets/verify', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linked-wallets'] });
      setShowVerification(false);
      setCurrentVerification(null);
      setNewWallet({ address: '', chain: 'ethereum', walletType: 'metamask', walletLabel: '' });
      
      toast({
        title: "Wallet Linked Successfully!",
        description: "Your wallet ownership has been verified and linked to your account"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.error || "Failed to verify wallet ownership",
        variant: "destructive"
      });
    }
  });

  // Save from session mutation
  const saveFromSessionMutation = useMutation({
    mutationFn: async (payload: { 
      address: string; 
      chain: string; 
      walletType: string;
      walletLabel?: string;
    }) => {
      return apiRequest('/api/linked-wallets/save-from-session', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linked-wallets'] });
      toast({
        title: "Wallet Linked",
        description: "Wallet has been linked from your active session"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Link Failed",
        description: error.error || "Failed to link wallet from session",
        variant: "destructive"
      });
    }
  });

  // Remove wallet mutation
  const removeWalletMutation = useMutation({
    mutationFn: async (walletId: string) => {
      return apiRequest(`/api/linked-wallets/${walletId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linked-wallets'] });
      toast({
        title: "Wallet Removed",
        description: "Linked wallet has been removed from your account"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Remove Failed",
        description: error.error || "Failed to remove linked wallet",
        variant: "destructive"
      });
    }
  });

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard"
    });
  };

  // Get wallet logo
  const getWalletLogo = (walletType: string) => {
    const logos = {
      metamask: "/images/wallets/metamask-logo.png",
      phantom: "/images/wallets/phantom-logo.png", 
      xaman: "/images/wallets/xaman-logo.png",
      joey: "/images/wallets/joey-logo.png"
    };
    return logos[walletType as keyof typeof logos] || "/images/wallets/metamask-logo.png";
  };

  // Get chain name
  const getChainName = (chain: string) => {
    const names = {
      ethereum: "Ethereum",
      solana: "Solana",
      xrpl: "XRPL"
    };
    return names[chain as keyof typeof names] || chain;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle wallet signing
  const handleWalletSign = async () => {
    if (!currentVerification) return;
    
    try {
      let signature = '';
      
      // Handle different wallet types
      if (currentVerification.walletType === 'metamask' && window.ethereum) {
        // MetaMask signing
        signature = await (window.ethereum as any).request({
          method: 'personal_sign',
          params: [currentVerification.message, currentVerification.address],
        });
      } else if (currentVerification.walletType === 'phantom' && window.solana) {
        // Phantom signing
        const encodedMessage = new TextEncoder().encode(currentVerification.message);
        const signedMessage = await window.solana.signMessage(encodedMessage, "utf8");
        signature = Buffer.from(signedMessage.signature).toString('hex');
      } else {
        // For Xaman/Joey, show instructions
        toast({
          title: "Sign in Your Wallet",
          description: `Please sign the verification message in your ${currentVerification.walletType} wallet`,
        });
        return;
      }
      
      // Verify the signature
      await verifyWalletMutation.mutateAsync({
        address: currentVerification.address,
        chain: currentVerification.chain,
        walletType: currentVerification.walletType,
        signature,
        nonce: currentVerification.nonce,
        walletLabel: newWallet.walletLabel || `${currentVerification.walletType} Wallet`
      });
      
    } catch (error) {
      console.error('Signing failed:', error);
      toast({
        title: "Signing Failed",
        description: "Failed to sign verification message",
        variant: "destructive"
      });
    }
  };

  const handleStartVerification = () => {
    if (!newWallet.address.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter a wallet address",
        variant: "destructive"
      });
      return;
    }
    
    startVerificationMutation.mutate({
      address: newWallet.address.trim(),
      chain: newWallet.chain,
      walletType: newWallet.walletType
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" data-testid="linked-wallets-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setLocation('/')}
              data-testid="button-home"
            >
              <Home className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Shield className="h-8 w-8 text-blue-600" />
                Linked Wallets
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="text-page-description">
                Verify and manage permanent wallet ownership for your account
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => setShowAddWallet(true)}
            className="flex items-center gap-2"
            data-testid="button-add-wallet"
          >
            <Plus className="h-4 w-4" />
            Link Wallet
          </Button>
        </div>

        {/* Linked Wallets List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8" data-testid="loading-wallets">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading linked wallets...</p>
            </div>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20" data-testid="error-loading">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  <span>Failed to load linked wallets</span>
                </div>
              </CardContent>
            </Card>
          )}

          {linkedWallets.length === 0 && !isLoading && !error && (
            <Card data-testid="empty-state">
              <CardContent className="p-12 text-center">
                <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2" data-testid="text-empty-title">No Linked Wallets</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6" data-testid="text-empty-description">
                  Link your external wallets to verify permanent ownership and access advanced features.
                </p>
                <Button onClick={() => setShowAddWallet(true)} data-testid="button-add-first-wallet">
                  <Plus className="h-4 w-4 mr-2" />
                  Link Your First Wallet
                </Button>
              </CardContent>
            </Card>
          )}

          {linkedWallets.map((wallet) => (
            <Card key={wallet.id} className="hover:shadow-md transition-shadow" data-testid={`card-wallet-${wallet.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <img 
                        src={getWalletLogo(wallet.wallet_type)} 
                        alt={wallet.wallet_type}
                        className="w-8 h-8"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/wallets/metamask-logo.png";
                        }}
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" data-testid={`text-wallet-label-${wallet.id}`}>
                          {wallet.wallet_label}
                        </h3>
                        <Badge 
                          variant={wallet.verified ? "default" : "secondary"}
                          className={wallet.verified ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}
                          data-testid={`badge-verification-${wallet.id}`}
                        >
                          {wallet.verified ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-source-${wallet.id}`}>
                          {wallet.source === 'from_session' ? 'From Session' : 'Manual'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" data-testid={`text-address-${wallet.id}`}>
                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => copyToClipboard(wallet.address)}
                            data-testid={`button-copy-${wallet.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <span className="text-xs" data-testid={`text-chain-${wallet.id}`}>
                            {getChainName(wallet.chain)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs">
                          <span data-testid={`text-created-${wallet.id}`}>
                            Linked: {formatTimestamp(wallet.created_at)}
                          </span>
                          {wallet.verified_at && (
                            <span data-testid={`text-verified-${wallet.id}`}>
                              Verified: {formatTimestamp(wallet.verified_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWalletMutation.mutate(wallet.id)}
                    disabled={removeWalletMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    data-testid={`button-remove-${wallet.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Wallet Dialog */}
        <Dialog open={showAddWallet} onOpenChange={setShowAddWallet}>
          <DialogContent data-testid="dialog-add-wallet">
            <DialogHeader>
              <DialogTitle data-testid="text-add-wallet-title">Link New Wallet</DialogTitle>
              <DialogDescription data-testid="text-add-wallet-description">
                Verify ownership of an external wallet by signing a verification message.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="walletAddress">Wallet Address</Label>
                <Input
                  id="walletAddress"
                  value={newWallet.address}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter wallet address..."
                  data-testid="input-wallet-address"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="chain">Blockchain</Label>
                  <Select
                    value={newWallet.chain}
                    onValueChange={(value) => setNewWallet(prev => ({ ...prev, chain: value }))}
                  >
                    <SelectTrigger data-testid="select-chain">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="solana">Solana</SelectItem>
                      <SelectItem value="xrpl">XRPL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="walletType">Wallet Type</Label>
                  <Select
                    value={newWallet.walletType}
                    onValueChange={(value) => setNewWallet(prev => ({ ...prev, walletType: value }))}
                  >
                    <SelectTrigger data-testid="select-wallet-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metamask">MetaMask</SelectItem>
                      <SelectItem value="phantom">Phantom</SelectItem>
                      <SelectItem value="xaman">Xaman</SelectItem>
                      <SelectItem value="joey">Joey</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="walletLabel">Wallet Label (Optional)</Label>
                <Input
                  id="walletLabel"
                  value={newWallet.walletLabel}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, walletLabel: e.target.value }))}
                  placeholder="My Trading Wallet"
                  data-testid="input-wallet-label"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowAddWallet(false)}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleStartVerification}
                disabled={startVerificationMutation.isPending}
                data-testid="button-start-verification"
              >
                {startVerificationMutation.isPending ? 'Starting...' : 'Start Verification'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Verification Dialog */}
        <Dialog open={showVerification} onOpenChange={setShowVerification}>
          <DialogContent data-testid="dialog-verification">
            <DialogHeader>
              <DialogTitle data-testid="text-verification-title">Verify Wallet Ownership</DialogTitle>
              <DialogDescription data-testid="text-verification-description">
                Sign this message in your wallet to prove ownership.
              </DialogDescription>
            </DialogHeader>
            
            {currentVerification && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <Label>Message to Sign:</Label>
                  <div className="mt-2 p-3 bg-white dark:bg-gray-900 rounded border font-mono text-sm whitespace-pre-wrap" data-testid="text-verification-message">
                    {currentVerification.message}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(currentVerification.message)}
                    className="mt-2"
                    data-testid="button-copy-message"
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Message
                  </Button>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p data-testid="text-verification-expires">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Expires: {formatTimestamp(currentVerification.expiresAt.toISOString())}
                  </p>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowVerification(false);
                  setCurrentVerification(null);
                }}
                data-testid="button-cancel-verification"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleWalletSign}
                disabled={verifyWalletMutation.isPending}
                data-testid="button-sign-message"
              >
                {verifyWalletMutation.isPending ? 'Verifying...' : 'Sign & Verify'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
