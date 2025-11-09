import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link as WouterLink } from "wouter";
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Tabs,
  Tab,
  Avatar,
  LinearProgress,
  Paper,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Stack,
  Tooltip
} from "@mui/material";
import {
  Castle as CastleIcon,
  AccountBalance as BuildingIcon,
  AttachMoney as MoneyIcon,
  Bolt as EnergyIcon,
  Restaurant as FoodIcon,
  Construction as MaterialsIcon,
  People as PeopleIcon,
  Favorite as HeartIcon,
  Shield as ShieldIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  LocationOn as LocationIcon,
  EmojiEvents as AwardIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  PlayArrow as PlayIcon,
  Storefront as StoreIcon,
  Policy as PolicyIcon,
  Groups as GroupsIcon,
  Home as HomeIcon,
  Token as TokenIcon
} from "@mui/icons-material";

interface City {
  id: number;
  userHandle: string;
  cityName: string;
  cityDescription: string | null;
  cityImage: string | null;
  landPlotId: number | null;
  plotSize: number;
  credits: string;
  materials: string;
  energy: string;
  food: string;
  population: number;
  populationCapacity: number;
  happiness: number;
  totalBuildings: number;
  economicValue: string;
  defenseRating: number;
  cityLevel: number;
  experiencePoints: number;
  linkedProjectId: string | null;
  contributeToProject: boolean;
  economySharePercent: number;
  foundedAt: string;
  lastActive: string;
  buildings: any[];
  furnishings: any[];
  shops: any[];
  defenses: any[];
  policies: any[];
  citizens: any[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const RiddleCityMaterial = () => {
  const { handle } = useParams<{ handle: string }>();
  const [activeTab, setActiveTab] = useState(0);

  const { data: cityData, isLoading, error } = useQuery<{
    success: boolean;
    data: City;
    error?: string;
    message?: string;
  }>({
    queryKey: [`/api/riddlecity/city/public/${handle}`],
    enabled: !!handle,
    retry: 1,
  });

  // Fetch RDL balance for the city owner's wallet
  const { data: rdlBalance } = useQuery<{ balance: number }>({
    queryKey: [`/api/rdl/balance/handle/${cityData?.data?.userHandle}`],
    enabled: !!cityData?.data?.userHandle,
    retry: 1,
    select: (data: any) => ({
      balance: data?.balance ? parseFloat(data.balance) : 0
    })
  });

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 50%, #ffccbc 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <CardContent sx={{ p: 4 }}>
            <CircularProgress size={60} sx={{ color: "#ff6f00", mb: 3 }} />
            <Typography variant="h6" color="text.secondary">
              Loading city...
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !cityData?.success || !cityData?.data) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 50%, #ffccbc 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 400, width: "100%", border: "2px solid #ff5252" }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <CastleIcon sx={{ fontSize: 40, color: "#ff5252" }} />
              <Typography variant="h5" color="error">
                City Not Found
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {cityData?.message || `No city found for user @${handle}`}
            </Typography>
            <Stack direction="row" spacing={2}>
              <WouterLink href="/gaming-dashboard">
                <Button variant="outlined" startIcon={<ArrowBackIcon />}>
                  Back to Dashboard
                </Button>
              </WouterLink>
              <WouterLink href="/riddlecity">
                <Button variant="contained" startIcon={<CastleIcon />}>
                  Explore RiddleCity
                </Button>
              </WouterLink>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const city = cityData.data;
  const activeBuildings = city.buildings?.filter((b) => b.constructionStatus === "active") || [];
  const activeShops = city.shops?.filter((s) => s.isActive) || [];
  const activeDefenses = city.defenses?.filter((d) => d.isActive) || [];
  const activePolicies = city.policies?.filter((p) => p.isActive) || [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 50%, #ffccbc 100%)",
      }}
    >
      {/* Header */}
      <Paper
        elevation={3}
        sx={{
          background: "linear-gradient(90deg, #e65100 0%, #bf360c 100%)",
          borderBottom: "4px solid #ff6f00",
          color: "white",
          mb: 3,
        }}
      >
        <Container maxWidth="xl" sx={{ py: 3 }}>
          {/* Back Button */}
          <WouterLink href="/gaming-dashboard">
            <Button
              startIcon={<ArrowBackIcon />}
              sx={{ color: "white", mb: 2 }}
            >
              Back to Dashboard
            </Button>
          </WouterLink>

