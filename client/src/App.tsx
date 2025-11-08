import { Switch, Route } from "wouter";
import XRPWallet from "@/pages/xrp-wallet-redesigned";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
// @ts-ignore - TS server needs restart, package is installed
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeProvider";
import HomePage from "@/pages/home";
const TradeV3Page = lazy(() => import("@/pages/trade-v3"));
// Lazy load social and rewards components
const SmartNewsfeed = lazy(() => import("@/pages/newsfeed"));
const SocialProfile = lazy(() => import("@/pages/social-profile"));
const MessagingSystem = lazy(() => import("@/pages/messaging-system"));
const RiddleDetailPage = lazy(() => import("@/pages/riddle-detail"));
const Rewards = lazy(() => import("@/pages/rewards"));
// Removed unused RewardsNew to reduce bundle size and avoid dead code
const UserRewards = lazy(() => import("@/pages/user-rewards"));
const RewardsDashboard = lazy(() => import("@/pages/rewards-dashboard"));
const SocialEngagement = lazy(() => import("@/pages/SocialEngagement"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage").then(module => ({ default: module.TransactionsPage })));
import ProfessionalHeader from "@/components/professional-header";
import SearchBar from "@/components/search-bar";
import UniversalFooter from "@/components/universal-footer";

// Lazy load swap and DeFi components (legacy pages removed; kept Liquidity page)
const LiquidityPage = lazy(() => import("@/pages/liquidity"));
const PortfolioPage = lazy(() => import("@/pages/portfolio"));
const DexScreenerPage = lazy(() => import("@/pages/dexscreener"));

// Lazy load NFT and analytics components
const NFTCollectionPage = lazy(() => import("@/pages/nft-collection"));
const NFTCollectionsPage = lazy(() => import("@/pages/nft-collections"));
const NFTMarketplacePage = lazy(() => import("@/pages/nft-marketplace"));
const MultiChainNFTMarketplace = lazy(() => import("@/pages/multichain-nft-marketplace"));
const NFTCollectionDetail = lazy(() => import("@/pages/nft-collection-detail"));
const EthMarketplacePage = lazy(() => import("@/pages/eth-marketplace"));
const SolMarketplacePage = lazy(() => import("@/pages/sol-marketplace"));
const NFTDetailPage = lazy(() => import("@/pages/nft-detail").then(module => ({ default: module.NFTDetailPage })));
const AcceptOfferPage = lazy(() => import("@/pages/accept-offer"));
const NFTGatewayPage = lazy(() => import("@/pages/nft-gateway"));
const GamingNFTs = lazy(() => import("@/pages/GamingNFTs"));
const WalletProfile = lazy(() => import("@/pages/wallet-profile"));
const TokenAnalytics = lazy(() => import("@/pages/token-analytics"));
const RiddleScanner = lazy(() => import("@/pages/riddle-scanner"));
const AdvancedSearch = lazy(() => import("@/pages/advanced-search"));
const SearchResults = lazy(() => import("@/pages/search-results"));

const NFTLaunchpadDashboard = lazy(() => import("@/pages/nft-launchpad-dashboard"));
const NFTManagementPage = lazy(() => import("@/pages/nft-management"));
const NFTProfilePage = lazy(() => import("@/pages/nft-profile"));
const NFTTop24hPage = lazy(() => import("@/pages/nft-top24h"));
const BrokerMarketplace = lazy(() => import("@/pages/broker-marketplace"));
// Lazy load static and admin pages
const BridgeCountdown = lazy(() => import("@/pages/bridge-countdown"));
const OurStoryPage = lazy(() => import("@/pages/our-story"));
const OurHistoryPage = lazy(() => import("@/pages/our-history"));
const TeamPage = lazy(() => import("@/pages/team"));
const ContactPage = lazy(() => import("@/pages/contact"));
const PrivacyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsPage = lazy(() => import("@/pages/terms-of-service"));
const UnifiedAdminPage = lazy(() => import("@/pages/unified-admin"));
const LandImageGenerator = lazy(() => import("@/pages/admin/land-image-generator").then(module => ({ default: module.LandImageGenerator })));
const ErrorHandlingPage = lazy(() => import("@/pages/error-handling"));
const StatisticsPage = lazy(() => import("@/pages/statistics"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const NotFound = lazy(() => import("@/pages/not-found"));
import InstallPrompt from "@/components/install-prompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useLocation } from "wouter";
import { recoverWalletState } from "@/lib/xrpl";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
// REMOVED: AppKit config - using separate wallet plugins
import "./styles/global-theme.css"; // Enhanced theme system
import "./styles/chain-logos.css"; // Centralized chain logo styles
import "./styles/wallet-connect-fix.css"; // Wallet Connect modal z-index fixes
import { SessionMonitor } from "@/components/SessionMonitor";
import { GlobalSessionRenewalHandler } from "@/components/GlobalSessionRenewalHandler";
import { AuthGuard } from "@/components/AuthGuard";
import GDPRCookieConsent from "@/components/GDPRCookieConsent";
import BottomShortcutBar from "@/components/BottomShortcutBar";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

// Lazy load Riddle Wallet pages
const CreateWallet = lazy(() => import("@/pages/create-wallet"));
const WalletLogin = lazy(() => import("@/pages/wallet-login"));
const ExternalWallets = lazy(() => import("@/pages/external-wallets"));
const LinkedWallets = lazy(() => import("@/pages/linked-wallets"));
const AccountRecovery = lazy(() => import("@/pages/account-recovery"));
const WalletDashboard = lazy(() => import("@/pages/wallet-dashboard"));

// Lazy load wallet components for better performance
const ETHWallet = lazy(() => import("@/pages/eth-wallet"));

const SOLWallet = lazy(() => import("@/pages/sol-wallet"));
const BTCWallet = lazy(() => import("@/pages/btc-wallet"));
const BNBWallet = lazy(() => import("@/pages/bnb-wallet"));

// Lazy load Trader Tools for better performance
const WalletSearch = lazy(() => import("@/pages/traders/wallet-search"));
const TokenSafety = lazy(() => import("@/pages/traders/token-safety"));
const TradingDesk = lazy(() => import("@/pages/traders/trading-desk"));
const CopyTrading = lazy(() => import("@/pages/traders/copy-trading"));
const Staking = lazy(() => import("@/pages/traders/staking"));
const GroupSniper = lazy(() => import("@/pages/traders/group-sniper"));
// Lazy load multi-chain wallet components
const BaseWallet = lazy(() => import("@/pages/base-wallet"));
const AvaxWallet = lazy(() => import("@/pages/avax-wallet"));
const SessionPage = lazy(() => import("@/pages/session"));
const PolygonWallet = lazy(() => import("@/pages/polygon-wallet"));
const ArbitrumWallet = lazy(() => import("@/pages/arbitrum-wallet"));
const OptimismWallet = lazy(() => import("@/pages/optimism-wallet"));
const FantomWallet = lazy(() => import("@/pages/fantom-wallet"));
const ZkSyncWallet = lazy(() => import("@/pages/zksync-wallet"));
const LineaWallet = lazy(() => import("@/pages/linea-wallet"));
const TaikoWallet = lazy(() => import("@/pages/taiko-wallet"));
const UnichainWallet = lazy(() => import("@/pages/unichain-wallet"));
const SoneiumWallet = lazy(() => import("@/pages/soneium-wallet"));
const MantleWallet = lazy(() => import("@/pages/mantle-wallet"));
const MetisWallet = lazy(() => import("@/pages/metis-wallet"));
const ScrollWallet = lazy(() => import("@/pages/scroll-wallet"));
// Lazy load send/receive components
const SendPage = lazy(() => import("@/pages/send"));
const ReceivePage = lazy(() => import("@/pages/receive"));

// Lazy load Financial Ecosystem pages
const StakingMain = lazy(() => import("@/pages/Staking"));
const LoansMain = lazy(() => import("@/pages/Loans"));
const NftSwapsMain = lazy(() => import("@/pages/NftSwaps"));

// Lazy load DevTools pages for better performance
const DevToolsDashboard = lazy(() => import("@/pages/devtools-dashboard"));
const DevToolsTokenCreator = lazy(() => import("@/pages/devtools-token-creator"));
const DevToolsNftCreator = lazy(() => import("@/pages/devtools-nft-creator"));
const DevToolsSnapshotNft = lazy(() => import("@/pages/devtools-snapshot-nft"));
const DevToolsSnapshotToken = lazy(() => import("@/pages/devtools-snapshot-token"));
const DevToolsAirdropTool = lazy(() => import("@/pages/devtools-airdrop-tool"));
const DevToolsProjectDetail = lazy(() => import("@/pages/devtools-project-detail"));
const DevToolsTokenProject = lazy(() => import("@/pages/devtools-token-project"));
const DevToolsNFTProject = lazy(() => import("@/pages/devtools-nft-project"));
const ProjectWizard = lazy(() => import("@/pages/project-wizard"));
const SubscriptionPlans = lazy(() => import("@/pages/subscription-plans"));
const MarketMaker = lazy(() => import("@/pages/market-maker"));
// Lazy load specialized pages
const RiddlePadLaunchpad = lazy(() => import("@/pages/riddlepad-launchpad"));
const BridgeInfo = lazy(() => import("@/pages/bridge-info"));
const RiddleBridge = lazy(() => import("@/pages/riddle-bridge"));
const WalletSection = lazy(() => import("@/pages/wallet-section"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const TheOraclePage = lazy(() => import("@/pages/riddleauthor"));
const MappingSystemPage = lazy(() => import("@/pages/mapping-system"));
const InquisitionLanding = lazy(() => import("@/pages/inquisition-landing"));
const BattleDashboard = lazy(() => import("@/pages/battle-dashboard"));
const SpectateBattles = lazy(() => import("@/pages/spectate-battles"));
const LandMarketplace = lazy(() => import("@/pages/land-marketplace"));
const LandPlotDetail = lazy(() => import("@/pages/land-plot-detail"));
const VaultPage = lazy(() => import("@/pages/vault"));
const VaultAdminPage = lazy(() => import("@/pages/vault-admin"));

// Lazy load Gaming V3 System with timeout protection
const GamingV3 = lazy(() => {
  console.log('🎮 [ROUTE LOAD] Starting GamingV3 component load...');
  
  // Create a timeout promise
  const timeoutPromise: Promise<any> = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('GamingV3 component load timeout after 10 seconds')), 10000);
  });
  
  const loadComponent = async () => {
    try {
      const modulePromise = import("@/pages/gaming-dashboard-v3");
      const module = await Promise.race([modulePromise, timeoutPromise]);
      console.log('✅ [ROUTE LOAD] GamingV3 loaded successfully');
      return module;
    } catch (err) {
      console.error('❌ [ROUTE LOAD] Failed to load GamingV3:', err);
      // Return a fallback component instead of throwing
      return {
        default: () => (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Component Load Error</h2>
              <p className="text-muted-foreground mb-4">{err instanceof Error ? err.message : 'Failed to load gaming dashboard'}</p>
              <a href="/" className="text-primary underline">Return to home</a>
            </div>
          </div>
        )
      };
    }
  };
  
  return loadComponent();
});

// Reuse frequent lazy modules for stability and performance
const GamingDashboardV3 = lazy(() => import("@/pages/gaming-dashboard-v3"));
const BattleRoomPage = lazy(() => import("@/pages/battle-room"));
const PublicGamerProfilePage = lazy(() => import("@/pages/public-gamer-profile"));
const ExternalWalletTestingPage = lazy(() => import("@/pages/external-wallet-testing"));
const TradingDashboardPage = lazy(() => import("@/pages/trading-dashboard"));
const WeaponsArsenalPage = lazy(() => import("@/pages/weapons-arsenal"));
const WeaponsMarketplacePage = lazy(() => import("@/pages/weapons-marketplace"));
const WeaponDetailPage = lazy(() => import("@/pages/weapon-detail"));
const GamingNFTsPage = lazy(() => import("@/pages/GamingNFTs"));
const EditGamingProfilePage = lazy(() => import("@/pages/edit-gaming-profile"));
const WhitepaperPage = lazy(() => import("@/pages/whitepaper"));
const ThemeShowcasePage = lazy(() => import("@/pages/theme-showcase"));
const DocumentationPage = lazy(() => import("@/pages/documentation"));
const DocViewerPage = lazy(() => import("@/pages/doc-viewer"));
const InquisitionWizardPage = lazy(() => import("@/pages/inquisition-wizard"));
const InquisitionProfilePage = lazy(() => import("@/pages/inquisition-profile"));
const InquisitionPlayerProfilePage = lazy(() => import("@/pages/inquisition-player-profile"));
const InquisitionCollectionsPage = lazy(() => import("@/pages/inquisition-collections"));
const RiddleCityPage = lazy(() => import("@/pages/riddlecity"));
const RiddleCityPublicCityPage = lazy(() => import("@/pages/riddlecity-public-city"));

// Lazy load Wallet Management
const WalletManagementPage = lazy(() => import("@/pages/wallet-management"));
const NFTWalletManagement = lazy(() => import("@/pages/nft-wallet-management"));
const MultiChainDashboard = lazy(() => import("@/pages/multi-chain-dashboard"));

// Token Launchpad - Using lazy loading to avoid import errors
const LaunchpadDashboard = lazy(() => import("@/pages/launchpad/launchpad-dashboard").catch(() => import("@/pages/not-found")));
const TokenLaunchDetail = lazy(() => import("@/pages/launchpad/token-launch-detail").catch(() => import("@/pages/not-found")));

// Collection Showcase Pages
const TheInquisitionCollection = lazy(() => import("@/pages/collection-the-inquisition"));
const TheInquiryCollection = lazy(() => import("@/pages/collection-the-inquiry"));
const TheLostEmporiumCollection = lazy(() => import("@/pages/collection-lost-emporium"));
const DantesAurumCollection = lazy(() => import("@/pages/collection-dantes-aurum"));
const UnderTheBridgeCollection = lazy(() => import("@/pages/collection-under-the-bridge"));
const RDLTokenPage = lazy(() => import("@/pages/collection-rdl-token"));

// Define all lazy imports at module scope for stable component identities
const PumpFunPage = lazy(() => import("@/pages/pump-fun"));
const NftLaunchpadPage = lazy(() => import("@/pages/nft-launchpad"));
const NftLaunchpadCreatePage = lazy(() => import("@/pages/nft-launchpad-create"));
const TestErrorHandlingPage = lazy(() => import("@/test-error-handling"));

// Launch Wizard pages
const LaunchWizard = lazy(() => import("@/pages/launch-wizard"));
const LaunchNFTSingle = lazy(() => import("@/pages/launch-nft-single"));
const LaunchNFTCollection = lazy(() => import("@/pages/launch-nft-collection"));
const LaunchToken = lazy(() => import("@/pages/launch-token"));
// Using social-profile for full-featured profile with uploads
const ProfilePage = lazy(() => import("@/pages/social-profile"));
const WalletDetailsPage = lazy(() => import("@/pages/wallet-details"));
const AIStudioPage = lazy(() => import("@/pages/ai-studio"));
const ProjectVanityPage = lazy(() => import("@/pages/project-vanity"));
// Unified admin dashboard handles all admin functionality

// Define stable component wrappers for AuthGuard routes with lazy loading
const StakingRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><StakingMain /></Suspense></AuthGuard>;
const LoansRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><LoansMain /></Suspense></AuthGuard>;
const NftSwapsRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><NftSwapsMain /></Suspense></AuthGuard>;
const UnifiedAdminRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><UnifiedAdminPage /></Suspense></AuthGuard>;
const LandImageGeneratorRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><LandImageGenerator /></Suspense></AuthGuard>;
const WalletDashboardRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><WalletDashboard /></Suspense></AuthGuard>;
const ETHWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><ETHWallet /></Suspense></AuthGuard>;
const XRPWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><XRPWallet /></Suspense></AuthGuard>;
const SOLWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><SOLWallet /></Suspense></AuthGuard>;
const BTCWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><BTCWallet /></Suspense></AuthGuard>;
const BNBWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><BNBWallet /></Suspense></AuthGuard>;
const BaseWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><BaseWallet /></Suspense></AuthGuard>;
const AvaxWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><AvaxWallet /></Suspense></AuthGuard>;
const PolygonWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><PolygonWallet /></Suspense></AuthGuard>;
const ArbitrumWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><ArbitrumWallet /></Suspense></AuthGuard>;
const OptimismWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><OptimismWallet /></Suspense></AuthGuard>;
const FantomWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><FantomWallet /></Suspense></AuthGuard>;
const ZkSyncWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><ZkSyncWallet /></Suspense></AuthGuard>;
const LineaWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><LineaWallet /></Suspense></AuthGuard>;
const TaikoWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><TaikoWallet /></Suspense></AuthGuard>;
const UnichainWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><UnichainWallet /></Suspense></AuthGuard>;
const SoneiumWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><SoneiumWallet /></Suspense></AuthGuard>;
const MantleWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><MantleWallet /></Suspense></AuthGuard>;
const MetisWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><MetisWallet /></Suspense></AuthGuard>;
const ScrollWalletRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><ScrollWallet /></Suspense></AuthGuard>;
const MultiChainDashboardRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><MultiChainDashboard /></Suspense></AuthGuard>;
const SendRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><SendPage /></Suspense></AuthGuard>;
const ReceiveRoute = () => <AuthGuard><Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}><ReceivePage /></Suspense></AuthGuard>;

// Safe client-side redirect component to avoid full page reloads
const SafeRedirect = ({ to }: { to: string }) => {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
};

// Reusable redirect wrappers
const RedirectToTradeV3 = () => <SafeRedirect to="/trade-v3" />;
const RedirectToAdmin = () => <SafeRedirect to="/admin" />;
const RedirectToDevTools = () => <SafeRedirect to="/devtools" />;

// Loading fallback component
const RouteSuspenseFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-sm text-muted-foreground">Loading page...</p>
    </div>
  </div>
);


