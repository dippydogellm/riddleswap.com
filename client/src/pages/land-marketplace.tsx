import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  CardMedia,
  Typography,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Stack,
  Divider,
  Alert,
  Paper,
  IconButton,
  Tooltip
} from "@mui/material";
import {
  Search as SearchIcon,
  Place as PlaceIcon,
  ShoppingCart as ShoppingCartIcon,
  AccountBalanceWallet as WalletIcon,
  Paid as CoinsIcon,
  AutoAwesome as SparklesIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Landscape as LandscapeIcon,
  Close as CloseIcon
} from "@mui/icons-material";
import { sessionManager } from "@/utils/sessionManager";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface LandPlot {
  id: string;
  plotNumber: number;
  gridSection: string;
  mapX: number;
  mapY: number;
  latitude: string;
  longitude: string;
  terrainType: string;
  terrainSubtype: string;
  plotSize: string;
  sizeMultiplier: string;
  currentPrice: string;
  rdlPrice: string;
  rdlDiscountPercent: number;
  status: string;
  specialFeatures: string[];
  resourceNodes: Record<string, any>;
  plotResources?: Record<string, any>;
  description: string;
  lore: string;
  ownerHandle?: string;
  generatedImageUrl?: string;
}

// Placeholder image based on terrain type
const getPlaceholderImage = (terrainType: string): string => {
  const placeholders: Record<string, string> = {
    plains: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=400&fit=crop',
    forest: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=400&fit=crop',
    mountain: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
    water: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=400&fit=crop',
    swamp: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=400&fit=crop',
    desert: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&h=400&fit=crop',
    tundra: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=400&h=400&fit=crop'
  };
  return placeholders[terrainType] || placeholders.plains;
};

const getTerrainIcon = (terrain: string) => {
  const icons: Record<string, string> = {
    plains: '🌾',
    forest: '🌲',
    mountain: '⛰️',
    water: '🌊',
    swamp: '🌿',
    desert: '🏜️',
    tundra: '❄️'
  };
  return icons[terrain] || '🗺️';
};