          {/* City Owner Banner */}
          <Paper
            sx={{
              bgcolor: "rgba(0, 0, 0, 0.3)",
              backdropFilter: "blur(10px)",
              border: "2px solid #ffa726",
              borderRadius: 2,
              p: 2,
              mb: 3,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <PersonIcon sx={{ fontSize: 32, color: "#ffd54f" }} />
              <Box>
                <Typography variant="body2" sx={{ color: "#ffd54f", fontWeight: 500 }}>
                  This city is owned by
                </Typography>
                <WouterLink href={`/profile/${city.userHandle}`}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: "bold",
                      color: "white",
                      "&:hover": { color: "#ffd54f" },
                      cursor: "pointer",
                    }}
                  >
                    @{city.userHandle}
                  </Typography>
                </WouterLink>
              </Box>
            </Stack>
          </Paper>

          {/* City Header */}
          <Grid container spacing={3} alignItems="flex-start">
            <Grid item xs={12} md={city.cityImage ? 8 : 12}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <CastleIcon sx={{ fontSize: 60, color: "#ffd54f" }} />
                <Typography variant="h2" sx={{ fontWeight: "bold" }}>
                  {city.cityName}
                </Typography>
              </Stack>
              {city.cityDescription && (
                <Typography variant="h6" sx={{ color: "#ffecb3", mb: 2 }}>
                  {city.cityDescription}
                </Typography>
              )}
              <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
                <Chip
                  icon={<AwardIcon />}
                  label={`Level ${city.cityLevel}`}
                  sx={{ bgcolor: "#ff6f00", color: "white", fontWeight: "bold" }}
                />
                <Chip
                  icon={<StarIcon />}
                  label={`${city.experiencePoints} XP`}
                  sx={{ bgcolor: "#7b1fa2", color: "white", fontWeight: "bold" }}
                />
                <Chip
                  icon={<LocationIcon />}
                  label={`${city.plotSize}㎡ Plot`}
                  sx={{ bgcolor: "#1976d2", color: "white", fontWeight: "bold" }}
                />
              </Stack>
            </Grid>
            {city.cityImage && (
              <Grid item xs={12} md={4}>
                <Box
                  component="img"
                  src={city.cityImage}
                  alt={city.cityName}
                  sx={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                    borderRadius: 2,
                    border: "4px solid #ff6f00",
                    boxShadow: 4,
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Container>
      </Paper>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ pb: 6 }}>
        {/* Resource Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              elevation={3}
              sx={{
                background: "linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)",
                border: "2px solid #ff6f00",
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 3 }}>
                <MoneyIcon sx={{ fontSize: 48, color: "#ff6f00", mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#e65100" }}>
                  {parseFloat(city.credits).toLocaleString()}
                </Typography>
                <Typography variant="subtitle1" sx={{ color: "#f57c00", mt: 1 }}>
                  Credits
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              elevation={3}
              sx={{
                background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                border: "2px solid #1976d2",
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 3 }}>
                <EnergyIcon sx={{ fontSize: 48, color: "#1976d2", mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#0d47a1" }}>
                  {parseFloat(city.energy).toLocaleString()}
                </Typography>
                <Typography variant="subtitle1" sx={{ color: "#1565c0", mt: 1 }}>
                  Energy
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              elevation={3}
              sx={{
                background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
                border: "2px solid #388e3c",
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 3 }}>
                <FoodIcon sx={{ fontSize: 48, color: "#388e3c", mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#1b5e20" }}>
                  {parseFloat(city.food).toLocaleString()}
                </Typography>
                <Typography variant="subtitle1" sx={{ color: "#2e7d32", mt: 1 }}>
                  Food
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              elevation={3}
              sx={{
                background: "linear-gradient(135deg, #fafafa 0%, #e0e0e0 100%)",
                border: "2px solid #616161",
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 3 }}>
                <MaterialsIcon sx={{ fontSize: 48, color: "#616161", mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#212121" }}>
                  {parseFloat(city.materials).toLocaleString()}
                </Typography>
                <Typography variant="subtitle1" sx={{ color: "#424242", mt: 1 }}>
                  Materials
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              elevation={3}
              sx={{
                background: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)",
                border: "2px solid #7b1fa2",
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 3 }}>
                <TokenIcon sx={{ fontSize: 48, color: "#7b1fa2", mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#4a148c" }}>
                  {rdlBalance?.balance ? rdlBalance.balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                </Typography>
                <Typography variant="subtitle1" sx={{ color: "#6a1b9a", mt: 1 }}>
                  RDL Tokens
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Stats Overview */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { icon: PeopleIcon, label: "Population", value: `${city.population}/${city.populationCapacity}`, color: "#7b1fa2" },
            { icon: HeartIcon, label: "Happiness", value: `${city.happiness}%`, color: "#d32f2f" },
            { icon: BuildingIcon, label: "Buildings", value: city.totalBuildings, color: "#f57c00" },
            { icon: ShieldIcon, label: "Defense", value: city.defenseRating, color: "#1976d2" },
            { icon: TrendingUpIcon, label: "Economy", value: parseFloat(city.economicValue).toLocaleString(), color: "#388e3c" },
          ].map((stat, index) => (
            <Grid item xs={6} sm={4} md={2.4} key={index}>
              <Card elevation={2}>
                <CardContent sx={{ textAlign: "center", p: 2 }}>
                  <stat.icon sx={{ fontSize: 32, color: stat.color, mb: 1 }} />
                  <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Tabs */}
        <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              bgcolor: "#fff3e0",
              borderBottom: "2px solid #ff6f00",
              "& .MuiTab-root": {
                fontWeight: "bold",
                fontSize: "1rem",
              },
              "& .Mui-selected": {
                color: "#ff6f00",
              },
            }}
          >
            <Tab icon={<CastleIcon />} iconPosition="start" label="Overview" />
            <Tab icon={<BuildingIcon />} iconPosition="start" label={`Buildings (${activeBuildings.length})`} />
            <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Economy" />
            <Tab icon={<ShieldIcon />} iconPosition="start" label={`Defense (${activeDefenses.length})`} />
            <Tab icon={<GroupsIcon />} iconPosition="start" label={`Citizens (${city.citizens?.length || 0})`} />
            <Tab icon={<PolicyIcon />} iconPosition="start" label={`Policies (${activePolicies.length})`} />
          </Tabs>

