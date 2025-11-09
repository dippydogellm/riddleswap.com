import { MessageCircle, Twitter, Send, Instagram, Music2, Link, Users, BookOpen, Heart, Coins, BarChart3, ArrowUpDown, Wallet, Home } from "lucide-react";
import { Link as RouterLink } from "wouter";
import {
  Box,
  Container,
  Grid,
  Typography,
  IconButton,
  Divider,
  useTheme
} from '@mui/material';

export default function UniversalFooter() {
  const theme = useTheme();
  
  const socialLinks = [
    { name: "Discord", href: "https://discord.gg/NfKPdjxF", icon: MessageCircle },
    { name: "Twitter", href: "https://x.com/RIDDLEXRPL", icon: Twitter },
    { name: "Telegram", href: "https://t.me/riddlexrp", icon: Send },
    { name: "Instagram", href: "https://www.instagram.com/riddlechainxrp/", icon: Instagram },
    { name: "TikTok", href: "https://www.tiktok.com/@riddlechainxrp", icon: Music2 },
    { name: "Linktree", href: "https://linktr.ee/riddlechain", icon: Link },
  ];

  const platformLinks = [
    { name: "Home", href: "/", icon: Home },
    { name: "Gaming Hub", href: "/gaming", icon: Home },
    { name: "The Trolls Inquisition", href: "/trolls-inquisition", icon: Home },
    { name: "RiddleCity", href: "/riddle-city", icon: Home },
    { name: "XRPL Swap", href: "/xrpl-swap", icon: Coins },
    { name: "Portfolio", href: "/portfolio", icon: Wallet },
    { name: "Analytics", href: "/dexscreener", icon: BarChart3 },
    { name: "Bridge", href: "/bridge", icon: ArrowUpDown },
  ];

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        py: 6,
        mt: 'auto'
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand Section */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box
                component="img"
                src="/logo.jpg"
                alt="Riddle.Finance"
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1
                }}
              />
              <Box>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  RiddleSwap
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Professional DeFi Banking Platform
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              The next-generation digital banking platform that outperforms traditional banks. 
              Experience lightning-fast cross-chain trading, premium wealth management, and institutional-grade security.
            </Typography>
          </Grid>

          {/* Platform Links */}
          <Grid item xs={12} sm={4} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Coins size={20} color={theme.palette.primary.main} />
              <Typography variant="subtitle2" fontWeight="bold">
                Platform
              </Typography>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {platformLinks.map((link) => (
                <Box component="li" key={link.name} sx={{ mb: 1 }}>
                  <RouterLink href={link.href}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'text.secondary',
                        textDecoration: 'none',
                        '&:hover': {
                          color: 'primary.main'
                        }
                      }}
                    >
                      <link.icon size={16} />
                      <Typography variant="body2">{link.name}</Typography>
                    </Box>
                  </RouterLink>
                </Box>
              ))}
            </Box>
          </Grid>

          {/* Company Links */}
          <Grid item xs={12} sm={4} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Users size={20} color={theme.palette.primary.main} />
              <Typography variant="subtitle2" fontWeight="bold">
                Company
              </Typography>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              <Box component="li" sx={{ mb: 1 }}>
                <RouterLink href="/our-story">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: 'text.secondary',
                      textDecoration: 'none',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <BookOpen size={16} />
                    <Typography variant="body2">Our Story</Typography>
                  </Box>
                </RouterLink>
              </Box>
              <Box component="li" sx={{ mb: 1 }}>
                <RouterLink href="/team">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: 'text.secondary',
                      textDecoration: 'none',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <Heart size={16} />
                    <Typography variant="body2">Team</Typography>
                  </Box>
                </RouterLink>
              </Box>
              <Box component="li" sx={{ mb: 1 }}>
                <RouterLink href="/contact">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: 'text.secondary',
                      textDecoration: 'none',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <MessageCircle size={16} />
                    <Typography variant="body2">Contact</Typography>
                  </Box>
                </RouterLink>
              </Box>
            </Box>
          </Grid>

          {/* Social Links */}
          <Grid item xs={12} sm={4} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Users size={20} color={theme.palette.primary.main} />
              <Typography variant="subtitle2" fontWeight="bold">
                Follow Us
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {socialLinks.map((social) => (
                <IconButton
                  key={social.name}
                  component="a"
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.name}
                  size="small"
                  sx={{
                    bgcolor: 'action.selected',
                    '&:hover': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText'
                    }
                  }}
                >
                  <social.icon size={18} />
                </IconButton>
              ))}
            </Box>
          </Grid>
        </Grid>

        {/* Bottom Section */}
        <Divider sx={{ my: 4 }} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © 2025 RiddleSwap. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            <RouterLink href="/privacy">
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                Privacy Policy
              </Typography>
            </RouterLink>
            <RouterLink href="/terms">
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                Terms of Service
              </Typography>
            </RouterLink>
            <Typography variant="body2" color="text.secondary">
              Contact: <Box component="a" href="mailto:Hello@riddleswap.com" sx={{ color: 'primary.main', textDecoration: 'none' }}>Hello@riddleswap.com</Box>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
