import React, { useEffect } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight, Shield, Zap, Globe, Wallet, BarChart3,
  Users, Award, ChevronRight, TrendingUp, Swords,
  Lock, Layers, Rocket, MessageCircle, Image, Send,
  LineChart, Book, History
} from 'lucide-react';
import { FaTelegram, FaTwitter, FaDiscord } from 'react-icons/fa';
import { useMetadata } from '@/hooks/use-metadata';
import {
  Box, Container, Grid, Typography, Button, Card, CardContent,
  Stack, Avatar, Chip, useTheme, alpha
} from '@mui/material';

// Homepage rewritten using Material UI only (removes Tailwind utility classes) and enhances SEO meta via metadata manager.

interface ChainInfo { name: string; logo: string; }
interface ServiceInfo { title: string; icon: React.ComponentType<any>; description: string; link: string; }

const chains: ChainInfo[] = [
  { name: 'XRP Ledger', logo: '/images/chains/xrp-logo.png' },
  { name: 'Ethereum', logo: '/images/chains/ethereum-logo.png' },
  { name: 'Solana', logo: '/images/chains/solana-logo.png' },
  { name: 'Bitcoin', logo: '/images/chains/bitcoin-logo.png' },
  { name: 'BNB Chain', logo: '/images/chains/bnb-logo.png' },
  { name: 'Polygon', logo: '/images/chains/polygon-logo.png' },
  { name: 'Base', logo: '/images/chains/base-logo.png' },
  { name: 'Arbitrum', logo: '/images/chains/arbitrum-logo.png' },
  { name: 'Optimism', logo: '/images/chains/optimism-logo.png' },
  { name: 'Avalanche', logo: '/images/chains/avalanche-logo.png' },
  { name: 'Fantom', logo: '/images/chains/fantom-logo.png' },
  { name: 'zkSync', logo: '/images/chains/zksync-logo.png' },
  { name: 'Linea', logo: '/images/chains/linea-logo.png' },
  { name: 'Taiko', logo: '/images/chains/taiko-logo.png' },
  { name: 'Unichain', logo: '/images/chains/unichain-logo.png' },
  { name: 'Soneium', logo: '/images/chains/soneium-logo.png' },
  { name: 'Mantle', logo: '/images/chains/mantle-logo.png' },
  { name: 'Metis', logo: '/images/chains/metis-logo.png' },
  { name: 'Scroll', logo: '/images/chains/scroll-logo.png' },
];

const services: ServiceInfo[] = [
  { title: 'Multi-Chain Swap', icon: Zap, description: 'Trade tokens across 19 blockchains with best price routing', link: '/swap' },
  { title: 'Create Wallet', icon: Wallet, description: 'Secure multi-chain wallet supporting all major networks', link: '/create-wallet' },
  { title: 'The Trolls Inquisition', icon: Swords, description: 'Epic NFT battle arena - Build squadrons and compete', link: '/trolls-inquisition' },
  { title: 'RiddleCity', icon: Layers, description: 'Virtual land metaverse - Own, build & earn from digital real estate', link: '/riddle-city' },
  { title: 'NFT Marketplace', icon: Image, description: 'Buy, sell & trade NFTs across several chains', link: '/nft-marketplace' },
  { title: 'Cross-Chain Bridge', icon: Layers, description: 'Transfer assets between 17+ blockchain networks', link: '/bridge' },
  { title: 'Liquidity Vault', icon: Lock, description: 'Earn yield with secure vault strategies', link: '/vault' },
  { title: 'Gaming Hub', icon: Swords, description: 'Access all gaming features and your NFT collection', link: '/gaming' },
  { title: 'Portfolio Tracker', icon: BarChart3, description: 'Track assets across all supported chains', link: '/portfolio' },
  { title: 'Token Analytics', icon: LineChart, description: 'Real-time token data, charts & analytics', link: '/scanner' },
  { title: 'DevTools', icon: Rocket, description: 'Launch tokens, NFTs, airdrops & more', link: '/devtools' },
  { title: 'Staking & Rewards', icon: Award, description: 'Earn rewards via staking & liquidity', link: '/staking' },
];

