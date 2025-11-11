import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  Avatar,
  Paper,
  IconButton,
  Fade,
  useTheme,
  alpha,
} from "@mui/material";
import {
  Search,
  EmojiEvents,
  Shield,
  People,
  Storefront,
  ArrowForward,
  Star,
  LocalFireDepartment,
  SportsMartialArts as Swords,
} from "@mui/icons-material";

interface LeaderboardEntry {
  rank: number;
  player_handle: string;
  civilization_name: string | null;
  wins: number;
  win_rate: string;
}

export default function TrollsInquisitionLanding() {
  const [, navigate] = useLocation();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  // Fetch top leaderboard
  const { data: battleLeaders } = useQuery<{
    success: boolean;
    data: LeaderboardEntry[];
  }>({
    queryKey: ["/api/battles/leaderboard?limit=5"],
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigate(`/gamerprofile/${searchQuery.trim()}`);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative pattern */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.03,
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 50px, currentColor 50px, currentColor 51px)`,
        }}
      />

      {/* Hero Section with Solid Background */}
      <Box sx={{
        py: { xs: 8, md: 12 },
        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'error.main',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
          <Fade in timeout={1000}>
            <Box textAlign="center">
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mb: 4,
                }}
              >
                <Box
                  component="img"
                  src="/inquisition-logo.png"
                  alt="The Trolls Inquisition"
                  sx={{
                    width: { xs: 200, md: 300 },
                    height: { xs: 200, md: 300 },
                    filter: "drop-shadow(0 0 20px rgba(255, 140, 0, 0.3))",
                    animation: "float 6s ease-in-out infinite",
                    "@keyframes float": {
                      "0%, 100%": { transform: "translateY(0px)" },
                      "50%": { transform: "translateY(-20px)" },
                    },
                  }}
                />
              </Box>

              <Typography
                variant="h2"
                fontWeight="bold"
                color="white"
                gutterBottom
                sx={{
                  fontSize: { xs: "2.5rem", md: "4rem" },
                }}
              >
                The Trolls Inquisition
              </Typography>
              <Typography
                variant="h5"
                color="white"
                sx={{
                  opacity: 0.9,
                  mb: 4,
                }}
              >
                Enter the Ultimate NFT Battle Arena
              </Typography>

            {/* Search Bar */}
            <Box sx={{ maxWidth: 600, mx: "auto", mb: 4 }}>
              <TextField
                fullWidth
                placeholder="Search for players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        variant="contained"
                        onClick={handleSearch}
                        disabled={!searchQuery.trim()}
                        sx={{ borderRadius: 2 }}
                      >
                        Search
                      </Button>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  bgcolor: "white",
                  borderRadius: 3,
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { border: "none" },
                  },
                }}
              />
            </Box>

              {/* CTA Buttons */}
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Swords />}
                  onClick={() => navigate("/gaming")}
                  sx={{
                    bgcolor: "white",
                    color: theme.palette.error.main,
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    "&:hover": {
                      bgcolor: alpha(theme.palette.common.white, 0.9),
                      transform: "scale(1.05)",
                    },
                    transition: "all 0.3s",
                  }}
                >
                  Enter Gaming Hub
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Storefront />}
                  onClick={() => navigate("/gaming-nfts")}
                  sx={{
                    color: "white",
                    borderColor: "white",
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    "&:hover": {
                      borderColor: "white",
                      bgcolor: alpha(theme.palette.common.white, 0.1),
                    },
                  }}
                >
                  NFT Marketplace
                </Button>
              </Box>
            </Box>
          </Fade>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1, py: 8 }}>

        {/* Features Grid */}
        <Grid container spacing={3} mb={8}>
          {[
            {
              icon: <Swords sx={{ fontSize: 40 }} />,
              title: "Epic Battles",
              description: "Engage in strategic NFT battles",
              path: "/gaming/battles",
            },
            {
              icon: <Shield sx={{ fontSize: 40 }} />,
              title: "Build Squadrons",
              description: "Assemble your ultimate team",
              path: "/gaming/battles",
            },
            {
              icon: <EmojiEvents sx={{ fontSize: 40 }} />,
              title: "Earn Rewards",
              description: "Win prizes and climb ranks",
              path: "/gaming",
            },
            {
              icon: <People sx={{ fontSize: 40 }} />,
              title: "Join Alliances",
              description: "Team up with other players",
              path: "/alliances",
            },
          ].map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Fade in timeout={1000 + index * 200}>
                <Card
                  sx={{
                    height: "100%",
                    bgcolor: alpha(theme.palette.common.white, 0.95),
                    transition: "all 0.3s",
                    cursor: "pointer",
                    "&:hover": {
                      transform: "translateY(-8px)",
                      boxShadow: `0 12px 40px ${alpha(theme.palette.error.main, 0.4)}`,
                    },
                  }}
                  onClick={() => navigate(feature.path)}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box
                      sx={{
                        color: theme.palette.error.main,
                        mb: 2,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>
          ))}
        </Grid>

        {/* Leaderboard Section */}
        <Fade in timeout={1500}>
          <Paper
            elevation={8}
            sx={{
              bgcolor: alpha(theme.palette.common.white, 0.95),
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                bgcolor: theme.palette.error.main,
                p: 3,
                color: "white",
                textAlign: "center",
              }}
            >
              <EmojiEvents sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                Top Warriors
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Hall of Champions
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              {battleLeaders?.data?.length > 0 ? (
                <Box>
                  {battleLeaders.data.map((leader, index) => (
                    <Card
                      key={leader.player_handle}
                      sx={{
                        mb: 2,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        "&:hover": {
                          transform: "translateX(8px)",
                          boxShadow: 4,
                        },
                      }}
                      onClick={() => navigate(`/gamerprofile/${leader.player_handle}`)}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip
                            label={`#${leader.rank}`}
                            color={index === 0 ? "error" : index === 1 ? "warning" : "default"}
                            sx={{ fontWeight: "bold", minWidth: 50 }}
                          />
                          <Avatar
                            sx={{
                              bgcolor: theme.palette.error.main,
                              width: 48,
                              height: 48,
                            }}
                          >
                            {leader.player_handle[0].toUpperCase()}
                          </Avatar>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {leader.player_handle}
                            </Typography>
                            {leader.civilization_name && (
                              <Typography variant="body2" color="text.secondary">
                                {leader.civilization_name}
                              </Typography>
                            )}
                          </Box>
                          <Box textAlign="right">
                            <Typography variant="h6" color="error.main" fontWeight="bold">
                              {leader.wins} Wins
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {leader.win_rate}% Win Rate
                            </Typography>
                          </Box>
                          <ArrowForward />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  No leaderboard data available yet
                </Typography>
              )}

              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={() => navigate("/gaming")}
                sx={{ mt: 2 }}
              >
                View Full Leaderboard
              </Button>
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
}
