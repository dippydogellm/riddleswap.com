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
  Chip,
  Paper,
  Fade,
  useTheme,
  alpha,
  Stack,
} from "@mui/material";
import {
  LocationCity,
  Store,
  AccountBalance,
  Park,
  TrendingUp,
  Explore,
  LocalFireDepartment,
  Diamond,
  AutoAwesome,
} from "@mui/icons-material";

export default function RiddleCityLanding() {
  const [, navigate] = useLocation();
  const theme = useTheme();

  // Fetch city stats
  const { data: cityStats } = useQuery<{
    total_plots: number;
    owned_plots: number;
    available_plots: number;
    total_value: string;
  }>({
    queryKey: ["/api/riddle-city/stats"],
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.9)} 0%, ${alpha(theme.palette.secondary.dark, 0.8)} 50%, ${alpha(theme.palette.primary.main, 0.9)} 100%)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background cityscape */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "40%",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 400'%3E%3Crect x='50' y='150' width='80' height='250' fill='%23ffffff10'/%3E%3Crect x='150' y='100' width='60' height='300' fill='%23ffffff15'/%3E%3Crect x='230' y='180' width='70' height='220' fill='%23ffffff12'/%3E%3Crect x='320' y='120' width='90' height='280' fill='%23ffffff18'/%3E%3Crect x='430' y='160' width='75' height='240' fill='%23ffffff14'/%3E%3Crect x='525' y='90' width='85' height='310' fill='%23ffffff20'/%3E%3Crect x='630' y='140' width='70' height='260' fill='%23ffffff16'/%3E%3Crect x='720' y='110' width='80' height='290' fill='%23ffffff17'/%3E%3Crect x='820' y='170' width='65' height='230' fill='%23ffffff13'/%3E%3Crect x='905' y='130' width='75' height='270' fill='%23ffffff15'/%3E%3Crect x='1000' y='95' width='70' height='305' fill='%23ffffff19'/%3E%3Crect x='1090' y='155' width='80' height='245' fill='%23ffffff14'/%3E%3C/svg%3E")`,
          backgroundSize: "cover",
          backgroundPosition: "bottom",
          opacity: 0.3,
        }}
      />

      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1, py: 8 }}>
        {/* Hero Section */}
        <Fade in timeout={1000}>
          <Box textAlign="center" mb={8}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mb: 4,
              }}
            >
              <LocationCity
                sx={{
                  fontSize: { xs: 120, md: 180 },
                  color: "white",
                  filter: "drop-shadow(0 0 40px rgba(255, 255, 255, 0.5))",
                  animation: "glow 3s ease-in-out infinite",
                  "@keyframes glow": {
                    "0%, 100%": { filter: "drop-shadow(0 0 40px rgba(255, 255, 255, 0.5))" },
                    "50%": { filter: "drop-shadow(0 0 60px rgba(255, 255, 255, 0.8))" },
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
                textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                fontSize: { xs: "2.5rem", md: "4rem" },
              }}
            >
              RiddleCity
            </Typography>
            <Typography
              variant="h5"
              color="white"
              sx={{
                opacity: 0.9,
                mb: 4,
                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
              }}
            >
              Build Your Virtual Empire • Own Digital Land • Create Your Legacy
            </Typography>

            {/* Stats Chips */}
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              flexWrap="wrap"
              mb={4}
            >
              <Chip
                icon={<LocationCity />}
                label={`${cityStats?.total_plots || 0} Total Plots`}
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  py: 3,
                }}
              />
              <Chip
                icon={<Diamond />}
                label={`${cityStats?.owned_plots || 0} Owned`}
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  py: 3,
                }}
              />
              <Chip
                icon={<AutoAwesome />}
                label={`${cityStats?.available_plots || 0} Available`}
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  py: 3,
                }}
              />
            </Stack>

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
                startIcon={<Store />}
                onClick={() => navigate("/land-marketplace")}
                sx={{
                  bgcolor: "white",
                  color: theme.palette.primary.main,
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
                Browse Land Marketplace
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Explore />}
                onClick={() => navigate("/gaming")}
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
                Explore City
              </Button>
            </Box>
          </Box>
        </Fade>

        {/* Features Grid */}
        <Grid container spacing={3} mb={8}>
          {[
            {
              icon: <LocationCity sx={{ fontSize: 50 }} />,
              title: "Prime Real Estate",
              description: "Own valuable digital land plots in the metaverse",
              color: theme.palette.primary.main,
            },
            {
              icon: <AccountBalance sx={{ fontSize: 50 }} />,
              title: "Build & Develop",
              description: "Construct buildings and develop your properties",
              color: theme.palette.secondary.main,
            },
            {
              icon: <TrendingUp sx={{ fontSize: 50 }} />,
              title: "Earn Income",
              description: "Generate passive income from your land holdings",
              color: theme.palette.success.main,
            },
            {
              icon: <Park sx={{ fontSize: 50 }} />,
              title: "Custom Design",
              description: "Personalize your plots with unique aesthetics",
              color: theme.palette.info.main,
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
                      boxShadow: `0 12px 40px ${alpha(feature.color, 0.4)}`,
                    },
                  }}
                  onClick={() => navigate("/land-marketplace")}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box
                      sx={{
                        color: feature.color,
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

        {/* Featured Land Types */}
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
                bgcolor: theme.palette.primary.main,
                p: 3,
                color: "white",
                textAlign: "center",
              }}
            >
              <Diamond sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                Land Types
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Choose Your Perfect Plot
              </Typography>
            </Box>

            <Box sx={{ p: 4 }}>
              <Grid container spacing={3}>
                {[
                  {
                    type: "Residential",
                    icon: "🏠",
                    price: "500 RDL",
                    description: "Perfect for homes and communities",
                  },
                  {
                    type: "Commercial",
                    icon: "🏢",
                    price: "1,000 RDL",
                    description: "Ideal for businesses and shops",
                  },
                  {
                    type: "Industrial",
                    icon: "🏭",
                    price: "750 RDL",
                    description: "Build factories and production",
                  },
                  {
                    type: "Premium",
                    icon: "💎",
                    price: "2,500 RDL",
                    description: "Exclusive downtown locations",
                  },
                ].map((land, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Card
                      sx={{
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        "&:hover": {
                          transform: "scale(1.05)",
                          boxShadow: 6,
                        },
                      }}
                      onClick={() => navigate("/land-marketplace")}
                    >
                      <CardContent>
                        <Typography variant="h2" mb={1}>
                          {land.icon}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {land.type}
                        </Typography>
                        <Chip
                          label={land.price}
                          color="primary"
                          sx={{ mb: 2, fontWeight: "bold" }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {land.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Store />}
                onClick={() => navigate("/land-marketplace")}
                sx={{ mt: 4, py: 2 }}
              >
                View All Available Land
              </Button>
            </Box>
          </Paper>
        </Fade>

        {/* Call to Action */}
        <Fade in timeout={2000}>
          <Box textAlign="center" mt={8}>
            <Paper
              elevation={12}
              sx={{
                p: 6,
                bgcolor: alpha(theme.palette.warning.main, 0.95),
                color: "white",
              }}
            >
              <LocalFireDepartment sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Start Building Today
              </Typography>
              <Typography variant="h6" mb={4} sx={{ opacity: 0.9 }}>
                Join thousands of landowners in RiddleCity
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate("/land-marketplace")}
                sx={{
                  bgcolor: "white",
                  color: theme.palette.warning.main,
                  px: 6,
                  py: 2,
                  fontSize: "1.2rem",
                  fontWeight: "bold",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.common.white, 0.9),
                  },
                }}
              >
                Get Started Now
              </Button>
            </Paper>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}