          {/* Overview Tab */}
          <TabPanel value={activeTab} index={0}>
            <Container>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card elevation={2}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                        <HomeIcon /> City Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Founded</Typography>
                          <Typography variant="body1" fontWeight="bold">
                            {new Date(city.foundedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Last Active</Typography>
                          <Typography variant="body1" fontWeight="bold">
                            {new Date(city.lastActive).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Experience Progress</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={(city.experiencePoints % 1000) / 10}
                              sx={{ flex: 1, height: 10, borderRadius: 5 }}
                            />
                            <Typography variant="body2" fontWeight="bold">
                              {city.experiencePoints} XP
                            </Typography>
                          </Box>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card elevation={2}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                        <PlayIcon /> Start Playing
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="body1" sx={{ mb: 3 }}>
                        Ready to build your own city in RiddleCity? Create your settlement and start your journey!
                      </Typography>
                      <WouterLink href="/riddlecity/create">
                        <Button
                          variant="contained"
                          size="large"
                          fullWidth
                          startIcon={<CastleIcon />}
                          sx={{
                            background: "linear-gradient(90deg, #ff6f00 0%, #f57c00 100%)",
                            fontWeight: "bold",
                            fontSize: "1.1rem",
                            py: 1.5,
                          }}
                        >
                          Create Your City
                        </Button>
                      </WouterLink>
                    </CardContent>
                  </Card>
                </Grid>

                {city.linkedProjectId && (
                  <Grid item xs={12}>
                    <Alert severity="info" icon={<CastleIcon />}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        This city contributes {city.economySharePercent}% of its economy to project: {city.linkedProjectId}
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Container>
          </TabPanel>

          {/* Buildings Tab */}
          <TabPanel value={activeTab} index={1}>
            <Container>
              {activeBuildings.length === 0 ? (
                <Alert severity="info">
                  <Typography variant="body1">No active buildings yet. Start building to grow your city!</Typography>
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  {activeBuildings.map((building, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card elevation={2} sx={{ height: "100%" }}>
                        <CardContent>
                          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                            <Avatar sx={{ bgcolor: "#ff6f00" }}>
                              <BuildingIcon />
                            </Avatar>
                            <Box flex={1}>
                              <Typography variant="h6" fontWeight="bold">
                                {building.buildingType || "Building"}
                              </Typography>
                              <Chip label={building.buildingLevel ? `Level ${building.buildingLevel}` : "Level 1"} size="small" />
                            </Box>
                          </Stack>
                          <Divider sx={{ mb: 2 }} />
                          <Typography variant="body2" color="text.secondary">
                            {building.description || "A structure in your city"}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            startIcon={<PlayIcon />}
                            sx={{ mt: 2 }}
                          >
                            Manage Building
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
              <Box sx={{ mt: 4, textAlign: "center" }}>
                <WouterLink href="/riddlecity/build">
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<BuildingIcon />}
                    sx={{ background: "linear-gradient(90deg, #ff6f00 0%, #f57c00 100%)" }}
                  >
                    Construct New Building
                  </Button>
                </WouterLink>
              </Box>
            </Container>
          </TabPanel>

          {/* Economy Tab */}
          <TabPanel value={activeTab} index={2}>
            <Container>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card elevation={2}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
                        Economic Overview
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Total Economic Value</Typography>
                          <Typography variant="h4" fontWeight="bold" color="primary">
                            {parseFloat(city.economicValue).toLocaleString()} Credits
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Active Shops</Typography>
                          <Typography variant="h5" fontWeight="bold">
                            {activeShops.length}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card elevation={2}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                        <StoreIcon /> Shops
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      {activeShops.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No active shops. Build shops to boost your economy!
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          {activeShops.slice(0, 3).map((shop, index) => (
                            <Chip key={index} label={shop.shopType || "Shop"} />
                          ))}
                          {activeShops.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                              +{activeShops.length - 3} more shops
                            </Typography>
                          )}
                        </Stack>
                      )}
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<PlayIcon />}
                        sx={{ mt: 2 }}
                      >
                        Manage Economy
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Container>
          </TabPanel>

          {/* Defense Tab */}
          <TabPanel value={activeTab} index={3}>
            <Container>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                    <ShieldIcon /> Defense Systems
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Defense Rating
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(city.defenseRating, 100)}
                      sx={{ height: 20, borderRadius: 10, mb: 1 }}
                    />
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {city.defenseRating} / 100
                    </Typography>
                  </Box>
                  {activeDefenses.length === 0 ? (
                    <Alert severity="warning">
                      <Typography variant="body1">
                        No active defenses! Your city is vulnerable. Build defensive structures to protect your citizens.
                      </Typography>
                    </Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {activeDefenses.map((defense, index) => (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                          <Card variant="outlined">
                            <CardContent>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <ShieldIcon color="primary" />
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {defense.defenseType || "Defense"}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                Level {defense.defenseLevel || 1}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                  <Box sx={{ mt: 3, textAlign: "center" }}>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<ShieldIcon />}
                      sx={{ background: "linear-gradient(90deg, #1976d2 0%, #1565c0 100%)" }}
                    >
                      Build Defenses
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Container>
          </TabPanel>

          {/* Citizens Tab */}
          <TabPanel value={activeTab} index={4}>
            <Container>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                    <PeopleIcon /> Citizens
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" fontWeight="bold" color="primary">
                          {city.population}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Current Population
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" fontWeight="bold" color="success.main">
                          {city.populationCapacity}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Capacity
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" fontWeight="bold" color="error.main">
                          {city.happiness}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Happiness
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  {city.citizens && city.citizens.length > 0 ? (
                    <Typography variant="body1">
                      Your city has {city.citizens.length} registered citizens.
                    </Typography>
                  ) : (
                    <Alert severity="info">
                      <Typography variant="body1">
                        No registered citizens yet. Attract more people to your city by improving infrastructure and happiness!
                      </Typography>
                    </Alert>
                  )}
                  <Box sx={{ mt: 3, textAlign: "center" }}>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<PeopleIcon />}
                      sx={{ background: "linear-gradient(90deg, #7b1fa2 0%, #6a1b9a 100%)" }}
                    >
                      Manage Citizens
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Container>
          </TabPanel>

          {/* Policies Tab */}
          <TabPanel value={activeTab} index={5}>
            <Container>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                    <PolicyIcon /> City Policies
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  {activePolicies.length === 0 ? (
                    <Alert severity="info">
                      <Typography variant="body1">
                        No active policies. Create policies to shape your city's future!
                      </Typography>
                    </Alert>
                  ) : (
                    <Stack spacing={2}>
                      {activePolicies.map((policy, index) => (
                        <Card key={index} variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                              {policy.policyName || "Policy"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {policy.policyDescription || "A city policy"}
                            </Typography>
                            <Chip
                              label={policy.policyType || "General"}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  )}
                  <Box sx={{ mt: 3, textAlign: "center" }}>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<PolicyIcon />}
                      sx={{ background: "linear-gradient(90deg, #388e3c 0%, #2e7d32 100%)" }}
                    >
                      Create Policy
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Container>
          </TabPanel>
        </Paper>
      </Container>
    </Box>
  );
};

export default RiddleCityMaterial;
