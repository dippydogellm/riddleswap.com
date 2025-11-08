import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  CheckCircle2, 
  Loader2, 
  Trophy,
  AlertTriangle,
  Target,
  Zap,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface DiscoveredProject {
  id: string;
  chain: string;
  issuerAddress: string;
  taxon: number;
  assetType: string;
  name: string;
  description: string;
  logoUrl: string | null;
  nftCount: number;
  discoverySource: string;
  claimedInDatabase?: boolean;
}

interface BatchClaimingProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function BatchClaiming({ onComplete, onCancel }: BatchClaimingProps) {
  const { toast } = useToast();
  const { user, walletAddresses } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [discoveredProjects, setDiscoveredProjects] = useState<DiscoveredProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<any[]>([]);

  // Auto-search with debounce
  useEffect(() => {
    const isValidXRPAddress = /^r[0-9A-Za-z]{24,34}$/.test(searchAddress);
    
    if (isValidXRPAddress) {
      const timer = setTimeout(() => {
        handleAutoSearch();
      }, 800); // 800ms debounce

      return () => clearTimeout(timer);
    } else {
      setDiscoveredProjects([]);
      setSearchError(null);
    }
  }, [searchAddress]);

  const handleAutoSearch = async () => {
    if (!searchAddress) return;
    
    console.log('🔍 [AUTO-SEARCH] Triggered for address:', searchAddress);
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await fetch('/api/wallet-project-links/search-by-issuer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issuerAddress: searchAddress,
          chain: 'xrpl'
        })
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json() as any;
      console.log('✅ [AUTO-SEARCH] Found projects:', data.projects?.length || 0);
      
      // Filter out already claimed projects
      const unclaimedProjects = (data.projects || []).filter((p: DiscoveredProject) => !p.claimedInDatabase);
      
      if (unclaimedProjects.length === 0 && (data.projects || []).length > 0) {
        setSearchError('All projects for this address have already been claimed');
      } else if (unclaimedProjects.length === 0) {
        setSearchError('No projects found for this address');
      }
      
