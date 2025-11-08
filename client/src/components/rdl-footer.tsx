import { MessageCircle } from "lucide-react";
import {
  Box,
  Container,
  Grid,
  Typography,
  Button,
  Divider,
  useTheme
} from '@mui/material';

export default function RDLFooter() {
  const theme = useTheme();
  
  return (
    <>
      {/* Get Support Section */}
      <Box
        sx={{
          background: `linear-gradient(90deg, ${theme.palette.mode === 'dark' ? '#6a1b9a' : '#7b1fa2'} 0%, ${theme.palette.mode === 'dark' ? '#1976d2' : '#1e88e5'} 100%)`,
          color: 'white',
          py: 6,
          textAlign: 'center'
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Need Help? Get Support
          </Typography>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Join our Discord community for instant support and connect with other traders
          </Typography>
          <Button
            component="a"
            href="https://discord.gg/NfKPdjxF"
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            size="large"
            startIcon={<MessageCircle size={20} />}
            sx={{
              bgcolor: 'white',
              color: theme.palette.mode === 'dark' ? '#7b1fa2' : '#6a1b9a',
              fontWeight: 'bold',
              '&:hover': {
                bgcolor: 'grey.100',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s'
            }}
          >
            Join Discord for Support
          </Button>
        </Container>
      </Box>

      <Box
        component="footer"
        sx={{
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          py: 8
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {/* Brand Section */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box
                  component="img"
                  src="/rdl-logo-official.png"
                  alt="RDL Official Logo"
                  sx={{
                    width: 48,
                    height: 48,
                    objectFit: 'contain'
                  }}
                  onError={(e: any) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Box>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    Riddle Finance
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Professional XRPL Trading Platform
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
                The most advanced decentralized exchange for trading XRPL tokens. 
                Experience lightning-fast trades, deep liquidity, and enterprise-grade security.
              </Typography>
            </Grid>

            {/* Platform Links */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                Platform
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {[
                  { name: 'Swap', href: '/' },
                  { name: 'Portfolio', href: '/portfolio' },
                  { name: 'Analytics', href: '/analytics' },
                  { name: 'Liquidity', href: '/liquidity' }
                ].map((link) => (
                  <Box component="li" key={link.name} sx={{ mb: 1 }}>
                    <Typography
                      component="a"
                      href={link.href}
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        textDecoration: 'none',
                        display: 'inline-block',
                        '&:hover': {
                          color: 'primary.main',
                          transform: 'translateX(4px)',
                          transition: 'all 0.2s'
                        }
                      }}
                    >
                      {link.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>

            {/* Community Links */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                Community
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {[
                  { name: 'Discord', href: 'https://discord.gg/NfKPdjxF' },
                  { name: 'Twitter', href: 'https://x.com/RIDDLEXRPL' },
                  { name: 'Instagram', href: 'https://www.instagram.com/riddlechainxrp/' },
                  { name: 'TikTok', href: 'https://www.tiktok.com/@riddlechainxrp' },
                  { name: 'Telegram', href: 'https://t.me/riddlexrp' },
                  { name: 'Linktree', href: 'https://linktr.ee/riddlechain' }
                ].map((link) => (
                  <Box component="li" key={link.name} sx={{ mb: 1 }}>
                    <Typography
                      component="a"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        textDecoration: 'none',
                        display: 'inline-block',
                        '&:hover': {
                          color: 'primary.main',
                          transform: 'translateX(4px)',
                          transition: 'all 0.2s'
                        }
                      }}
                    >
                      {link.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>

          {/* Bottom Bar */}
          <Divider sx={{ my: 6 }} />
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2
            }}
          >
            <Typography variant="body2" color="text.secondary">
              © 2025 Riddle Finance. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography
                component="a"
                href="/privacy"
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    transition: 'all 0.3s'
                  }
                }}
              >
                Privacy Policy
              </Typography>
              <Typography
                component="a"
                href="/terms"
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    transition: 'all 0.3s'
                  }
                }}
              >
                Terms of Service
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Powered by{' '}
                <Box component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  XRPL
                </Box>
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  );
}