function Router() {
  console.log('🗺️ Router: Router component is rendering');
  
  const [location] = useLocation();
  console.log('📍 Router: Current location:', location);
  
  const [walletData, setWalletData] = useState(() => {
    console.log('💳 Router: Initializing wallet data state');
    // Only load wallet data if session exists - use standardized key
    const sessionToken = localStorage.getItem('riddle_session_token') || localStorage.getItem('sessionToken'); // Legacy fallback
    if (!sessionToken) {
      console.log('🔓 Router: No session token found');
      return null;
    }
    const saved = localStorage.getItem('riddleWallet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('💰 Router: Wallet data loaded from localStorage');
        return parsed;
      } catch {
        console.log('⚠️ Router: Error parsing saved wallet data');
        return null;
      }
    }
    console.log('📭 Router: No saved wallet data found');
    return null;
  });

  // Scroll to top whenever route changes - force instant scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    // Also ensure body is scrolled to top
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [location]);

  const handleLogout = async () => {
    // Import and use comprehensive clear function
    const { clearAllWalletData } = await import('./lib/queryClient');
    clearAllWalletData();
    setWalletData(null);
    // Force reload to ensure clean state
    window.location.href = '/';
  };

  // Listen for session expiration events
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('🔓 Session expired - logging out user');
      handleLogout();
      // Optionally show a toast notification
      // toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{marginTop: 0, paddingTop: 0}}>
      <ProfessionalHeader />
      <SearchBar />
      <div className="flex-1">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading page...</p>
            </div>
          </div>
        }>
          <Switch>
            {(() => {
              // Central grouped route configuration (order matters for precedence)
              type SimpleRoute = { path: string; component: any };
              const groups: { name: string; routes: SimpleRoute[] }[] = [
                {
                  name: 'core',
                  routes: [
                    { path: '/', component: HomePage },
                    { path: '/search', component: SearchResults },
                    { path: '/settings', component: SettingsPage },
                  ],
                },
                {
                  name: 'trade-legacy-redirects',
                  routes: [
                    { path: '/xrpl-swap', component: RedirectToTradeV3 },
                    { path: '/swap', component: RedirectToTradeV3 },
                    { path: '/solana-swap', component: RedirectToTradeV3 },
                    { path: '/trade-v3', component: TradeV3Page },
                    { path: '/pump-fun', component: PumpFunPage },
                    { path: '/liquidity', component: LiquidityPage },
                  ],
                },
                {
                  name: 'financial-ecosystem',
                  routes: [
                    { path: '/staking', component: StakingRoute },
                    { path: '/loans', component: LoansRoute },
                    { path: '/nft-swaps', component: NftSwapsRoute },
                    { path: '/portfolio', component: PortfolioPage },
                    { path: '/dexscreener', component: DexScreenerPage },
                    { path: '/analytics', component: DexScreenerPage },
                    { path: '/token-launchpad', component: LaunchpadDashboard },
                  ],
                },
                {
                  name: 'nft-marketplace-and-detail',
                  routes: [
                    // Marketplace before detail param routes to preserve precedence
                    { path: '/nft-marketplace', component: NFTMarketplacePage },
                    { path: '/nft-marketplace-v2', component: NFTMarketplacePage },
                    { path: '/gaming-nfts', component: GamingNFTs },
                    { path: '/eth', component: EthMarketplacePage },
                    { path: '/sol', component: SolMarketplacePage },
                    { path: '/nft/collection/:taxon', component: NFTCollectionPage },
                    { path: '/nft-collections', component: NFTCollectionsPage },
                    { path: '/nft-collection/:chain/:contractAddress', component: NFTCollectionDetail },
                    { path: '/nft-collection/:issuer/:taxon', component: NFTCollectionDetail },
                    { path: '/nft/:nftId/accept-offer/:offerId', component: AcceptOfferPage },
                    { path: '/nft/:id', component: NFTDetailPage },
                    { path: '/nft-gateway', component: NFTGatewayPage },
                    { path: '/nft-launchpad', component: NftLaunchpadPage },
                    { path: '/nft/launchpad/create', component: NftLaunchpadCreatePage },
                    { path: '/nft/launchpad/dashboard', component: NFTLaunchpadDashboard },
                  ],
                },
                {
                  name: 'collections-showcase',
                  routes: [
                    { path: '/collections/the-inquisition', component: TheInquisitionCollection },
                    { path: '/collections/the-inquiry', component: TheInquiryCollection },
                    { path: '/collections/the-lost-emporium', component: TheLostEmporiumCollection },
                    { path: '/collections/dantes-aurum', component: DantesAurumCollection },
                    { path: '/collections/under-the-bridge', component: UnderTheBridgeCollection },
                    { path: '/token/rdl', component: RDLTokenPage },
                  ],
                },
                {
                  name: 'launch-wizard',
                  routes: [
                    { path: '/launch', component: LaunchWizard },
                    { path: '/launch/nft-single', component: LaunchNFTSingle },
                    { path: '/launch/nft-collection', component: LaunchNFTCollection },
                    { path: '/launch/token', component: LaunchToken },
                    { path: '/nft-management', component: NFTManagementPage },
                    { path: '/nft-profile/:id', component: NFTProfilePage },
                    { path: '/nft-top24h', component: NFTTop24hPage },
                    { path: '/broker-marketplace', component: BrokerMarketplace },
                  ],
                },
                {
                  name: 'bridge-info',
                  routes: [
                    { path: '/bridge-info', component: BridgeInfo },
                    { path: '/bridge', component: RiddleBridge },
                    { path: '/transactions', component: TransactionsPage },
                    { path: '/bridge-countdown', component: BridgeCountdown },
                  ],
                },
                {
                  name: 'static-info',
                  routes: [
                    { path: '/our-story', component: OurStoryPage },
                    { path: '/our-history', component: OurHistoryPage },
                    { path: '/team', component: TeamPage },
                    { path: '/contact', component: ContactPage },
                    { path: '/privacy', component: PrivacyPage },
                    { path: '/terms', component: TermsPage },
                    { path: '/roadmap', component: RoadmapPage },
                    { path: '/statistics', component: StatisticsPage },
                  ],
                },
                {
                  name: 'admin',
                  routes: [
                    { path: '/admin', component: UnifiedAdminRoute },
                    { path: '/admin/land-image-generator', component: LandImageGeneratorRoute },
                    { path: '/admin/twitter', component: RedirectToAdmin },
                    { path: '/admin/traders-tools', component: RedirectToAdmin },
                    { path: '/admin/riddleswap-reports', component: RedirectToAdmin },
                    { path: '/admin/error-logs', component: RedirectToAdmin },
                  ],
                },
                {
                  name: 'diagnostics-errors',
                  routes: [
                    { path: '/error', component: ErrorHandlingPage },
                    { path: '/test-error-handling', component: TestErrorHandlingPage },
                  ],
                },
                {
                  name: 'wallet-auth',
                  routes: [
                    { path: '/create-wallet', component: CreateWallet },
                    { path: '/wallet-login', component: WalletLogin },
                    { path: '/external-wallets', component: ExternalWallets },
                    { path: '/linked-wallets', component: LinkedWallets },
                    { path: '/account-recovery', component: AccountRecovery },
                    { path: '/wallet-dashboard', component: WalletDashboardRoute },
                    { path: '/login', component: WalletLogin }, // legacy alias
                    { path: '/session', component: SessionPage },
                    { path: '/profile', component: ProfilePage },
                    { path: '/wallet-details', component: WalletDetailsPage },
                    { path: '/wallet-manage', component: WalletDashboardRoute },
                    { path: '/multi-chain-dashboard', component: MultiChainDashboardRoute },
                  ],
                },
                {
                  name: 'wallet-send-receive',
                  routes: [
                    { path: '/xrpl/send', component: SendRoute },
                    { path: '/xrpl/receive', component: ReceiveRoute },
                    { path: '/ethereum/send', component: SendRoute },
                    { path: '/ethereum/receive', component: ReceiveRoute },
                    { path: '/solana/send', component: SendRoute },
                    { path: '/solana/receive', component: ReceiveRoute },
                    { path: '/bitcoin/send', component: SendRoute },
                    { path: '/bitcoin/receive', component: ReceiveRoute },
                    { path: '/send', component: SendRoute },
                    { path: '/receive', component: ReceiveRoute },
                  ],
                },
                {
                  name: 'social-and-messaging',
                  routes: [
                    { path: '/social/profile', component: SocialProfile },
                    { path: '/social/messages', component: MessagingSystem },
                    { path: '/messaging', component: MessagingSystem },
                    { path: '/social/feed', component: SmartNewsfeed },
                    { path: '/newsfeed', component: SmartNewsfeed },
                    { path: '/news-feed', component: SmartNewsfeed },
                    { path: '/riddle/:id', component: RiddleDetailPage },
                    { path: '/social/engagement', component: SocialEngagement },
                    { path: '/messaging-system', component: MessagingSystem },
                    { path: '/messages', component: MessagingSystem },
                  ],
                },
                {
                  name: 'wallet-chains',
                  routes: [
                    { path: '/eth-wallet', component: ETHWalletRoute },
                    { path: '/xrp-wallet', component: XRPWalletRoute },
                    { path: '/xrp-wallet-redesigned', component: XRPWalletRoute },
                    { path: '/sol-wallet', component: SOLWalletRoute },
                    { path: '/btc-wallet', component: BTCWalletRoute },
                    { path: '/bnb-wallet', component: BNBWalletRoute },
                    { path: '/base-wallet', component: BaseWalletRoute },
                    { path: '/avax-wallet', component: AvaxWalletRoute },
                    { path: '/polygon-wallet', component: PolygonWalletRoute },
                    { path: '/arbitrum-wallet', component: ArbitrumWalletRoute },
                    { path: '/optimism-wallet', component: OptimismWalletRoute },
                    { path: '/fantom-wallet', component: FantomWalletRoute },
                    { path: '/zksync-wallet', component: ZkSyncWalletRoute },
                    { path: '/linea-wallet', component: LineaWalletRoute },
                    { path: '/taiko-wallet', component: TaikoWalletRoute },
                    { path: '/unichain-wallet', component: UnichainWalletRoute },
                    { path: '/soneium-wallet', component: SoneiumWalletRoute },
                    { path: '/mantle-wallet', component: MantleWalletRoute },
                    { path: '/metis-wallet', component: MetisWalletRoute },
                    { path: '/scroll-wallet', component: ScrollWalletRoute },
                  ],
                },
                {
                  name: 'token-analytics',
                  routes: [
                    { path: '/scanner', component: RiddleScanner },
                    { path: '/riddle-scanner', component: RiddleScanner },
                    // Chain token routes
                    { path: '/token/:symbol/:issuer', component: TokenAnalytics },
                    { path: '/xrpl/:symbol/:issuer', component: TokenAnalytics },
                    { path: '/eth/:address', component: TokenAnalytics },
                    { path: '/ethereum/:address', component: TokenAnalytics },
                    { path: '/bsc/:address', component: TokenAnalytics },
                    { path: '/bnb/:address', component: TokenAnalytics },
                    { path: '/polygon/:address', component: TokenAnalytics },
                    { path: '/matic/:address', component: TokenAnalytics },
                    { path: '/arbitrum/:address', component: TokenAnalytics },
                    { path: '/arb/:address', component: TokenAnalytics },
                    { path: '/optimism/:address', component: TokenAnalytics },
                    { path: '/op/:address', component: TokenAnalytics },
                    { path: '/base/:address', component: TokenAnalytics },
                    { path: '/avalanche/:address', component: TokenAnalytics },
                    { path: '/avax/:address', component: TokenAnalytics },
                    { path: '/fantom/:address', component: TokenAnalytics },
                    { path: '/ftm/:address', component: TokenAnalytics },
                    { path: '/cronos/:address', component: TokenAnalytics },
                    { path: '/gnosis/:address', component: TokenAnalytics },
                    { path: '/celo/:address', component: TokenAnalytics },
                    { path: '/moonbeam/:address', component: TokenAnalytics },
                    { path: '/zksync/:address', component: TokenAnalytics },
                    { path: '/linea/:address', component: TokenAnalytics },
                    { path: '/solana/:address', component: TokenAnalytics },
                    { path: '/bitcoin/:address', component: TokenAnalytics },
                    { path: '/btc/:address', component: TokenAnalytics },
                    // Legacy token routes
                    { path: '/token/solana/:address', component: TokenAnalytics },
                    { path: '/token/ethereum/:address', component: TokenAnalytics },
                    { path: '/token/bsc/:address', component: TokenAnalytics },
                    { path: '/token/polygon/:address', component: TokenAnalytics },
                    { path: '/token/arbitrum/:address', component: TokenAnalytics },
                    { path: '/token/optimism/:address', component: TokenAnalytics },
                    { path: '/token/base/:address', component: TokenAnalytics },
                    { path: '/token/avalanche/:address', component: TokenAnalytics },
                    { path: '/token/fantom/:address', component: TokenAnalytics },
                    { path: '/token/cronos/:address', component: TokenAnalytics },
                    { path: '/token/gnosis/:address', component: TokenAnalytics },
                    { path: '/token/celo/:address', component: TokenAnalytics },
                    { path: '/token/moonbeam/:address', component: TokenAnalytics },
                    { path: '/token/zksync/:address', component: TokenAnalytics },
                    { path: '/token/linea/:address', component: TokenAnalytics },
                    { path: '/token/bitcoin/:address', component: TokenAnalytics },
                  ],
                },
                {
                  name: 'rewards',
                  routes: [
                    { path: '/user-rewards', component: UserRewards },
                    { path: '/rewards', component: Rewards },
                    { path: '/rewards-old', component: UserRewards },
                    { path: '/rewards-dashboard', component: RewardsDashboard },
                  ],
                },
                {
                  name: 'devtools',
                  routes: [
                    { path: '/devtools', component: DevToolsDashboard },
                    { path: '/devtools/new-project', component: ProjectWizard },
                    { path: '/devtools/project/:id', component: DevToolsProjectDetail },
                    { path: '/devtools/token/:id', component: DevToolsTokenProject },
                    { path: '/devtools/nft/:id', component: DevToolsNFTProject },
                    { path: '/devtools/project/:projectId/token-creator', component: DevToolsTokenCreator },
                    { path: '/devtools/project/:projectId/nft-creator', component: DevToolsNftCreator },
                    { path: '/devtools/project/:projectId/airdrop', component: DevToolsAirdropTool },
                    { path: '/devtools/project/:projectId/snapshot-token', component: DevToolsSnapshotToken },
                    { path: '/devtools/project/:projectId/snapshot-nft', component: DevToolsSnapshotNft },
                    { path: '/devtools/project/:projectId/market-maker', component: MarketMaker },
                    { path: '/devtools/subscription-plans', component: SubscriptionPlans },
                    { path: '/developer-dashboard', component: RedirectToDevTools },
                    { path: '/devtools-dashboard', component: DevToolsDashboard },
                    { path: '/devtools/comprehensive-airdrop', component: lazy(() => import('@/pages/comprehensive-airdrop-tool')) },
                  ],
                },
                {
                  name: 'wallet-external-tools',
                  routes: [
                    { path: '/wallet-section', component: WalletSection },
                    { path: '/wallet-connect', component: WalletSection },
                    { path: '/external-wallet-testing', component: ExternalWalletTestingPage },
                    { path: '/trading-dashboard', component: TradingDashboardPage },
                  ],
                },
                {
                  name: 'ai-and-oracle',
                  routes: [
                    { path: '/ai-studio', component: AIStudioPage },
                    { path: '/riddleauthor', component: TheOraclePage },
                    { path: '/ai', component: TheOraclePage },
                    { path: '/ai-narrator', component: TheOraclePage },
                  ],
                },
                {
                  name: 'mapping-system',
                  routes: [
                    { path: '/mapping', component: MappingSystemPage },
                    { path: '/coordinates', component: MappingSystemPage },
                    { path: '/map', component: MappingSystemPage },
                  ],
                },
                {
                  name: 'gaming-v3-and-legacy',
                  routes: [
                    { path: '/inquisition-landing', component: InquisitionLanding },
                    { path: '/inquisition-gaming', component: GamingDashboardV3 },
                    { path: '/inquisition-gaming-v3', component: GamingDashboardV3 },
                    { path: '/nft-gaming', component: GamingDashboardV3 },
                    { path: '/nft-gaming-dashboard', component: GamingDashboardV3 },
                    { path: '/battle-dashboard', component: BattleDashboard },
                    { path: '/battle/:id', component: BattleRoomPage },
                    { path: '/spectate-battles', component: SpectateBattles },
                    { path: '/gaming-dashboard', component: GamingDashboardV3 },
                    { path: '/gamerprofile/:handle', component: PublicGamerProfilePage },
                    { path: '/trolls-inquisition', component: GamingDashboardV3 },
                    { path: '/the-trolls-inquisition', component: GamingDashboardV3 },
                    { path: '/land', component: LandMarketplace },
                    { path: '/land-marketplace', component: LandMarketplace },
                    { path: '/land-purchase', component: LandMarketplace },
                    { path: '/land/:plotNumber', component: LandPlotDetail },
                    { path: '/weapons-arsenal', component: WeaponsArsenalPage },
                    { path: '/weapons-marketplace', component: WeaponsMarketplacePage },
                    { path: '/weapon-detail/:nftTokenId', component: WeaponDetailPage },
                    { path: '/view-all-nfts', component: GamingNFTsPage },
                    { path: '/gaming-nfts', component: GamingNFTsPage },
                    { path: '/gaming/nft-detail/:id', component: NFTDetailPage },
                    { path: '/gaming/my-nfts', component: GamingNFTsPage },
                    { path: '/gaming/squadrons/:id', component: lazy(() => import('@/pages/squadron-detail')) },
                    { path: '/edit-gaming-profile', component: EditGamingProfilePage },
                    { path: '/squadrons', component: GamingDashboardV3 },
                    { path: '/battles', component: lazy(() => import('@/pages/inquisition-battles')) },
                    { path: '/alliances', component: lazy(() => import('@/pages/inquisition-alliances')) },
                    { path: '/gaming', component: GamingV3 },
                    // Catch-all /gaming routes - MUST BE LAST to avoid shadowing specific routes
                    { path: '/gaming/:rest*', component: GamingV3 },
                  ],
                },
                {
                  name: 'inquisition-audit-system',
                  routes: [
                    { path: '/inquisition', component: GamingDashboardV3 },
                    { path: '/inquisition/wizard', component: InquisitionWizardPage },
                    { path: '/inquisition/profile', component: InquisitionProfilePage },
                    { path: '/inquisition/player/:handle', component: InquisitionPlayerProfilePage },
                    { path: '/inquisition/collections', component: InquisitionCollectionsPage },
                    { path: '/inquisition/collections/:id', component: InquisitionCollectionsPage },
                    { path: '/inquisition/leaderboard', component: GamingDashboardV3 },
                    { path: '/inquisition/alliances', component: lazy(() => import('@/pages/inquisition-alliances')) },
                    { path: '/inquisition/battles', component: lazy(() => import('@/pages/inquisition-battles')) },
                    { path: '/inquisition/tournaments', component: lazy(() => import('@/pages/inquisition-battles')) },
                  ],
                },
                {
                  name: 'riddle-city',
                  routes: [
                    { path: '/riddlecity', component: RiddleCityPage },
                    { path: '/riddle-city', component: RiddleCityPage },
                    { path: '/riddlecity/city/:handle', component: RiddleCityPublicCityPage },
                  ],
                },
                {
                  name: 'vault',
                  routes: [
                    { path: '/vault', component: VaultPage },
                    { path: '/vault-admin', component: VaultAdminPage },
                  ],
                },
                {
                  name: 'traders-tools',
                  routes: [
                    { path: '/traders/wallet-search', component: WalletSearch },
                    { path: '/traders/token-safety', component: TokenSafety },
                    { path: '/traders/trading-desk', component: TradingDesk },
                    { path: '/traders/copy-trading', component: CopyTrading },
                    { path: '/traders/staking', component: Staking },
                    { path: '/traders/group-sniper', component: GroupSniper },
                  ],
                },
                {
                  name: 'documentation',
                  routes: [
                    { path: '/whitepaper', component: WhitepaperPage },
                    { path: '/theme-showcase', component: ThemeShowcasePage },
                    { path: '/docs', component: DocumentationPage },
                    { path: '/docs/:docId', component: DocViewerPage },
                  ],
                },
                {
                  name: 'project-vanity',
                  routes: [
                    { path: '/project/:vanityUrl', component: ProjectVanityPage },
                    { path: '/wallet/:address', component: WalletProfile },
                  ],
                },
              ];

              // Duplicate path detection (dev only)
              if (process.env.NODE_ENV !== 'production') {
                const seen = new Map<string, string>();
                groups.forEach(g => g.routes.forEach(r => {
                  if (seen.has(r.path)) {
                    console.warn(`[routes] Duplicate path detected: '${r.path}' (previous group: ${seen.get(r.path)} current group: ${g.name})`);
                  } else {
                    seen.set(r.path, g.name);
                  }
                }));
              }

              return [
                ...groups.flatMap(g => g.routes.map(r => <Route key={r.path} path={r.path} component={r.component} />)),
                <Route key="__not_found__" component={NotFound} />,
              ];
            })()}
          </Switch>
        </Suspense>
      </div>
      <UniversalFooter />
    </div>
  );
}

