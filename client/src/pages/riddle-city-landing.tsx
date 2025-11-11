import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Box, Container, Typography, Button, Card, Grid, Chip, Paper, useTheme, alpha, Stack, Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { LocationCity, Store, TrendingUp, Explore, Diamond, AutoAwesome, EmojiEvents, Groups, Public, Business, Gamepad, AccountBalance } from "@mui/icons-material";
import { useSession } from "@/utils/sessionManager";
import { SessionRenewalModal } from "@/components/SessionRenewalModal";

export default function RiddleCityLanding() {
  const [, navigate] = useLocation();
  const theme = useTheme();
  const session = useSession();
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  
  // Check if session needs renewal
  useEffect(() => {
    if ((session as any).needsRenewal) {
      console.log('⚠️ [RIDDLE CITY] Session needs renewal, showing modal');
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);

  const { data: cityStats } = useQuery<{
    total_plots: number;
    owned_plots: number;
    available_plots: number;
  }>({
    queryKey: ["/api/riddle-city/stats"],
  });

  const leaderboardData = [
    { rank: 1, player: "CryptoKing", plots: 50, value: "125,000 XRP", badge: "" },
    { rank: 2, player: "LandLord_99", plots: 42, value: "98,500 XRP", badge: "" },
    { rank: 3, player: "MetaBuilder", plots: 38, value: "87,200 XRP", badge: "" },
    { rank: 4, player: "VirtualMogul", plots: 35, value: "78,900 XRP", badge: "" },
    { rank: 5, player: "CityArchitect", plots: 32, value: "69,500 XRP", badge: "" },
  ];

  const ourProjects = [
    { name: "RiddleSwap", description: "Multi-Chain DeFi", icon: <TrendingUp />, link: "/swap", category: "DeFi", color: "#3b82f6" },
    { name: "NFT Marketplace", description: "Buy, sell & trade NFTs", icon: <Store />, link: "/nft-marketplace", category: "NFT", color: "#8b5cf6" },
    { name: "Trolls Inquisition", description: "Epic battle arena", icon: <Gamepad />, link: "/trolls-inquisition", category: "Gaming", color: "#ef4444" },
    { name: "Portfolio Tracker", description: "Track assets", icon: <AccountBalance />, link: "/portfolio", category: "Tools", color: "#10b981" }
  ];

  const partnerProjects = [
    { name: "XRPL Labs", description: "Leading XRPL development", link: "https://xrpl-labs.com", category: "Partner" },
    { name: "Xaman Wallet", description: "Secure XRPL wallet", link: "https://xaman.app", category: "Partner" }
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.mode === "dark" ? "background.default" : "grey.50" }}>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: theme.palette.mode === "dark" ? "grey.900" : "primary.main", color: "white", position: "relative", overflow: "hidden" }}>
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
          <Box textAlign="center">
            <LocationCity sx={{ fontSize: { xs: 80, md: 120 }, mb: 2 }} />
            <Typography variant="h2" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: "2.5rem", md: "4rem" } }}>
              RiddleCity
            </Typography>
            <Typography variant="h5" sx={{ opacity: 0.9, mb: 4 }}>
              Build Your Virtual Empire
            </Typography>

            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" mb={4}>
              <Chip icon={<LocationCity />} label={`${cityStats?.total_plots || 0} Total Plots`} sx={{ bgcolor: alpha("#fff", 0.2), color: "white", fontWeight: "bold", py: 3 }} />
              <Chip icon={<Diamond />} label={`${cityStats?.owned_plots || 0} Owned`} sx={{ bgcolor: alpha("#fff", 0.2), color: "white", fontWeight: "bold", py: 3 }} />
              <Chip icon={<AutoAwesome />} label={`${cityStats?.available_plots || 0} Available`} sx={{ bgcolor: alpha("#fff", 0.2), color: "white", fontWeight: "bold", py: 3 }} />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button variant="contained" size="large" onClick={() => navigate("/riddle-city")} sx={{ bgcolor: "white", color: "primary.main", fontWeight: 700, px: 4 }} startIcon={<Explore />}>
                Explore City
              </Button>
              <Button variant="outlined" size="large" sx={{ borderColor: "white", color: "white", fontWeight: 700, px: 4 }} startIcon={<Store />}>
                View Marketplace
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={700} textAlign="center" gutterBottom>City Features</Typography>
        <Typography variant="subtitle1" color="text.secondary" textAlign="center" mb={6}>Everything you need to build your empire</Typography>

        <Grid container spacing={3}>
          {[
            { icon: <Business sx={{ fontSize: 48 }} />, title: "Virtual Real Estate", description: "Own and develop digital land plots" },
            { icon: <Store sx={{ fontSize: 48 }} />, title: "Marketplace", description: "Buy, sell, and trade land plots" },
            { icon: <TrendingUp sx={{ fontSize: 48 }} />, title: "Generate Revenue", description: "Earn passive income from land" },
            { icon: <Groups sx={{ fontSize: 48 }} />, title: "Community", description: "Connect with other land owners" },
            { icon: <Public sx={{ fontSize: 48 }} />, title: "Metaverse Integration", description: "Part of interconnected virtual world" },
            { icon: <EmojiEvents sx={{ fontSize: 48 }} />, title: "Competitions", description: "Win exclusive rewards" }
          ].map((feature, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Card sx={{ height: "100%", p: 3, textAlign: "center", "&:hover": { boxShadow: 6, transform: "translateY(-4px)" }, transition: "all 0.3s" }}>
                <Box sx={{ color: "primary.main", mb: 2 }}>{feature.icon}</Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>{feature.title}</Typography>
                <Typography variant="body2" color="text.secondary">{feature.description}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ py: 8, bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100" }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={4}>
            <EmojiEvents sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
            <Typography variant="h3" fontWeight={700} gutterBottom>Top Land Owners</Typography>
            <Typography variant="subtitle1" color="text.secondary">Leading players in RiddleCity</Typography>
          </Box>

          <TableContainer component={Paper} sx={{ maxWidth: 800, mx: "auto" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === "dark" ? "grey.800" : "grey.200" }}>
                  <TableCell><strong>Rank</strong></TableCell>
                  <TableCell><strong>Player</strong></TableCell>
                  <TableCell align="right"><strong>Plots</strong></TableCell>
                  <TableCell align="right"><strong>Value</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboardData.map((p) => (
                  <TableRow key={p.rank} sx={{ "&:hover": { bgcolor: theme.palette.mode === "dark" ? "grey.800" : "grey.50" }, bgcolor: p.rank <= 3 ? alpha(theme.palette.primary.main, 0.05) : "inherit" }}>
                    <TableCell><Typography fontWeight={p.rank <= 3 ? 700 : 400}>{p.badge} #{p.rank}</Typography></TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>{p.player[0]}</Avatar>
                        <Typography fontWeight={600}>{p.player}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right"><Chip label={p.plots} size="small" color="primary" variant="outlined" /></TableCell>
                    <TableCell align="right"><Typography fontWeight={600} color="success.main">{p.value}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={700} textAlign="center" gutterBottom>Our Ecosystem</Typography>
        <Typography variant="subtitle1" color="text.secondary" textAlign="center" mb={6}>Explore all RiddleSwap products</Typography>

        <Grid container spacing={3}>
          {ourProjects.map((project, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card component="a" href={project.link} sx={{ height: "100%", display: "flex", flexDirection: "column", textDecoration: "none", p: 3, textAlign: "center", "&:hover": { boxShadow: 8, transform: "translateY(-6px)" }, transition: "all 0.3s" }}>
                <Box sx={{ color: project.color, fontSize: 64, mb: 2 }}>{project.icon}</Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>{project.name}</Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>{project.description}</Typography>
                <Chip label={project.category} size="small" color="primary" sx={{ mt: "auto" }} />
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ py: 8, bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100" }}>
        <Container maxWidth="lg">
          <Typography variant="h3" fontWeight={700} textAlign="center" gutterBottom>Partner Projects</Typography>
          <Typography variant="subtitle1" color="text.secondary" textAlign="center" mb={6}>Collaborating with Web3 leaders</Typography>

          <Grid container spacing={3} justifyContent="center">
            {partnerProjects.map((p, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card component="a" href={p.link} target="_blank" rel="noopener noreferrer" sx={{ p: 3, textAlign: "center", textDecoration: "none", "&:hover": { boxShadow: 6, transform: "translateY(-4px)" }, transition: "all 0.3s" }}>
                  <Avatar sx={{ width: 56, height: 56, mx: "auto", mb: 2, bgcolor: "primary.main" }}>{p.name[0]}</Avatar>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{p.name}</Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>{p.description}</Typography>
                  <Chip label={p.category} size="small" variant="outlined" />
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 12, bgcolor: theme.palette.mode === "dark" ? "grey.900" : "primary.main", color: "white", textAlign: "center" }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={700} gutterBottom>Start Building Today</Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>Join thousands building the future of virtual real estate</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={() => navigate("/riddle-city")} sx={{ bgcolor: "white", color: "primary.main", fontWeight: 700, px: 5 }}>
              Enter RiddleCity
            </Button>
            <Button variant="outlined" size="large" sx={{ borderColor: "white", color: "white", fontWeight: 700, px: 5 }}>
              Learn More
            </Button>
          </Stack>
        </Container>
      </Box>
      
      {/* Session Renewal Modal */}
      <SessionRenewalModal 
        open={showRenewalModal} 
        onOpenChange={setShowRenewalModal}
      />
    </Box>
  );
}