      setDiscoveredProjects(unclaimedProjects);
    } catch (error) {
      console.error('❌ [AUTO-SEARCH] Error:', error);
      setSearchError('Failed to search for projects');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const selectAll = () => {
    setSelectedProjects(new Set(discoveredProjects.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedProjects(new Set());
  };

  // Batch claim mutation
  const batchClaimMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      const claimantWallet = walletAddresses?.xrpAddress || user?.walletAddress;
      if (!claimantWallet) {
        throw new Error('No XRP wallet address found. Please connect an XRP wallet.');
      }

      const selectedProjectsData = discoveredProjects.filter(p => projectIds.includes(p.id));
      
      const claims = selectedProjectsData.map(project => {
        // Sanitize slug with fallback
        let vanitySlug = project.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
          .slice(0, 50);
        
        // Fallback if slug is empty after sanitization
        if (!vanitySlug) {
          vanitySlug = `project-${project.issuerAddress.slice(-8)}-${project.taxon}`.toLowerCase();
        }
        
        return {
          issuerWallet: project.issuerAddress,
          chain: 'xrp',
          nftTokenTaxon: project.taxon,
          claimantWallet,
          claimantChain: 'xrp',
          ownershipProofType: 'signature' as const,
          ownershipProofData: {
            method: 'wallet_verification',
            claimantWallet,
            timestamp: Date.now(),
          },
          vanitySlugRequested: vanitySlug,
          projectDescription: project.description,
          projectLogoUrl: project.logoUrl || undefined,
        };
      });

      const response = await fetch('/api/projects/claims/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ claims }),
      });
      
      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'Failed to submit batch claims');
      }
      
      return await response.json() as any;
    },
    onSuccess: (data: any) => {
      const stats = data.stats || { successful: 0, failed: 0 };
      const errors = data.errors || [];
      
      if (stats.failed === 0) {
        // All successful
        toast({
          title: "Batch Claim Submitted Successfully",
          description: `All ${stats.successful} project claim(s) have been submitted and are pending review.`,
        });
        setClaimErrors([]);
        queryClient.invalidateQueries({ queryKey: ['/api/devtools/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects/claims'] });
        setSelectedProjects(new Set());
        setDiscoveredProjects([]);
        setSearchAddress('');
        onComplete?.();
      } else if (stats.successful > 0) {
        // Partial success
        setClaimErrors(errors);
        toast({
          title: "Partial Success",
          description: `${stats.successful} claim(s) submitted successfully, ${stats.failed} failed. Failed claims remain selected for correction.`,
          variant: "default",
        });
        
        // Remove successful projects from discovered list
        const successfulIds = new Set(data.claims?.map((c: any) => 
          `xrpl-${c.issuer_wallet}-${c.nft_token_taxon}`
        ) || []);
        
        // Keep only failed projects
        const failedProjects = discoveredProjects.filter(p => !successfulIds.has(p.id));
        setDiscoveredProjects(failedProjects);
        
        // Update selection to only failed ones
        const failedSelection = new Set(Array.from(selectedProjects).filter(id => !successfulIds.has(id)));
        setSelectedProjects(failedSelection);
        
        queryClient.invalidateQueries({ queryKey: ['/api/devtools/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects/claims'] });
      } else {
        // All failed
        setClaimErrors(errors);
        toast({
          title: "Batch Claim Failed",
          description: `All ${stats.failed} claim(s) failed. Please review the errors below and try again.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Batch Claim Failed",
        description: error.message || "Failed to submit batch claims. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBatchClaim = () => {
    if (selectedProjects.size === 0) {
      toast({
        title: "No Projects Selected",
        description: "Please select at least one project to claim",
        variant: "destructive",
      });
      return;
    }

    batchClaimMutation.mutate(Array.from(selectedProjects));
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            Batch Project Claiming
          </CardTitle>
          <CardDescription>
            Enter an XRPL issuer address to automatically discover and claim multiple projects at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-address">Issuer Wallet Address</Label>
            <div className="flex gap-2">
              <Input
                id="search-address"
                placeholder="rNvLdpKhZGnbSDzKQE..."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                data-testid="batch-search-input"
                className="flex-1"
              />
              {isSearching && (
                <div className="flex items-center px-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {isSearching ? 
                '🔍 Searching blockchain and database...' : 
                '💡 Paste an address and we\'ll automatically search for projects'
              }
            </p>
          </div>

          {searchError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {discoveredProjects.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600" />
                  Discovered Projects
                  <Badge variant="secondary">{discoveredProjects.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Select the projects you want to claim
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {discoveredProjects.map((project) => (
              <div
                key={project.id}
                className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedProjects.has(project.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
                onClick={() => toggleProjectSelection(project.id)}
                data-testid={`project-${project.id}`}
              >
                <Checkbox
                  checked={selectedProjects.has(project.id)}
                  onCheckedChange={() => toggleProjectSelection(project.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                
                {project.logoUrl && (
                  <img 
                    src={project.logoUrl} 
                    alt={project.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold truncate">{project.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      Taxon {project.taxon}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {project.discoverySource}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                    {project.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{project.nftCount} NFTs</span>
                    <span>Chain: {project.chain.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Section */}
      {discoveredProjects.length > 0 && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Ready to Claim</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedProjects.size} project(s) selected
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleBatchClaim}
                  disabled={selectedProjects.size === 0 || batchClaimMutation.isPending}
                  data-testid="batch-claim-button"
                >
                  {batchClaimMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting {selectedProjects.size} Claims...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 mr-2" />
                      Claim {selectedProjects.size} Project{selectedProjects.size !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {selectedProjects.size > 0 && (
              <Alert className="mt-4">
                <Info className="w-4 h-4" />
                <AlertDescription>
                  All {selectedProjects.size} project claim(s) will be submitted for admin review. 
                  You'll be notified once they're processed.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display Section */}
      {claimErrors.length > 0 && (
        <Card className="border-2 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Claim Errors
            </CardTitle>
            <CardDescription>
              The following claims failed. Please review and correct the issues before resubmitting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {claimErrors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertDescription>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      <div>
                        <span className="font-semibold">
                          {error.issuerWallet ? `${error.issuerWallet.slice(0, 8)}... (Taxon ${error.taxon})` : `Index ${error.index}`}:
                        </span>
                        <span className="ml-2">{error.error}</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
