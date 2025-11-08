import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Crown, 
  Search, 
  Settings, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  X, 
  AlertTriangle,
  RefreshCw,
  Users,
  Coins,
  TrendingUp,
  Globe,
  Calendar,
  Filter,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface ProjectClaim {
  id: string;
  claimed_project_name: string;
  vanity_slug_requested: string;
  chain: string;
  issuer_wallet: string;
  nft_token_taxon?: number;
  claimant_wallet: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  project_description?: string;
  project_website?: string;
  project_social_links?: Record<string, string>;
  project_logo_url?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  approval_notes?: string;
  project_id?: string;
}

interface ClaimedProject {
  id: string;
  name: string;
  description?: string;
  vanity_slug?: string;
  issuer_wallet?: string;
  nft_token_taxon?: number;
  claim_status: 'claimed' | 'unclaimed' | 'pending';
  logo_url?: string;
  website_url?: string;
  social_links?: Record<string, string>;
  created_at: string;
  updated_at?: string;
  bithomp_collection_name?: string;
  bithomp_verified?: boolean;
  bithomp_total_nfts?: number;
  bithomp_owners_count?: number;
  bithomp_floor_price?: string;
  services_count?: number;
  auto_bithomp_enriched?: boolean;
}

interface ClaimedProjectsDashboardProps {
  className?: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function ClaimedProjectsDashboard({ className }: ClaimedProjectsDashboardProps) {
  const { toast } = useToast();
  const { user, walletAddresses } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const userWallet = walletAddresses?.xrpAddress || user?.walletAddress;

  // Fetch project claims
  const { 
    data: claimsData, 
    isLoading: claimsLoading, 
    error: claimsError,
    refetch: refetchClaims
  } = useQuery({
    queryKey: ['/api/projects/claims', userWallet],
    queryFn: async () => {
      if (!userWallet) throw new Error('No wallet address found');
      
      const response = await apiRequest(`/api/projects/claims?claimantWallet=${userWallet}`);
      const result = await response.json() as any;
      return result.claims as ProjectClaim[];
    },
    enabled: !!userWallet,
  });

  // Fetch owned projects
  const { 
    data: ownedProjectsData, 
    isLoading: projectsLoading,
    refetch: refetchProjects
  } = useQuery({
    queryKey: ['/api/projects', userWallet],
    queryFn: async () => {
      if (!userWallet) throw new Error('No wallet address found');
      
      const response = await apiRequest(`/api/projects?ownerWallet=${userWallet}`);
      const result = await response.json() as any;
      return result.projects as ClaimedProject[];
    },
    enabled: !!userWallet,
  });

  // Cancel claim mutation
  const cancelClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      return await apiRequest(`/api/projects/claims/${claimId}/cancel`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Claim Cancelled",
        description: "Your project claim has been cancelled successfully.",
      });
      refetchClaims();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Cancel Claim",
        description: error.response?.data?.error || "Failed to cancel claim",
        variant: "destructive",
      });
    },
  });

  const claims = claimsData || [];
  const ownedProjects = ownedProjectsData || [];

  // Filter claims based on search and status
  const filteredClaims = claims.filter(claim => {
    const matchesSearch = searchQuery === '' || 
      claim.claimed_project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.vanity_slug_requested.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.issuer_wallet.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (claimsLoading || projectsLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            My Claimed Projects
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your project claims and owned collections
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchClaims();
            refetchProjects();
          }}
          data-testid="refresh-dashboard"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Crown className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="owned-projects-count">
                  {ownedProjects.length}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Owned Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="pending-claims-count">
                  {claims.filter(c => c.status === 'pending').length}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="approved-claims-count">
                  {claims.filter(c => c.status === 'approved').length}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Approved Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="total-nfts-count">
                  {ownedProjects.reduce((sum, p) => sum + (p.bithomp_total_nfts || 0), 0).toLocaleString()}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total NFTs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search projects, vanity slugs, or addresses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-projects-input"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <div className="flex space-x-2">
            {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                data-testid={`filter-${status}`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Claims List */}
      {filteredClaims.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Crown className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Claims Found</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchQuery || statusFilter !== 'all' 
                ? 'No claims match your current filters.'
                : 'You haven\'t submitted any project claims yet.'
              }
            </p>
            {searchQuery === '' && statusFilter === 'all' && (
              <Button data-testid="start-claiming-from-dashboard">
                <Crown className="w-4 h-4 mr-2" />
                Start Claiming Projects
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredClaims.map((claim) => (
            <Card 
              key={claim.id} 
              className="hover:shadow-lg transition-all duration-200"
              data-testid={`claim-card-${claim.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {claim.project_logo_url ? (
                      <img 
                        src={claim.project_logo_url} 
                        alt={`${claim.claimed_project_name} logo`}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        {claim.claimed_project_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold truncate">
                        {claim.claimed_project_name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            /{claim.vanity_slug_requested}
                          </code>
                          <Badge className={getStatusColor(claim.status)}>
                            {getStatusIcon(claim.status)}
                            <span className="ml-1">{claim.status}</span>
                          </Badge>
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                  {claim.project_website && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(claim.project_website, '_blank')}
                      data-testid={`claim-website-${claim.id}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Project Description */}
                  {claim.project_description && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Description</h4>
                      <p className="text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded line-clamp-2">
                        {claim.project_description}
                      </p>
                    </div>
                  )}

                  {/* Project Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Chain</span>
                      <p className="font-medium">{claim.chain.toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Issuer</span>
                      <p className="font-mono text-xs">{formatAddress(claim.issuer_wallet)}</p>
                    </div>
                    {claim.nft_token_taxon && (
                      <>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Taxon</span>
                          <p className="font-medium">{claim.nft_token_taxon}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Submitted</span>
                      <p className="font-medium">{formatDate(claim.created_at)}</p>
                    </div>
                  </div>

                  {/* Status-specific content */}
                  {claim.status === 'approved' && claim.approval_notes && (
                    <Alert>
                      <CheckCircle2 className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Approved:</strong> {claim.approval_notes}
                      </AlertDescription>
                    </Alert>
                  )}

                  {claim.status === 'rejected' && claim.rejection_reason && (
                    <Alert variant="destructive">
                      <X className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Rejected:</strong> {claim.rejection_reason}
                      </AlertDescription>
                    </Alert>
                  )}

                  {claim.reviewed_at && (
                    <div className="text-xs text-slate-500">
                      Reviewed on {formatDate(claim.reviewed_at)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {claim.status === 'approved' && claim.project_id && (
                      <Button 
                        variant="default" 
                        size="sm"
                        className="flex-1"
                        data-testid={`manage-project-${claim.id}`}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Manage Project
                      </Button>
                    )}

                    {claim.status === 'pending' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => cancelClaimMutation.mutate(claim.id)}
                        disabled={cancelClaimMutation.isPending}
                        className="flex-1"
                        data-testid={`cancel-claim-${claim.id}`}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Claim
                      </Button>
                    )}

                    <Button 
                      variant="ghost" 
                      size="sm"
                      data-testid={`view-claim-details-${claim.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
