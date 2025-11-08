import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Crown, ExternalLink, Users, Link, Globe, Twitter, Github, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DiscoveredProject {
  id: string;
  name: string;
  description?: string;
  chain: string;
  issuerWallet: string;
  nftTokenTaxon?: number;
  contractAddress?: string;
  ownerWalletAddress?: string;
  claimStatus: 'unclaimed' | 'claimed' | 'pending';
  walletLinks?: Array<{
    walletAddress: string;
    chain: string;
    linkType: string;
  }>;
  userRole?: string;
  logoUrl?: string;
  websiteUrl?: string;
  socialLinks?: Record<string, string>;
}

interface ProjectDiscoveryCardProps {
  project: DiscoveredProject;
  canClaim?: boolean;
  onProjectClaimed?: () => void;
}

interface ClaimFormData {
  vanitySlugRequested: string;
  projectDescription: string;
  projectWebsite: string;
  projectSocialLinks: Record<string, string>;
}

export default function ProjectDiscoveryCard({ project, canClaim = false, onProjectClaimed }: ProjectDiscoveryCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimForm, setClaimForm] = useState<ClaimFormData>({
    vanitySlugRequested: '',
    projectDescription: project.description || '',
    projectWebsite: project.websiteUrl || '',
    projectSocialLinks: project.socialLinks || {}
  });

  const claimProjectMutation = useMutation({
    mutationFn: async (claimData: any) => {
      return await apiRequest('/api/projects/claims', {
        method: 'POST',
        body: claimData
      });
    },
    onSuccess: () => {
      toast({
        title: "Project Claim Submitted",
        description: "Your claim has been submitted and is pending review.",
      });
      setIsClaimModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/wallet-project-links/auto-detect-projects'] });
      onProjectClaimed?.();
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.response?.data?.error || "Failed to submit project claim",
        variant: "destructive",
      });
    }
  });

  const handleClaimSubmit = async () => {
    if (!claimForm.vanitySlugRequested.trim()) {
      toast({
        title: "Missing Required Field",
        description: "Please provide a vanity slug for your project",
        variant: "destructive",
      });
      return;
    }

    const claimData = {
      issuerWallet: project.issuerWallet,
      chain: project.chain,
      nftTokenTaxon: project.nftTokenTaxon,
      contractAddress: project.contractAddress,
      claimantWallet: project.walletLinks?.[0]?.walletAddress || '',
      claimantChain: project.walletLinks?.[0]?.chain || project.chain,
      ownershipProofType: 'control_verification',
      ownershipProofData: {
        method: 'wallet_link_verification',
        linkedWallets: project.walletLinks,
        discoveredFrom: 'auto_detection'
      },
      vanitySlugRequested: claimForm.vanitySlugRequested,
      projectDescription: claimForm.projectDescription,
      projectWebsite: claimForm.projectWebsite,
      projectSocialLinks: claimForm.projectSocialLinks
    };

    await claimProjectMutation.mutateAsync(claimData);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unclaimed':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'claimed':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'issuer':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'manager':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <Card 
      className="project-discovery-card hover:shadow-lg transition-all duration-200"
      data-testid={`project-card-${project.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {project.logoUrl ? (
              <img 
                src={project.logoUrl} 
                alt={`${project.name} logo`}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                {project.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {project.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {project.description || 'No description available'}
              </CardDescription>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {project.chain.toUpperCase()}
                </Badge>
                <Badge className={getStatusColor(project.claimStatus)}>
                  {project.claimStatus}
                </Badge>
                {project.userRole && (
                  <Badge className={getRoleColor(project.userRole)}>
                    <Crown className="w-3 h-3 mr-1" />
                    {project.userRole}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {project.websiteUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(project.websiteUrl, '_blank')}
              data-testid={`project-website-${project.id}`}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Project Details */}
          <div className="project-details space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Issuer Address</span>
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {formatAddress(project.issuerWallet)}
              </code>
            </div>
            {project.nftTokenTaxon && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Token Taxon</span>
                <span className="font-medium">{project.nftTokenTaxon}</span>
              </div>
            )}
          </div>

          {/* Linked Wallets */}
          {project.walletLinks && project.walletLinks.length > 0 && (
            <div className="linked-wallets">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">Connected Wallets ({project.walletLinks.length})</span>
              </div>
              <div className="space-y-1">
                {project.walletLinks.slice(0, 3).map((link, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {link.chain.toUpperCase()}
                    </span>
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {formatAddress(link.walletAddress)}
                    </code>
                  </div>
                ))}
                {project.walletLinks.length > 3 && (
                  <div className="text-xs text-slate-500">
                    +{project.walletLinks.length - 3} more wallets
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Links */}
          {project.socialLinks && Object.keys(project.socialLinks).length > 0 && (
            <div className="social-links">
              <div className="flex items-center space-x-2">
                {project.socialLinks?.website && (
                  <Button variant="ghost" size="sm" onClick={() => window.open(project.socialLinks?.website, '_blank')}>
                    <Globe className="w-4 h-4" />
                  </Button>
                )}
                {project.socialLinks?.twitter && (
                  <Button variant="ghost" size="sm" onClick={() => window.open(project.socialLinks?.twitter, '_blank')}>
                    <Twitter className="w-4 h-4" />
                  </Button>
                )}
                {project.socialLinks?.github && (
                  <Button variant="ghost" size="sm" onClick={() => window.open(project.socialLinks?.github, '_blank')}>
                    <Github className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="actions pt-2 border-t border-slate-200 dark:border-slate-700">
            {canClaim && project.claimStatus === 'unclaimed' && (
              <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="default" 
                    className="w-full"
                    data-testid={`claim-project-${project.id}`}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Claim Project Ownership
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Claim Project Ownership</DialogTitle>
                    <DialogDescription>
                      Claim ownership of "{project.name}" and provide additional project information.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="vanitySlug">Vanity URL Slug *</Label>
                      <Input
                        id="vanitySlug"
                        value={claimForm.vanitySlugRequested}
                        onChange={(e) => setClaimForm(prev => ({ ...prev, vanitySlugRequested: e.target.value }))}
                        placeholder="my-awesome-project"
                        data-testid="claim-vanity-slug"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Will be available at: riddle.app/project/{claimForm.vanitySlugRequested}
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="projectDescription">Project Description</Label>
                      <Textarea
                        id="projectDescription"
                        value={claimForm.projectDescription}
                        onChange={(e) => setClaimForm(prev => ({ ...prev, projectDescription: e.target.value }))}
                        placeholder="Describe your project..."
                        rows={3}
                        data-testid="claim-description"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="projectWebsite">Website URL</Label>
                      <Input
                        id="projectWebsite"
                        type="url"
                        value={claimForm.projectWebsite}
                        onChange={(e) => setClaimForm(prev => ({ ...prev, projectWebsite: e.target.value }))}
                        placeholder="https://yourproject.com"
                        data-testid="claim-website"
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsClaimModalOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleClaimSubmit}
                        disabled={claimProjectMutation.isPending}
                        className="flex-1"
                        data-testid="submit-claim"
                      >
                        {claimProjectMutation.isPending ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Claim'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {project.claimStatus === 'pending' && (
              <div className="flex items-center justify-center space-x-2 text-sm text-blue-600">
                <AlertTriangle className="w-4 h-4" />
                <span>Claim pending review</span>
              </div>
            )}

            {project.claimStatus === 'claimed' && project.userRole && (
              <Button variant="outline" className="w-full">
                <Link className="w-4 h-4 mr-2" />
                Manage Project
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
