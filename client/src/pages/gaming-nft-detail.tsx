// @ts-nocheck
/**
 * Gaming NFT Detail Page - Material UI
 * Comprehensive NFT information with all available data
 */

import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  Container,
  Grid,
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  Paper,
  Tabs,
  Tab,
  Stack,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

// Import our reusable components
import NFTImageDisplay from '@/components/gaming/NFTImageDisplay';
import NFTPowerBreakdown from '@/components/gaming/NFTPowerBreakdown';
import NFTOwnershipHistory from '@/components/gaming/NFTOwnershipHistory';
import NFTTraitsDisplay from '@/components/gaming/NFTTraitsDisplay';
import NFTProjectBadge from '@/components/gaming/NFTProjectBadge';

interface NFTDetailData {
  nft_token_id: string;
  collection_name: string;
  collection_id: string;
  nft_name: string;
  image_url: string;
  ai_generated_image_url?: string;
  current_owner: string;
  issuer_address: string;
  taxon: number;
  
  // Trait data
  all_traits: Record<string, any>;
  special_powers: string[];
  materials_found: string[];
  rarities_found: string[];
  
  // Power attributes
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  material_multiplier: number;
  rarity_multiplier: number;
  trait_mapping: Record<string, number>;
  
  // Rarity
  rarity_rank?: number;
  rarity_score?: number;
  
  // Metadata
  metadata: Record<string, any>;
  description?: string;
  
  // Project info
  is_our_project: boolean;
  is_partner_project: boolean;
  project_score: number;
  partner_tier?: 'gold' | 'silver' | 'bronze';
}

export default function GamingNFTDetailPage() {
  const [, routeParams] = useRoute('/gaming/nft/:nftTokenId');
  const [, navigate] = useLocation();
  const [currentTab, setCurrentTab] = useState(0);

  const nftTokenId = (routeParams && 'nftTokenId' in routeParams ? routeParams.nftTokenId : '') || '';

  // Fetch NFT details
  const { data, isLoading, error } = useQuery({
    queryKey: ['gaming-nft-detail', nftTokenId],
    queryFn: async () => {
      const res = await fetch(`/api/gaming/nft/${nftTokenId}`);
      if (!res.ok) throw new Error('Failed to load NFT details');
      const result = await res.json() as any;
      return result.data as NFTDetailData;
    },
    enabled: !!nftTokenId,
  });

  const nft = data;

  // Fetch current user
  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) return null;
      return res.json();
    },
  });

  const currentUser = userData?.user;
  const isOwner = currentUser && nft && 
    currentUser.walletAddress?.toLowerCase() === nft.current_owner?.toLowerCase();

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error || !nft) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load NFT details. Please try again.
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/gaming/dashboard')}
        >
          Back to Gaming Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 3 }}
        >
          <Link
            underline="hover"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer' }}
          >
            Home
          </Link>
          <Link
            underline="hover"
            color="inherit"
            onClick={() => navigate('/gaming/dashboard')}
            sx={{ cursor: 'pointer' }}
          >
            Gaming
          </Link>
          <Typography color="text.primary">
            {nft.nft_name || 'NFT Details'}
          </Typography>
        </Breadcrumbs>

        {/* Back Button */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/gaming/dashboard')}
          sx={{ mb: 3 }}
        >
          Back to Dashboard
        </Button>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - Image and Basic Info */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* NFT Image with History */}
              <NFTImageDisplay
                nftTokenId={nft.nft_token_id}
                currentImageUrl={nft.ai_generated_image_url || nft.image_url}
                nftName={nft.nft_name}
              />

              {/* Project Badge */}
              <NFTProjectBadge
                collectionName={nft.collection_name}
                isOurProject={nft.is_our_project}
                isPartnerProject={nft.is_partner_project}
                projectScore={nft.project_score}
                partnerTier={nft.partner_tier}
              />

              {/* Basic Info Card */}
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="h5" gutterBottom fontWeight="bold">
                  {nft.nft_name}
                </Typography>
                
                {nft.description && (
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {nft.description}
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Rarity Info */}
                {(nft.rarity_rank || nft.rarity_score) && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Rarity
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      {nft.rarity_rank && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Rank
                          </Typography>
                          <Typography variant="h6" color="primary">
                            #{nft.rarity_rank}
                          </Typography>
                        </Box>
                      )}
                      {nft.rarity_score && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Score
                          </Typography>
                          <Typography variant="h6" color="primary">
                            {nft.rarity_score}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}

                {/* Owner Info */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Current Owner
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {isOwner ? (
                      <strong style={{ color: '#2ecc71' }}>You 🎉</strong>
                    ) : (
                      nft.current_owner
                    )}
                  </Typography>
                </Box>
              </Paper>
            </Stack>
          </Grid>

          {/* Right Column - Detailed Information */}
          <Grid item xs={12} md={8}>
            <Paper elevation={2}>
              <Tabs
                value={currentTab}
                onChange={(_, newValue) => setCurrentTab(newValue)}
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Power Stats" />
                <Tab label="Traits" />
                <Tab label="History" />
              </Tabs>

              <Box sx={{ p: 3 }}>
                {/* Tab 1: Power Stats */}
                {currentTab === 0 && (
                  <NFTPowerBreakdown
                    armyPower={nft.army_power}
                    religionPower={nft.religion_power}
                    civilizationPower={nft.civilization_power}
                    economicPower={nft.economic_power}
                    totalPower={nft.total_power}
                    materialMultiplier={nft.material_multiplier}
                    rarityMultiplier={nft.rarity_multiplier}
                    traitMapping={nft.trait_mapping}
                  />
                )}

                {/* Tab 2: Traits */}
                {currentTab === 1 && (
                  <NFTTraitsDisplay
                    allTraits={nft.all_traits}
                    specialPowers={nft.special_powers}
                    materialsFound={nft.materials_found}
                    raritiesFound={nft.rarities_found}
                    collectionName={nft.collection_name}
                  />
                )}

                {/* Tab 3: History */}
                {currentTab === 2 && (
                  <NFTOwnershipHistory
                    nftTokenId={nft.nft_token_id}
                    currentOwner={nft.current_owner}
                  />
                )}
              </Box>
            </Paper>

            {/* Additional Metadata */}
            {nft.metadata && Object.keys(nft.metadata).length > 0 && (
              <Paper elevation={2} sx={{ p: 2, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Technical Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Token ID
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {nft.nft_token_id}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Collection ID
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {nft.collection_id}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Issuer
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {nft.issuer_address}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Taxon
                    </Typography>
                    <Typography variant="body2">
                      {nft.taxon}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