const Home: React.FC = () => {
  // Override basic metadata for enriched SEO (keywords + long description)
  useMetadata({
    title: 'RiddleSwap | Multi-Chain DeFi Platform - Swap, Bridge, NFTs & Gaming',
    description: 'RiddleSwap unifies DeFi, NFTs, gaming & analytics across 19+ blockchains (XRP, Ethereum, Solana, Bitcoin & more). Create a free wallet, swap tokens, bridge assets, explore NFTs, and battle in The Trolls Inquisition – all in one interface.',
    keywords: ['RiddleSwap', 'DeFi', 'Multi-Chain', 'Crypto Wallet', 'Token Swap', 'NFT Marketplace', 'Cross-Chain Bridge', 'XRP', 'Ethereum', 'Solana', 'Bitcoin', 'Gaming'],
    image: '/images/social/riddleswap-home.png',
    type: 'website'
  });

  const theme = useTheme();

  // Additional structured data augmentation (organization) – metadataManager handles core page data
  useEffect(() => {
    const id = 'home-org-jsonld';
    if (document.getElementById(id)) return; // avoid duplicates
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'RiddleSwap',
      'url': window.location.origin,
      'logo': window.location.origin + '/images/logos/rdl-logo-official.png',
      'sameAs': [
        'https://twitter.com/riddleswap',
        'https://t.me/riddlexrp',
        'https://discord.gg/riddleswap'
      ]
    });
    document.head.appendChild(script);
  }, []);

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50' }}>
      {/* Product Showcase Menu Bar */}
      <Box sx={{ 
        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'white',
        borderBottom: 1,
        borderColor: 'divider',
        py: 2
      }}>
        <Container maxWidth="xl">
          <Grid container spacing={2} alignItems="center">
            {[
              { name: 'Trading', icon: <TrendingUp size={20} />, link: '/swap', color: '#3b82f6' },
              { name: 'NFT Marketplace', icon: <Image size={20} />, link: '/nft-marketplace', color: '#8b5cf6' },
              { name: 'Trolls Inquisition', icon: <Swords size={20} />, link: '/trolls-inquisition', color: '#ef4444' },
              { name: 'RiddleCity', icon: <Layers size={20} />, link: '/riddle-city', color: '#f59e0b' },
              { name: 'Portfolio', icon: <BarChart3 size={20} />, link: '/portfolio', color: '#10b981' },
              { name: 'Analytics', icon: <LineChart size={20} />, link: '/scanner', color: '#06b6d4' },
              { name: 'Wallet', icon: <Wallet size={20} />, link: '/create-wallet', color: '#6366f1' },
              { name: 'DevTools', icon: <Rocket size={20} />, link: '/devtools', color: '#ec4899' }
            ].map(product => (
              <Grid item xs={6} sm={4} md={3} lg={1.5} key={product.name}>
                <Button
                  component={Link as any}
                  href={product.link}
                  fullWidth
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    py: 1.5,
                    px: 1,
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                    color: theme.palette.text.primary,
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.100',
                      transform: 'translateY(-2px)',
                      boxShadow: 3
                    },
                    transition: 'all 0.2s',
                    borderRadius: 2
                  }}
                >
                  <Box sx={{ color: product.color }}>{product.icon}</Box>
                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                    {product.name}
                  </Typography>
                </Button>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Hero */}
      <Box sx={{
        position: 'relative',
        py: { xs: 8, md: 12 },
        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'primary.main',
        color: 'common.white'
      }}>
        <Container maxWidth="lg" sx={{ textAlign: 'center', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <Box component="img" src="/images/logos/rdl-logo-official.png" alt="RiddleSwap Logo" sx={{ height: 80 }}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.currentTarget.style.display = 'none'); }} />
          </Box>
          <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-1px', fontSize: { xs: '2.5rem', md: '4rem' } }}>
            RiddleSwap
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 3, opacity: 0.95 }}>
            Multi-Chain DeFi Platform
          </Typography>
          <Typography variant="h6" sx={{ maxWidth: 900, mx: 'auto', mb: 5, fontWeight: 400, lineHeight: 1.4, opacity: 0.9 }}>
            Trade, swap, bridge & manage crypto across <strong>19 blockchains</strong> in one unified experience. From DeFi to NFTs to gaming – everything you need for decentralized finance.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mb: 4 }}>
            <Button component={Link as any} href="/create-wallet" variant="contained" size="large"
              sx={{
                bgcolor: 'common.white', color: 'primary.main', fontWeight: 700, px: 4,
                '&:hover': { bgcolor: 'grey.100' }
              }} startIcon={<Wallet size={22} />} endIcon={<ChevronRight size={22} />}>Create Free Wallet</Button>
            <Button component={Link as any} href="/swap" variant="contained" size="large" color="secondary"
              startIcon={<Zap size={22} />} sx={{
                fontWeight: 700, px: 4,
                '&:hover': { bgcolor: 'secondary.dark' }
              }}>Start Trading</Button>
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mt: 2 }}>
            {['Swap', 'Bridge', 'NFTs', 'Gaming', 'Analytics', 'Wallet'].map(tag => (
              <Chip key={tag} label={tag} sx={{ 
                bgcolor: alpha('#ffffff', 0.15), 
                color: 'white', 
                borderColor: alpha('#ffffff', 0.3),
                '&:hover': { bgcolor: alpha('#ffffff', 0.25) }
              }} />
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Supported Chains */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Box textAlign="center" mb={6}>
          <Typography variant="h3" fontWeight={700} gutterBottom>
            <Globe style={{ verticalAlign: 'middle', marginRight: 12 }} size={42} /> 19 Blockchains Supported
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">Seamlessly trade & transfer assets across major networks</Typography>
        </Box>
        <Grid container spacing={2}>
          {chains.map(chain => (
            <Grid item xs={4} sm={3} md={2} key={chain.name}>
              <Card elevation={0} sx={{
                p: 2,
                height: '100%',
                textAlign: 'center',
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                '&:hover': { boxShadow: 6, transform: 'translateY(-4px)' },
                transition: 'all .25s'
              }}>
                <Avatar variant="rounded" src={chain.logo} alt={chain.name} sx={{ width: 56, height: 56, mx: 'auto', mb: 1 }} />
                <Typography variant="caption" fontWeight={600}>{chain.name}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Services */}
      <Box sx={{ py: 10, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.100' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h3" fontWeight={700} gutterBottom>Complete DeFi Ecosystem</Typography>
            <Typography variant="subtitle1" color="text.secondary">Everything you need – unified</Typography>
          </Box>
          <Grid container spacing={3}>
            {services.map(service => {
              const Icon = service.icon;
              return (
                <Grid item xs={12} sm={6} md={4} key={service.title}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, position: 'relative', overflow: 'hidden',
                    '&:hover': { boxShadow: 8, transform: 'translateY(-6px)' }, transition: 'all .25s' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ 
                        width: 56, 
                        height: 56, 
                        borderRadius: 2, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        mb: 2,
                        bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.main'
                      }}>
                        <Icon size={30} color="#fff" />
                      </Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom>{service.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{service.description}</Typography>
                      <Button component={Link as any} href={service.link} size="small" endIcon={<ArrowRight size={16} />} sx={{ fontWeight: 600 }}>
                        Learn More
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      {/* Community */}
      <Box sx={{ py: 10, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'secondary.main' }}>
        <Container maxWidth="lg" sx={{ textAlign: 'center', color: 'white' }}>
          <Typography variant="h3" fontWeight={700} gutterBottom><Users style={{ verticalAlign: 'middle', marginRight: 12 }} size={42} />Join Our Community</Typography>
          <Typography variant="subtitle1" sx={{ opacity: 0.9, mb: 6 }}>Connect with traders, developers & crypto enthusiasts</Typography>
          <Grid container spacing={3} justifyContent="center">
            {[{
              name: 'Telegram', icon: <FaTelegram size={64} />, url: 'https://t.me/riddlexrp', desc: 'Announcements & live support', color: '#3b82f6'
            }, {
              name: 'Twitter/X', icon: <FaTwitter size={64} />, url: 'https://twitter.com/riddleswap', desc: 'Updates, news & insights', color: '#0ea5e9'
            }, {
              name: 'Discord', icon: <FaDiscord size={64} />, url: 'https://discord.gg/riddleswap', desc: 'Chat with team & community', color: '#6366f1'
            }].map(s => (
              <Grid item xs={12} md={4} key={s.name}>
                <Card sx={{ 
                  p: 3, 
                  borderRadius: 4, 
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : alpha('#ffffff', 0.2),
                  backdropFilter: 'blur(4px)', 
                  color: 'white',
                  '&:hover': { boxShadow: 10, transform: 'translateY(-6px)' }, 
                  transition: 'all .25s' 
                }}>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center', color: s.color }}>{s.icon}</Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{s.name}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>{s.desc}</Typography>
                  <Button href={s.url} target="_blank" rel="noopener" variant="outlined" endIcon={<ArrowRight size={16} />} sx={{ color: 'white', borderColor: alpha('#ffffff', 0.5), '&:hover': { borderColor: 'white' } }}>
                    {s.name === 'Telegram' ? 'Join Now' : s.name === 'Discord' ? 'Join Server' : 'Follow Us'}
                  </Button>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Why Choose */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Box textAlign="center" mb={6}>
          <Typography variant="h3" fontWeight={700} gutterBottom>Why Choose RiddleSwap?</Typography>
        </Box>
        <Grid container spacing={4}>
          {[{
            title: 'Bank-Grade Security', icon: <Shield size={44} color={theme.palette.primary.main} />, desc: 'Military-grade encryption & secure key management.'
          }, {
            title: 'Lightning Fast', icon: <Zap size={44} color={theme.palette.success.main} />, desc: 'Optimized routing & low-latency infrastructure.'
          }, {
            title: '24/7 Support', icon: <Users size={44} color={theme.palette.secondary.main} />, desc: 'Dedicated team to help you succeed in DeFi.'
          }].map(f => (
            <Grid item xs={12} md={4} key={f.title}>
              <Card sx={{ textAlign: 'center', py: 5, px: 2, borderRadius: 4,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                '&:hover': { boxShadow: 8, transform: 'translateY(-4px)' }, transition: 'all .25s' }}>
                <Box sx={{ mb: 2 }}>{f.icon}</Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>{f.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 260, mx: 'auto' }}>{f.desc}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Additional Links */}
      <Box sx={{ py: 8, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100' }}>
        <Container maxWidth="lg">
          <Grid container spacing={2}>
            {[{ label: 'Our History', icon: <History size={20} />, href: '/our-history' },
              { label: 'Our Story', icon: <Book size={20} />, href: '/our-story' },
              { label: 'Roadmap', icon: <TrendingUp size={20} />, href: '/roadmap' },
              { label: 'Contact', icon: <MessageCircle size={20} />, href: '/contact' }]
              .map(l => (
                <Grid item xs={6} md={3} key={l.label}>
                  <Card component={Link as any} href={l.href} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                    textDecoration: 'none', '&:hover': { boxShadow: 6, bgcolor: theme.palette.action.hover } }}>
                    {l.icon}
                    <Typography variant="body2" fontWeight={600}>{l.label}</Typography>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box sx={{ py: 12, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'primary.dark', textAlign: 'center', color: 'white' }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={700} gutterBottom>Ready to Start Your DeFi Journey?</Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>Create your free multi-chain wallet in under 60 seconds.</Typography>
          <Button component={Link as any} href="/create-wallet" size="large" variant="contained"
            startIcon={<Wallet size={26} />} endIcon={<ChevronRight size={26} />} sx={{
              bgcolor: 'common.white', color: 'primary.main', fontWeight: 800, borderRadius: 4, px: 5,
              '&:hover': { bgcolor: 'grey.100' }
            }}>Get Started Now</Button>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