// Inner component that uses hooks requiring QueryClient
function AppContent() {
  // Pull-to-refresh functionality - works on all pages
  const { isPulling, pullDistance, isRefreshing, shouldShowIndicator } = usePullToRefresh({
    threshold: 80,
    maxPullDistance: 150
  });
  const { toast } = useToast();
  
  useEffect(() => {
    // Only recover wallet state if there's actually wallet data to recover
    const sessionToken = localStorage.getItem('sessionToken') || localStorage.getItem('riddle_session_token');
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    const hasWalletAddress = localStorage.getItem('xrpl_wallet_address') || 
                             localStorage.getItem('eth_wallet_address') || 
                             localStorage.getItem('sol_wallet_address');
    
    if ((sessionToken || sessionData) && hasWalletAddress) {
      console.log('🔄 App.tsx: Recovering wallet state for logged-in user');
      recoverWalletState();
    } else {
      console.log('⚡ App.tsx: No session or wallet data - skipping recovery for faster loading');
    }
  }, []);

  // Initialize push notifications globally and listen for incoming events to refresh unread counts
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { pushNotificationService } = await import('@/services/push-notification-service');
        await pushNotificationService.initialize();
      } catch (err) {
        console.warn('⚠️ Failed to initialize push notifications at app level', err);
      }
    })();

    const handler = (e: Event) => {
      // Invalidate notification-related queries when a notification is received
      try {
        // Narrow to CustomEvent for type-safety (at runtime it's fine)
        const ce = e as CustomEvent<any>;
        console.log('🔔 App: push:received event', ce.detail);
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        // Optionally, refresh messaging threads when type indicates a message/mention
        const t = ce?.detail?.data?.type || ce?.detail?.type;
        if (t === 'message' || t === 'mention') {
          queryClient.invalidateQueries({
            predicate: (q) => {
              const key = (q.queryKey?.[0] as string) || '';
              return typeof key === 'string' && key.includes('/api/messaging');
            }
          });
        }

        // Show a foreground toast for message/mention or generic notifications
        try {
          const raw = ce?.detail || {};
          const data = raw?.data || {};
          const type = (data?.type || raw?.type) as string | undefined;
          const actionUrl: string | undefined = data?.actionUrl || raw?.actionUrl;

          let title = raw?.title as string | undefined;
          let description = raw?.body as string | undefined;

          if (!title) {
            if (type === 'message') title = 'New message';
            else if (type === 'mention') title = 'You were mentioned';
            else title = 'New notification';
          }

          if (!description) {
            const sender = data?.sender || data?.from || data?.user;
            const preview = data?.preview || data?.text || data?.content;
            if (type === 'message' && (sender || preview)) {
              description = [sender ? `From ${sender}` : null, preview ? `“${String(preview).slice(0, 120)}”` : null]
                .filter(Boolean)
                .join(' · ');
            } else if (type === 'mention' && (sender || preview)) {
              description = [sender ? `${sender} mentioned you` : 'You were mentioned', preview ? `“${String(preview).slice(0, 120)}”` : null]
                .filter(Boolean)
                .join(' · ');
            }
          }

          // Provide sensible default navigation for known types
          const fallbackUrl = type === 'message' || type === 'mention' ? '/social/messages' : undefined;
          const openUrl = actionUrl || fallbackUrl;

          toast({
            title,
            description,
            action: openUrl ? (
              <ToastAction altText="Open"
                onClick={() => {
                  try {
                    window.location.href = openUrl;
                  } catch (err) {
                    console.warn('⚠️ Failed to navigate from toast action', err);
                  }
                }}
              >
                Open
              </ToastAction>
            ) : undefined,
          });
        } catch (toastErr) {
          console.warn('⚠️ Failed to show toast for push notification', toastErr);
        }
      } catch (err) {
        console.warn('⚠️ Failed to process push:received event', err);
      }
    };

    window.addEventListener('push:received', handler as EventListener);
    return () => {
      if (!isMounted) return;
      window.removeEventListener('push:received', handler as EventListener);
      isMounted = false;
    };
  }, [toast]);

  return (
    <ThemeProvider>
      <TooltipProvider>
        {shouldShowIndicator && (
          <PullToRefreshIndicator
            isPulling={isPulling}
            pullDistance={pullDistance}
            isRefreshing={isRefreshing}
            threshold={80}
          />
        )}
        <Toaster />
        <SessionMonitor />
        <GlobalSessionRenewalHandler />
        <Router />
        <InstallPrompt />
        <GDPRCookieConsent />
        <BottomShortcutBar />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  console.log('🎨 App.tsx: App component is rendering');
  console.log('🏗️ App.tsx: Returning JSX with all providers');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