export default function LandMarketplaceMaterial() {
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [modalImageFallback, setModalImageFallback] = useState(false);
  const [filters, setFilters] = useState({
    terrainType: 'all',
    plotSize: 'all',
    status: 'all',
    minPrice: '',
    maxPrice: '',
    plotNumber: '',
    hasSpecialFeatures: false,
    resourceType: 'all'
  });
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const session = sessionManager.getSession();

  // Reset fallback state when switching between plots
  useEffect(() => {
    setModalImageFallback(false);
  }, [selectedPlot]);

  // Fetch land plots
  useEffect(() => {
    fetchPlots();
  }, [filters]);

  const fetchPlots = async () => {
    try {
      console.log('🏞️ [LAND] Fetching land plots with filters:', filters);
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.terrainType !== 'all') params.append('terrainType', filters.terrainType);
      if (filters.plotSize !== 'all') params.append('plotSize', filters.plotSize);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      params.append('limit', '1000');
      
      const response = await fetch(`/api/land/plots?${params.toString()}`);
      const data = await response.json() as any;
      
      if (data.success) {
        let filteredPlots = data.plots;
        
        if (filters.plotNumber) {
          const searchNum = parseInt(filters.plotNumber);
          filteredPlots = filteredPlots.filter((p: LandPlot) => p.plotNumber === searchNum);
        }
        
        if (filters.hasSpecialFeatures) {
          filteredPlots = filteredPlots.filter((p: LandPlot) => 
            p.specialFeatures && p.specialFeatures.length > 0
          );
        }
        
        if (filters.resourceType !== 'all') {
          filteredPlots = filteredPlots.filter((p: LandPlot) => {
            if (!p.resourceNodes || typeof p.resourceNodes !== 'object') return false;
            const resources = Object.keys(p.resourceNodes).map(r => r.toLowerCase());
            return resources.some(r => r.includes(filters.resourceType.toLowerCase()));
          });
        }
        
        setPlots(filteredPlots);
      } else {
        toast({
          title: "Error",
          description: "Failed to load land plots",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [LAND] Network error:', error);
      toast({
        title: "Error",
        description: "Failed to load land plots",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plot: LandPlot, paymentMethod: 'XRP' | 'RDL') => {
    if (!session.isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please login to purchase land",
        variant: "destructive"
      });
      setLocation('/login');
      return;
    }

    try {
      setPurchasing(true);
      const walletData = sessionManager.getWalletData();
      const buyerAddress = walletData?.xrpAddress;
      const buyerHandle = session.handle;

      if (!buyerAddress || !buyerHandle) {
        toast({
          title: "Wallet Required",
          description: "Please connect your XRPL wallet first",
          variant: "destructive"
        });
        setPurchasing(false);
        return;
      }

      const purchaseResponse = await apiRequest('/api/land/purchase-with-cached-keys', {
        method: 'POST',
        body: JSON.stringify({
          plotNumber: plot.plotNumber,
          paymentMethod,
          buyerAddress,
          buyerHandle
        })
      });

      const purchaseData = await purchaseResponse.json();

      if (!purchaseData.success) {
        toast({
          title: "Purchase Failed",
          description: purchaseData.error || "Failed to complete purchase",
          variant: "destructive"
        });
        setPurchasing(false);
        return;
      }

      toast({
        title: "Land Purchased!",
        description: `You now own Plot #${plot.plotNumber}!`,
      });

      await fetchPlots();
      setSelectedPlot(null);

    } catch (error: any) {
      toast({
        title: "Purchase Error",
        description: error.message || "Failed to process purchase",
        variant: "destructive"
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0d47a1" }}>
      {/* Header */}
      <Paper 
        elevation={4}
        sx={{ 
          bgcolor: "#1565c0",
          borderBottom: "4px solid #42a5f5",
          py: 4
        }}
      >
        <Container maxWidth="xl">
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h3" sx={{ fontWeight: "bold", color: "white", display: "flex", alignItems: "center", gap: 1 }}>
                🏰 Medieval Land Marketplace
              </Typography>
              <Typography variant="h6" sx={{ color: "#bbdefb", mt: 1, fontWeight: 600 }}>
                Purchase land plots for The Trolls Inquisition game
              </Typography>
            </Box>
            <Paper 
              elevation={6}
              sx={{ 
                bgcolor: "#fbc02d",
                p: 3,
                borderRadius: 2,
                border: "4px solid #f9a825",
                textAlign: "center"
              }}
            >
              <Typography variant="caption" sx={{ color: "#fff9c4", fontWeight: "bold" }}>
                Available Plots
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: "bold", color: "white" }}>
                {plots.length}
              </Typography>
            </Paper>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Filters */}
        <Card sx={{ mb: 4, bgcolor: "#6a1b9a", border: "4px solid #8e24aa" }} elevation={4}>
          <CardHeader
            sx={{ bgcolor: "#7b1fa2", borderBottom: "4px solid #8e24aa" }}
            title={
              <Stack direction="row" spacing={1} alignItems="center">
                <SearchIcon sx={{ color: "#ffd54f" }} />
                <Typography variant="h5" sx={{ fontWeight: "bold", color: "white" }}>
                  Search & Filter
                </Typography>
              </Stack>
            }
          />
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Plot Number"
                  value={filters.plotNumber}
                  onChange={(e) => setFilters({...filters, plotNumber: e.target.value})}
                  sx={{
                    bgcolor: "#7b1fa2",
                    "& .MuiInputLabel-root": { color: "#e1bee7", fontWeight: "bold" },
                    "& .MuiOutlinedInput-root": {
                      color: "white",
                      fontWeight: 600,
                      "& fieldset": { borderColor: "#8e24aa" }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: "#e1bee7", fontWeight: "bold" }}>Terrain Type</InputLabel>
                  <Select
                    value={filters.terrainType}
                    onChange={(e) => setFilters({...filters, terrainType: e.target.value})}
                    label="Terrain Type"
                    sx={{
                      bgcolor: "#7b1fa2",
                      color: "white",
                      fontWeight: 600,
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#8e24aa" }
                    }}
                  >
                    <MenuItem value="all">All Terrains</MenuItem>
                    <MenuItem value="plains">🌾 Plains</MenuItem>
                    <MenuItem value="forest">🌲 Forest</MenuItem>
                    <MenuItem value="mountain">⛰️ Mountain</MenuItem>
                    <MenuItem value="water">🌊 Water</MenuItem>
                    <MenuItem value="swamp">🌿 Swamp</MenuItem>
                    <MenuItem value="desert">🏜️ Desert</MenuItem>
                    <MenuItem value="tundra">❄️ Tundra</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: "#e1bee7", fontWeight: "bold" }}>Plot Size</InputLabel>
                  <Select
                    value={filters.plotSize}
                    onChange={(e) => setFilters({...filters, plotSize: e.target.value})}
                    label="Plot Size"
                    sx={{
                      bgcolor: "#7b1fa2",
                      color: "white",
                      fontWeight: 600,
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#8e24aa" }
                    }}
                  >
                    <MenuItem value="all">All Sizes</MenuItem>
                    <MenuItem value="standard">Standard (1x)</MenuItem>
                    <MenuItem value="large">Large (1.5x)</MenuItem>
                    <MenuItem value="massive">Massive (2x)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: "#e1bee7", fontWeight: "bold" }}>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    label="Status"
                    sx={{
                      bgcolor: "#7b1fa2",
                      color: "white",
                      fontWeight: 600,
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#8e24aa" }
                    }}
                  >
                    <MenuItem value="all">All Plots</MenuItem>
                    <MenuItem value="available">✅ Available Only</MenuItem>
                    <MenuItem value="owned">🏠 Owned</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Min Price (XRP)"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                  sx={{
                    bgcolor: "#7b1fa2",
                    "& .MuiInputLabel-root": { color: "#e1bee7", fontWeight: "bold" },
                    "& .MuiOutlinedInput-root": {
                      color: "white",
                      fontWeight: 600,
                      "& fieldset": { borderColor: "#8e24aa" }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Max Price (XRP)"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                  sx={{
                    bgcolor: "#7b1fa2",
                    "& .MuiInputLabel-root": { color: "#e1bee7", fontWeight: "bold" },
                    "& .MuiOutlinedInput-root": {
                      color: "white",
                      fontWeight: 600,
                      "& fieldset": { borderColor: "#8e24aa" }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: "#e1bee7", fontWeight: "bold" }}>Resource Type</InputLabel>
                  <Select
                    value={filters.resourceType}
                    onChange={(e) => setFilters({...filters, resourceType: e.target.value})}
                    label="Resource Type"
                    sx={{
                      bgcolor: "#7b1fa2",
                      color: "white",
                      fontWeight: 600,
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#8e24aa" }
                    }}
                  >
                    <MenuItem value="all">All Resources</MenuItem>
                    <MenuItem value="wood">🪵 Wood</MenuItem>
                    <MenuItem value="stone">🪨 Stone</MenuItem>
                    <MenuItem value="iron">⚒️ Iron</MenuItem>
                    <MenuItem value="gold">💰 Gold</MenuItem>
                    <MenuItem value="food">🌾 Food</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.hasSpecialFeatures}
                      onChange={(e) => setFilters({...filters, hasSpecialFeatures: e.target.checked})}
                      sx={{ 
                        color: "#ffd54f",
                        "&.Mui-checked": { color: "#ffd54f" }
                      }}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SparklesIcon sx={{ fontSize: 16, color: "#ffd54f" }} />
                      <Typography sx={{ color: "white", fontWeight: "bold" }}>
                        Special Features Only
                      </Typography>
                    </Stack>
                  }
                  sx={{ 
                    bgcolor: "#7b1fa2",
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    border: "2px solid #8e24aa"
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setFilters({
                    terrainType: 'all',
                    plotSize: 'all',
                    status: 'all',
                    minPrice: '',
                    maxPrice: '',
                    plotNumber: '',
                    hasSpecialFeatures: false,
                    resourceType: 'all'
                  })}
                  sx={{
                    bgcolor: "#d32f2f",
                    fontWeight: "bold",
                    border: "2px solid #f44336",
                    "&:hover": { bgcolor: "#c62828" }
                  }}
                >
                  Clear All Filters
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Land Plots Grid */}
        {loading ? (
          <Paper 
            elevation={4}
            sx={{ 
              textAlign: "center",
              py: 8,
              bgcolor: "#1565c0",
              border: "4px solid #42a5f5"
            }}
          >
            <CircularProgress size={64} sx={{ color: "#ffd54f" }} />
            <Typography variant="h5" sx={{ color: "white", mt: 3, fontWeight: "bold" }}>
              Loading land plots...
            </Typography>
          </Paper>
        ) : plots.length === 0 ? (
          <Paper 
            elevation={4}
            sx={{ 
              textAlign: "center",
              py: 8,
              bgcolor: "#1565c0",
              border: "4px solid #42a5f5"
            }}
          >
            <PlaceIcon sx={{ fontSize: 80, color: "#42a5f5", mb: 2 }} />
            <Typography variant="h4" sx={{ color: "white", fontWeight: "bold" }}>
              No land plots found
            </Typography>
            <Typography sx={{ color: "#bbdefb", mt: 1, fontWeight: 600 }}>
              Try adjusting your filters
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {plots.map((plot) => (
              <Grid item xs={12} sm={6} lg={4} key={plot.id}>
                <Card 
                  elevation={6}
                  sx={{
                    bgcolor: "#1565c0",
                    border: "4px solid #42a5f5",
                    transition: "all 0.3s",
                    "&:hover": {
                      border: "4px solid #ffd54f",
                      transform: "translateY(-4px)"
                    }
                  }}
                >
                  <CardMedia
                    component="img"
                    height="200"
                    image={plot.generatedImageUrl || getPlaceholderImage(plot.terrainType)}
                    alt={`Plot #${plot.plotNumber}`}
                    onError={(e: any) => {
                      e.target.src = getPlaceholderImage(plot.terrainType);
                    }}
                  />
                  
                  <CardHeader
                    sx={{ bgcolor: "#1e88e5", borderBottom: "4px solid #42a5f5" }}
                    title={
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="h4">{getTerrainIcon(plot.terrainType)}</Typography>
                          <Typography variant="h6" sx={{ fontWeight: "bold", color: "white" }}>
                            Plot #{plot.plotNumber}
                          </Typography>
                        </Stack>
                        <Chip
                          label={plot.status}
                          sx={{
                            bgcolor: plot.status === 'available' ? "#2e7d32" : "#616161",
                            color: "white",
                            fontWeight: "bold"
                          }}
                        />
                      </Stack>
                    }
                    subheader={
                      <Typography sx={{ color: "#bbdefb", fontWeight: 600 }}>
                        {plot.terrainSubtype || plot.terrainType}
                      </Typography>
                    }
                  />

                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="body2" sx={{ color: "#e3f2fd", mb: 2, fontWeight: 600 }}>
                      {plot.description}
                    </Typography>

                    <Paper sx={{ bgcolor: "#1e88e5", p: 2, mb: 2, border: "2px solid #42a5f5" }}>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ color: "#bbdefb", fontWeight: "bold" }}>
                            Terrain
                          </Typography>
                          <Typography sx={{ color: "#ffd54f", fontWeight: "bold" }}>
                            {plot.terrainSubtype || plot.terrainType}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ color: "#bbdefb", fontWeight: "bold" }}>
                            Size
                          </Typography>
                          <Typography sx={{ color: "#ffd54f", fontWeight: "bold" }}>
                            {plot.plotSize} ({plot.sizeMultiplier}x)
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="caption" sx={{ color: "#bbdefb", fontWeight: "bold" }}>
                            Coordinates
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#ce93d8", fontWeight: "bold" }}>
                            Map: ({plot.mapX}, {plot.mapY}) | Geo: {plot.latitude}°, {plot.longitude}°
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>

                    {plot.specialFeatures && plot.specialFeatures.length > 0 && (
                      <Paper sx={{ bgcolor: "#7b1fa2", p: 2, mb: 2, border: "2px solid #8e24aa" }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold", mb: 1, display: "block" }}>
                          Special Features:
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {plot.specialFeatures.map((feature, idx) => (
                            <Chip
                              key={idx}
                              icon={<SparklesIcon sx={{ fontSize: 14 }} />}
                              label={feature.replace(/_/g, ' ')}
                              size="small"
                              sx={{
                                bgcolor: "#fbc02d",
                                color: "white",
                                fontWeight: "bold",
                                mb: 0.5
                              }}
                            />
                          ))}
                        </Stack>
                      </Paper>
                    )}

                    {plot.resourceNodes && Object.keys(plot.resourceNodes).length > 0 && (
                      <Paper sx={{ bgcolor: "#2e7d32", p: 2, mb: 2, border: "2px solid #388e3c" }}>
                        <Typography variant="caption" sx={{ color: "#c8e6c9", fontWeight: "bold", mb: 1, display: "block" }}>
                          Resources:
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {Object.keys(plot.resourceNodes).map((resource, idx) => (
                            <Chip
                              key={idx}
                              label={resource.replace(/_/g, ' ')}
                              size="small"
                              sx={{
                                bgcolor: "#388e3c",
                                color: "white",
                                fontWeight: "bold",
                                mb: 0.5
                              }}
                            />
                          ))}
                        </Stack>
                      </Paper>
                    )}

                    <Divider sx={{ my: 2, borderColor: "#ffd54f", borderWidth: 2 }} />

                    {/* Pricing */}
                    <Paper sx={{ bgcolor: "#fbc02d", p: 2, mb: 2, border: "2px solid #f9a825" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ color: "#fff9c4", fontWeight: "bold" }}>
                          XRP Price:
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: "bold", color: "white" }}>
                          {parseFloat(plot.currentPrice).toFixed(2)} XRP
                        </Typography>
                      </Stack>
                    </Paper>

                    <Paper sx={{ bgcolor: "#2e7d32", p: 2, mb: 2, border: "2px solid #388e3c" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography sx={{ color: "#c8e6c9", fontWeight: "bold" }}>
                          Pay with RDL Token:
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: "bold", color: "white" }}>
                          {parseFloat(plot.rdlPrice).toFixed(2)} RDL
                        </Typography>
                      </Stack>
                      <Chip
                        icon={<SparklesIcon />}
                        label={`${plot.rdlDiscountPercent}% Discount`}
                        sx={{
                          bgcolor: "#fbc02d",
                          color: "#000",
                          fontWeight: "bold"
                        }}
                      />
                    </Paper>

                    {plot.status === 'available' ? (
                      <Stack spacing={1}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<WalletIcon />}
                          onClick={() => handlePurchase(plot, 'XRP')}
                          disabled={purchasing}
                          sx={{
                            bgcolor: "#1565c0",
                            fontWeight: "bold",
                            border: "2px solid #42a5f5",
                            "&:hover": { bgcolor: "#0d47a1" }
                          }}
                        >
                          {purchasing ? 'Processing...' : 'Buy with XRP'}
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<CoinsIcon />}
                          onClick={() => handlePurchase(plot, 'RDL')}
                          disabled={purchasing}
                          sx={{
                            bgcolor: "#2e7d32",
                            fontWeight: "bold",
                            border: "2px solid #388e3c",
                            "&:hover": { bgcolor: "#1b5e20" }
                          }}
                        >
                          {purchasing ? 'Processing...' : 'Buy with RDL'}
                        </Button>
                      </Stack>
                    ) : (
                      <Paper sx={{ bgcolor: "#616161", p: 2, textAlign: "center" }}>
                        <Typography sx={{ color: "#e0e0e0", fontWeight: "bold" }}>
                          Owned by @{plot.ownerHandle}
                        </Typography>
                      </Paper>
                    )}

                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<InfoIcon />}
                      onClick={() => setSelectedPlot(plot)}
                      sx={{
                        mt: 2,
                        color: "white",
                        borderColor: "#7b1fa2",
                        fontWeight: "bold",
                        "&:hover": {
                          borderColor: "#ffd54f",
                          bgcolor: "#7b1fa2"
                        }
                      }}
                    >
                      View Full Details
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Plot Details Dialog */}
      <Dialog
        open={!!selectedPlot}
        onClose={() => {
          setSelectedPlot(null);
          setModalImageFallback(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "#1565c0",
            border: "4px solid #42a5f5"
          }
        }}
      >
        <DialogTitle sx={{ bgcolor: "#1e88e5", borderBottom: "4px solid #42a5f5" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h3">{selectedPlot && getTerrainIcon(selectedPlot.terrainType)}</Typography>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "white" }}>
                  Land Plot #{selectedPlot?.plotNumber}
                </Typography>
                <Typography sx={{ color: "#bbdefb", fontWeight: 600 }}>
                  {selectedPlot?.gridSection}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setSelectedPlot(null)} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 3, maxHeight: "70vh", overflowY: "auto" }}>
          {selectedPlot && (
            <Stack spacing={3}>
              {/* Plot Image */}
              <Box
                component="img"
                src={modalImageFallback || !selectedPlot.generatedImageUrl 
                  ? getPlaceholderImage(selectedPlot.terrainType) 
                  : selectedPlot.generatedImageUrl
                }
                alt={`Plot #${selectedPlot.plotNumber}`}
                onError={() => setModalImageFallback(true)}
                sx={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  borderRadius: 2,
                  border: "4px solid #42a5f5"
                }}
              />

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Chip
                  label={selectedPlot.status}
                  sx={{
                    bgcolor: selectedPlot.status === 'available' ? "#2e7d32" : "#616161",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    px: 2,
                    py: 3
                  }}
                />
                {selectedPlot.ownerHandle && (
                  <Typography sx={{ color: "#bbdefb", fontWeight: "bold" }}>
                    Owned by <span style={{ color: "#ffd54f" }}>@{selectedPlot.ownerHandle}</span>
                  </Typography>
                )}
              </Stack>

              <Card sx={{ bgcolor: "#1e88e5", border: "2px solid #42a5f5" }}>
                <CardHeader
                  sx={{ bgcolor: "#1976d2", borderBottom: "2px solid #42a5f5" }}
                  title={<Typography sx={{ color: "#ffd54f", fontWeight: "bold" }}>Description</Typography>}
                />
                <CardContent>
                  <Typography sx={{ color: "white", fontWeight: 600, mb: 2 }}>
                    {selectedPlot.description}
                  </Typography>
                  {selectedPlot.lore && (
                    <>
                      <Divider sx={{ my: 2, borderColor: "#42a5f5" }} />
                      <Typography variant="caption" sx={{ color: "#bbdefb", fontWeight: "bold", display: "block", mb: 1 }}>
                        📜 Historical Lore:
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#e3f2fd", fontStyle: "italic", fontWeight: 600 }}>
                        {selectedPlot.lore}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ bgcolor: "#7b1fa2", border: "2px solid #8e24aa" }}>
                <CardHeader
                  sx={{ bgcolor: "#6a1b9a", borderBottom: "2px solid #8e24aa" }}
                  title={<Typography sx={{ color: "#ffd54f", fontWeight: "bold" }}>Plot Statistics</Typography>}
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Paper sx={{ bgcolor: "#6a1b9a", p: 1.5 }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold" }}>
                          Terrain Type
                        </Typography>
                        <Typography sx={{ color: "white", fontWeight: "bold" }}>
                          {selectedPlot.terrainType}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ bgcolor: "#6a1b9a", p: 1.5 }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold" }}>
                          Terrain Subtype
                        </Typography>
                        <Typography sx={{ color: "white", fontWeight: "bold" }}>
                          {selectedPlot.terrainSubtype}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ bgcolor: "#6a1b9a", p: 1.5 }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold" }}>
                          Plot Size
                        </Typography>
                        <Typography sx={{ color: "white", fontWeight: "bold" }}>
                          {selectedPlot.plotSize}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ bgcolor: "#6a1b9a", p: 1.5 }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold" }}>
                          Size Multiplier
                        </Typography>
                        <Typography sx={{ color: "white", fontWeight: "bold" }}>
                          {selectedPlot.sizeMultiplier}x
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ bgcolor: "#6a1b9a", p: 1.5 }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold" }}>
                          Map Coordinates
                        </Typography>
                        <Typography sx={{ color: "white", fontWeight: "bold" }}>
                          ({selectedPlot.mapX}, {selectedPlot.mapY})
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ bgcolor: "#6a1b9a", p: 1.5 }}>
                        <Typography variant="caption" sx={{ color: "#e1bee7", fontWeight: "bold" }}>
                          Geographic Location
                        </Typography>
                        <Typography sx={{ color: "white", fontWeight: "bold" }}>
                          {selectedPlot.latitude}°, {selectedPlot.longitude}°
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: "4px solid #42a5f5" }}>
          {selectedPlot?.status === 'available' && (
            <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<WalletIcon />}
                onClick={() => selectedPlot && handlePurchase(selectedPlot, 'XRP')}
                disabled={purchasing}
                sx={{
                  bgcolor: "#1565c0",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  py: 1.5,
                  border: "2px solid #42a5f5",
                  "&:hover": { bgcolor: "#0d47a1" }
                }}
              >
                Buy for {selectedPlot && parseFloat(selectedPlot.currentPrice).toFixed(2)} XRP
              </Button>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<CoinsIcon />}
                onClick={() => selectedPlot && handlePurchase(selectedPlot, 'RDL')}
                disabled={purchasing}
                sx={{
                  bgcolor: "#2e7d32",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  py: 1.5,
                  border: "2px solid #388e3c",
                  "&:hover": { bgcolor: "#1b5e20" }
                }}
              >
                Buy for {selectedPlot && parseFloat(selectedPlot.rdlPrice).toFixed(2)} RDL
              </Button>
            </Stack>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
