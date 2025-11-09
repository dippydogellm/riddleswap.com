import { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Typography, 
  Box, 
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  Collections,
  SportsEsports,
  EmojiEvents,
  Star,
  TrendingUp
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../hooks/use-user';
import { useSession } from '@/utils/sessionManager';
import { getSessionToken } from '@/utils/transactionAuth';
import NFTCard from '@/components/NFTCard';
import StatsCard from '@/components/StatsCard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function GamingDashboard() {
  const { user } = useUser();
  const { isLoggedIn, sessionToken } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  
  // Verify session token is available
  useEffect(() => {
    const token = getSessionToken();
    if (!token && !isLoggedIn) {
      console.warn('🎮 [Gaming] No session token found - user may need to login');
    } else {
      console.log('✅ [Gaming] Session detected:', token ? 'YES' : 'NO', 'isLoggedIn:', isLoggedIn);
    }
  }, [isLoggedIn, sessionToken]);

  // Fetch user's gaming NFTs with session token
  const { data: userNFTs, isLoading: loadingNFTs } = useQuery({
    queryKey: ['/api/gaming/my-nfts'],
    enabled: !!user || isLoggedIn,
  });

  // Fetch collections overview
  const { data: collections, isLoading: loadingCollections } = useQuery({
    queryKey: ['/api/inquisition/collections'],
  });

  // Fetch user's battles with session token
  const { data: battles, isLoading: loadingBattles } = useQuery({
    queryKey: ['/api/battles/my-battles'],
    enabled: !!user || isLoggedIn,
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (!user && !isLoggedIn) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">
          Please connect your wallet to view your gaming dashboard.
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button 
            variant="contained" 
            onClick={() => window.location.href = '/wallet-login'}
            sx={{ mr: 2 }}
          >
            Login to Riddle Wallet
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => window.location.href = '/external-wallets'}
          >
            Connect External Wallet
          </Button>
        </Box>
      </Container>
    );
  }

  const nftsArray = Array.isArray(userNFTs) ? userNFTs : [];
  const collectionsArray = Array.isArray(collections) ? collections : [];
  const battlesArray = Array.isArray(battles) ? battles : [];

  // Calculate stats
  const totalNFTs = nftsArray.length;
  const uniqueCollections = new Set(nftsArray.map((nft: any) => nft.collection_id)).size;
  const totalBattles = battlesArray.length;
  const wonBattles = battlesArray.filter((b: any) => b.winner_id === user.id).length;
  const winRate = totalBattles > 0 ? ((wonBattles / totalBattles) * 100).toFixed(1) : '0';

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h3" 
          sx={{ 
            fontWeight: 800, 
            mb: 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Gaming Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your NFT collection, battle history, and statistics
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Total NFTs"
            value={totalNFTs}
            subtitle="Across all collections"
            icon={<Collections sx={{ fontSize: 32 }} />}
            color="#667eea"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Collections"
            value={uniqueCollections}
            subtitle="Unique collections owned"
            icon={<Star sx={{ fontSize: 32 }} />}
            color="#764ba2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Total Battles"
            value={totalBattles}
            subtitle={`${wonBattles} victories`}
            icon={<SportsEsports sx={{ fontSize: 32 }} />}
            color="#f093fb"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Win Rate"
            value={`${winRate}%`}
            subtitle="Battle success rate"
            icon={<EmojiEvents sx={{ fontSize: 32 }} />}
            color="#4facfe"
            trend={totalBattles > 0 ? { value: parseFloat(winRate), isPositive: parseFloat(winRate) >= 50 } : undefined}
          />
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab icon={<Collections />} label="My NFTs" iconPosition="start" />
            <Tab icon={<Star />} label="Collections" iconPosition="start" />
            <Tab icon={<SportsEsports />} label="Battles" iconPosition="start" />
          </Tabs>
        </Box>

        {/* My NFTs Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: 3 }}>
            {loadingNFTs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : nftsArray.length === 0 ? (
              <Alert severity="info">
                You don't have any gaming NFTs yet. Browse collections to get started!
              </Alert>
            ) : (
              <Grid container spacing={3}>
                {nftsArray.map((nft: any) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={nft.id}>
                    <NFTCard
                      nftId={nft.nft_token_id || nft.id}
                      name={nft.name || `NFT #${nft.id}`}
                      image={nft.image_url}
                      collectionName={nft.collection_name || 'Unknown'}
                      rarityTier={nft.rarity_tier}
                      rarityScore={nft.total_rarity_score}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Collections Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: 3 }}>
            {loadingCollections ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={3}>
                {collectionsArray.map((collection: any) => (
                  <Grid item xs={12} sm={6} md={4} key={collection.id}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                          {collection.collection_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {collection.game_role || 'Unknown Role'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          <Chip label={`Supply: ${collection.actual_supply || 0}`} size="small" />
                          {collection.base_power_level && (
                            <Chip 
                              label={`Power: ${collection.base_power_level}`} 
                              size="small" 
                              color="primary"
                            />
                          )}
                        </Box>
                        <Button 
                          variant="outlined" 
                          fullWidth 
                          href={`/gaming/collection/${collection.issuer_address}:${collection.taxon}`}
                        >
                          View Collection
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </TabPanel>

        {/* Battles Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 3 }}>
            {loadingBattles ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : battlesArray.length === 0 ? (
              <Alert severity="info">
                You haven't participated in any battles yet. Challenge other players to get started!
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {battlesArray.map((battle: any) => (
                  <Grid item xs={12} key={battle.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6">
                              Battle #{battle.id}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(battle.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                          <Chip
                            label={battle.winner_id === user.id ? 'Victory' : 'Defeat'}
                            color={battle.winner_id === user.id ? 'success' : 'error'}
                            icon={battle.winner_id === user.id ? <EmojiEvents /> : undefined}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </TabPanel>
      </Card>
    </Container>
  );
}
