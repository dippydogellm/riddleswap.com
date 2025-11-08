import type { UnifiedSearchResult } from '@shared/schema';

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
  locale?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  // Token-specific fields for structured data
  tokenContract?: string;
  tokenChain?: string;
  tokenSymbol?: string;
  priceUsd?: number;
  volume24h?: number;
}

export interface PageTypeConfig {
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultImage: string;
  category: string;
}

// Page type configurations
export const PAGE_TYPES: Record<string, PageTypeConfig> = {
  // User and Profile Pages
  'user-profile': {
    label: 'User Profile',
    description: 'Riddle Wallet user profile with portfolio and activity',
    icon: '👤',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    defaultImage: '/images/social/profile-default.png',
    category: 'profile'
  },
  'wallet-profile': {
    label: 'Wallet Profile',
    description: 'Multi-chain wallet dashboard and portfolio',
    icon: '💼',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    defaultImage: '/images/social/wallet-default.png',
    category: 'profile'
  },

  // Wallet Pages
  'xrp-wallet': {
    label: 'XRP Wallet',
    description: 'XRP Ledger wallet dashboard with balance and transactions',
    icon: '⚡',
    color: 'bg-black text-white dark:bg-white dark:text-black',
    defaultImage: '/images/social/xrp-wallet.png',
    category: 'wallet'
  },
  'ethereum-wallet': {
    label: 'Ethereum Wallet',
    description: 'Ethereum wallet dashboard with DeFi and NFT features',
    icon: '💎',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    defaultImage: '/images/social/ethereum-wallet.png',
    category: 'wallet'
  },
  'solana-wallet': {
    label: 'Solana Wallet',
    description: 'Solana wallet dashboard with high-speed transactions',
    icon: '🌟',
    color: 'bg-gradient-to-r from-purple-400 to-pink-400 text-white',
    defaultImage: '/images/social/solana-wallet.png',
    category: 'wallet'
  },
  'bitcoin-wallet': {
    label: 'Bitcoin Wallet',
    description: 'Bitcoin wallet dashboard with secure transactions',
    icon: '₿',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    defaultImage: '/images/social/bitcoin-wallet.png',
    category: 'wallet'
  },

  // Project Pages
  'token-project': {
    label: 'Token Project',
    description: 'Token project with analytics and trading information',
    icon: '🪙',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    defaultImage: '/images/social/token-project.png',
    category: 'project'
  },
  'nft-collection': {
    label: 'NFT Collection',
    description: 'NFT collection with marketplace and analytics',
    icon: '🖼️',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    defaultImage: '/images/social/nft-collection.png',
    category: 'project'
  },
  'nft-project': {
    label: 'NFT Project',
    description: 'NFT project dashboard with creation and management tools',
    icon: '🎨',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    defaultImage: '/images/social/nft-project.png',
    category: 'project'
  },

  // Platform Pages
  'defi-dashboard': {
    label: 'DeFi Dashboard',
    description: 'Decentralized finance dashboard with trading tools',
    icon: '📊',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    defaultImage: '/images/social/defi-dashboard.png',
    category: 'platform'
  },
  'nft-marketplace': {
    label: 'NFT Marketplace',
    description: 'Multi-chain NFT marketplace for buying and selling',
    icon: '🛍️',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    defaultImage: '/images/social/nft-marketplace.png',
    category: 'platform'
  },
  'swap-interface': {
    label: 'Token Swap',
    description: 'Multi-chain token swap interface with best rates',
    icon: '🔄',
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    defaultImage: '/images/social/swap-interface.png',
    category: 'platform'
  },
  'bridge-interface': {
    label: 'Cross-Chain Bridge',
    description: 'Secure cross-chain asset bridge with low fees',
    icon: '🌉',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    defaultImage: '/images/social/bridge-interface.png',
    category: 'platform'
  },

  // Static Pages
  'information-page': {
    label: 'Information',
    description: 'Platform information and resources',
    icon: 'ℹ️',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    defaultImage: '/images/social/information-page.png',
    category: 'static'
  },
  'developer-tools': {
    label: 'Developer Tools',
    description: 'Blockchain development tools and resources',
    icon: '🛠️',
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
    defaultImage: '/images/social/developer-tools.png',
    category: 'platform'
  }
};

// Default metadata for the platform
export const DEFAULT_METADATA: PageMetadata = {
  title: 'RiddleSwap | Multi-Chain DeFi Platform',
  description: 'Trade, swap, and manage crypto assets across multiple blockchains including XRP, Ethereum, Solana, Bitcoin, and more with RiddleSwap\'s comprehensive DeFi platform.',
  keywords: ['DeFi', 'Multi-chain', 'Crypto', 'Trading', 'NFT', 'Swap', 'XRP', 'Ethereum', 'Solana', 'Bitcoin'],
  image: '/images/social/riddleswap-default.png',
  siteName: 'RiddleSwap',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
  type: 'website'
};

// Static page metadata configurations
export const STATIC_PAGE_METADATA: Record<string, PageMetadata> = {
  // Home and Main Pages
  '/': {
    title: 'RiddleSwap | Multi-Chain DeFi Platform - XRP, ETH, SOL, BTC Trading',
    description: 'The ultimate multi-chain DeFi platform. Trade, swap, and manage crypto assets across XRP, Ethereum, Solana, Bitcoin, and 19+ blockchains with advanced analytics and secure wallets.',
    keywords: ['DeFi', 'Multi-chain', 'Crypto Trading', 'NFT Marketplace', 'Cross-chain Swap', 'Blockchain', 'XRP', 'Ethereum', 'Solana', 'Bitcoin'],
    image: '/images/social/riddleswap-home.png',
    type: 'website'
  },

  // Wallet Pages
  '/wallet-dashboard': {
    title: 'Wallet Dashboard | Multi-Chain Portfolio Management',
    description: 'Comprehensive multi-chain wallet dashboard. Manage XRP, Ethereum, Solana, Bitcoin, and 19+ blockchain assets in one secure interface with advanced portfolio analytics.',
    keywords: ['Multi-chain Wallet', 'Portfolio Dashboard', 'Crypto Wallet', 'Asset Management', 'Blockchain Portfolio'],
    image: '/images/social/wallet-dashboard.png',
    type: 'website'
  },
  '/eth-wallet': {
    title: 'Ethereum Wallet | DeFi & NFT Portfolio Dashboard',
    description: 'Advanced Ethereum wallet with DeFi integration, NFT management, and ERC-20 token support. Trade, stake, and manage your ETH assets with comprehensive analytics.',
    keywords: ['Ethereum Wallet', 'ETH Portfolio', 'DeFi Wallet', 'NFT Management', 'ERC-20 Tokens'],
    image: '/images/social/ethereum-wallet.png',
    type: 'website'
  },
  '/xrp-wallet': {
    title: 'XRP Wallet | XRPL Portfolio & Token Management',
    description: 'Professional XRP Ledger wallet with trustline management, token trading, and comprehensive portfolio analytics. Secure XRPL asset management made simple.',
    keywords: ['XRP Wallet', 'XRPL Portfolio', 'Trustline Management', 'XRP Tokens', 'Ripple Wallet'],
    image: '/images/social/xrp-wallet.png',
    type: 'website'
  },
  '/sol-wallet': {
    title: 'Solana Wallet | High-Speed Trading & DeFi Dashboard',
    description: 'Lightning-fast Solana wallet with Jupiter DEX integration, SPL token management, and advanced trading tools. Experience the speed of Solana DeFi.',
    keywords: ['Solana Wallet', 'SOL Portfolio', 'SPL Tokens', 'Jupiter DEX', 'Solana DeFi'],
    image: '/images/social/solana-wallet.png',
    type: 'website'
  },
  '/btc-wallet': {
    title: 'Bitcoin Wallet | Secure BTC Portfolio Management',
    description: 'Professional Bitcoin wallet with advanced security features, transaction history, and portfolio analytics. Secure, simple, and powerful BTC management.',
    keywords: ['Bitcoin Wallet', 'BTC Portfolio', 'Bitcoin Management', 'Crypto Security', 'BTC Trading'],
    image: '/images/social/bitcoin-wallet.png',
    type: 'website'
  },
  '/bnb-wallet': {
    title: 'BNB Smart Chain Wallet | BSC DeFi Portfolio',
    description: 'BNB Smart Chain wallet with PancakeSwap integration, BEP-20 token support, and DeFi farming opportunities. Maximize your BSC yields.',
    keywords: ['BNB Wallet', 'BSC Portfolio', 'PancakeSwap', 'BEP-20 Tokens', 'BSC DeFi'],
    image: '/images/social/bnb-wallet.png',
    type: 'website'
  },
  '/polygon-wallet': {
    title: 'Polygon Wallet | Low-Fee DeFi & NFT Portfolio',
    description: 'Polygon wallet with QuickSwap integration, low-fee transactions, and comprehensive DeFi tools. Experience fast, affordable Ethereum scaling.',
    keywords: ['Polygon Wallet', 'MATIC Portfolio', 'QuickSwap', 'Low-Fee DeFi', 'Polygon DeFi'],
    image: '/images/social/polygon-wallet.png',
    type: 'website'
  },
  '/arbitrum-wallet': {
    title: 'Arbitrum Wallet | Layer 2 Ethereum DeFi Portfolio',
    description: 'Arbitrum One wallet with Camelot DEX integration, Layer 2 scaling benefits, and advanced DeFi features. Ethereum DeFi without the high fees.',
    keywords: ['Arbitrum Wallet', 'Layer 2 Ethereum', 'Camelot DEX', 'Arbitrum DeFi', 'ETH Scaling'],
    image: '/images/social/arbitrum-wallet.png',
    type: 'website'
  },
  '/optimism-wallet': {
    title: 'Optimism Wallet | Ethereum Layer 2 Portfolio Dashboard',
    description: 'Optimism wallet with Velodrome integration, instant transactions, and comprehensive Layer 2 DeFi access. Scale your Ethereum experience.',
    keywords: ['Optimism Wallet', 'OP Portfolio', 'Velodrome', 'Layer 2 DeFi', 'Ethereum Scaling'],
    image: '/images/social/optimism-wallet.png',
    type: 'website'
  },
  '/base-wallet': {
    title: 'Base Wallet | Coinbase Layer 2 Portfolio Management',
    description: 'Base network wallet with native Coinbase integration, low fees, and emerging DeFi ecosystem access. Built on Ethereum, backed by Coinbase.',
    keywords: ['Base Wallet', 'Coinbase Layer 2', 'Base Network', 'Base DeFi', 'ETH L2'],
    image: '/images/social/base-wallet.png',
    type: 'website'
  },
  '/avax-wallet': {
    title: 'Avalanche Wallet | High-Performance DeFi Portfolio',
    description: 'Avalanche wallet with Trader Joe integration, sub-second finality, and comprehensive C-Chain DeFi access. Experience lightning-fast transactions.',
    keywords: ['Avalanche Wallet', 'AVAX Portfolio', 'Trader Joe', 'Avalanche DeFi', 'C-Chain'],
    image: '/images/social/avalanche-wallet.png',
    type: 'website'
  },

  // Trading & Swap Pages
  '/swap': {
    title: 'Multi-Chain Token Swap | Best Rates Across 19+ Blockchains',
    description: 'Swap tokens across 19+ blockchains with the best rates. Compare prices from multiple DEXs including Uniswap, PancakeSwap, Jupiter, and more.',
    keywords: ['Token Swap', 'Multi-chain Swap', 'DEX Aggregator', 'Best Rates', 'Cross-chain Trading'],
    image: '/images/social/token-swap.png',
    type: 'website'
  },
  '/xrpl-swap': {
    title: 'XRPL Token Swap | Native XRP Ledger Trading',
    description: 'Trade XRPL tokens with native XRP Ledger integration. Access deep liquidity, automatic trustlines, and professional trading tools.',
    keywords: ['XRPL Swap', 'XRP Trading', 'XRPL Tokens', 'XRP Ledger', 'Ripple Trading'],
    image: '/images/social/xrpl-swap.png',
    type: 'website'
  },
  '/solana-swap': {
    title: 'Solana Token Swap | Jupiter DEX Integration',
    description: 'Lightning-fast Solana token swaps powered by Jupiter aggregator. Access the best prices across all Solana DEXs with minimal slippage.',
    keywords: ['Solana Swap', 'Jupiter DEX', 'SPL Tokens', 'Solana Trading', 'Fast Swaps'],
    image: '/images/social/solana-swap.png',
    type: 'website'
  },
  '/portfolio': {
    title: 'Portfolio Analytics | Multi-Chain Asset Tracking',
    description: 'Comprehensive portfolio analytics across 19+ blockchains. Track performance, analyze holdings, and optimize your crypto investments.',
    keywords: ['Portfolio Analytics', 'Crypto Portfolio', 'Multi-chain Tracking', 'Asset Analysis', 'Investment Dashboard'],
    image: '/images/social/portfolio-analytics.png',
    type: 'website'
  },

  // Bridge Pages
  '/bridge': {
    title: 'Cross-Chain Bridge | Secure Asset Transfers Across 19+ Chains',
    description: 'Secure cross-chain bridge for seamless asset transfers. Bridge tokens between XRP, Ethereum, Solana, Bitcoin, and 15+ other blockchains.',
    keywords: ['Cross-chain Bridge', 'Multi-chain Bridge', 'Asset Transfer', 'Blockchain Bridge', 'Interoperability'],
    image: '/images/social/bridge-interface.png',
    type: 'website'
  },
  '/riddle-bridge': {
    title: 'Riddle Bridge | Premium Cross-Chain Asset Bridge',
    description: 'Professional cross-chain bridge with enterprise-grade security, competitive fees, and support for major blockchains. Bridge assets with confidence.',
    keywords: ['Riddle Bridge', 'Cross-chain', 'Asset Bridge', 'Multi-blockchain', 'Secure Transfer'],
    image: '/images/social/riddle-bridge.png',
    type: 'website'
  },
  '/wallet-bridge': {
    title: 'Wallet Bridge Manager | Seamless Cross-Chain Transfers',
    description: 'Integrated wallet bridge manager for seamless cross-chain transfers. Bridge assets directly from your wallet with advanced security features.',
    keywords: ['Wallet Bridge', 'Cross-chain Wallet', 'Asset Transfer', 'Multi-chain Management', 'Bridge Manager'],
    image: '/images/social/wallet-bridge.png',
    type: 'website'
  },

  // NFT Pages
  '/nft-marketplace': {
    title: 'NFT Marketplace | Multi-Chain Digital Collectibles',
    description: 'Comprehensive NFT marketplace across XRP Ledger, Ethereum, and Solana. Discover, trade, and collect unique digital assets with advanced analytics.',
    keywords: ['NFT Marketplace', 'Multi-chain NFTs', 'Digital Collectibles', 'NFT Trading', 'XRPL NFTs'],
    image: '/images/social/nft-marketplace.png',
    type: 'website'
  },
  '/nft-collections': {
    title: 'NFT Collections | Discover Premium Digital Art & Collectibles',
    description: 'Explore curated NFT collections across multiple blockchains. Discover trending collections, analyze floor prices, and find rare digital assets.',
    keywords: ['NFT Collections', 'Digital Art', 'NFT Discovery', 'Collection Analytics', 'Rare NFTs'],
    image: '/images/social/nft-collections.png',
    type: 'website'
  },
  '/nft-gateway': {
    title: 'NFT Gateway | Multi-Chain NFT Access Portal',
    description: 'Your gateway to the world of NFTs across all major blockchains. Create, trade, and manage NFTs with comprehensive tools and analytics.',
    keywords: ['NFT Gateway', 'NFT Portal', 'Multi-chain NFTs', 'NFT Tools', 'Digital Assets'],
    image: '/images/social/nft-gateway.png',
    type: 'website'
  },

  // DeFi & Financial Pages
  '/staking': {
    title: 'Multi-Chain Staking | Earn Rewards Across 19+ Blockchains',
    description: 'Stake your crypto assets across multiple blockchains and earn rewards. Access the best staking opportunities with comprehensive yield analytics.',
    keywords: ['Crypto Staking', 'Multi-chain Staking', 'Staking Rewards', 'Yield Farming', 'Passive Income'],
    image: '/images/social/staking-platform.png',
    type: 'website'
  },
  '/loans': {
    title: 'DeFi Lending | Crypto Loans & Borrowing Platform',
    description: 'Decentralized lending and borrowing across multiple blockchains. Access liquidity, earn interest, and optimize your DeFi strategies.',
    keywords: ['DeFi Lending', 'Crypto Loans', 'Borrowing Platform', 'DeFi Yield', 'Lending Protocol'],
    image: '/images/social/defi-lending.png',
    type: 'website'
  },
  '/liquidity': {
    title: 'Liquidity Pools | Multi-Chain DeFi Yield Opportunities',
    description: 'Provide liquidity across multiple DEXs and earn fees. Access the best liquidity mining opportunities with advanced analytics and risk management.',
    keywords: ['Liquidity Pools', 'Yield Farming', 'DeFi Yields', 'Liquidity Mining', 'LP Tokens'],
    image: '/images/social/liquidity-pools.png',
    type: 'website'
  },

  // Developer Tools
  '/devtools': {
    title: 'DevTools | Multi-Chain Blockchain Development Platform',
    description: 'Comprehensive blockchain development tools for creating tokens, NFTs, and DApps. Deploy across 19+ chains with professional-grade analytics.',
    keywords: ['Blockchain Development', 'Token Creation', 'NFT Tools', 'DApp Development', 'Multi-chain Deploy'],
    image: '/images/social/devtools-platform.png',
    type: 'website'
  },
  '/launchpad': {
    title: 'Token Launchpad | Multi-Chain Project Launch Platform',
    description: 'Launch your blockchain project across multiple networks. Create tokens, raise funds, and build communities with comprehensive launchpad tools.',
    keywords: ['Token Launchpad', 'Project Launch', 'Token Creation', 'Fundraising', 'Multi-chain Launch'],
    image: '/images/social/token-launchpad.png',
    type: 'website'
  },
  '/riddlepad': {
    title: 'RiddlePad | Premium Token Launch & Investment Platform',
    description: 'Premium token launchpad with curated projects, advanced analytics, and institutional-grade features. Invest in the future of DeFi.',
    keywords: ['RiddlePad', 'Premium Launchpad', 'Token Investment', 'Project Curation', 'DeFi Investment'],
    image: '/images/social/riddlepad-platform.png',
    type: 'website'
  },

  // Trading Tools
  '/traders/wallet-search': {
    title: 'Wallet Search | Multi-Chain Address Analytics',
    description: 'Comprehensive wallet search and analytics across 19+ blockchains. Analyze addresses, track transactions, and discover trading patterns.',
    keywords: ['Wallet Search', 'Address Analytics', 'Blockchain Explorer', 'Transaction Analysis', 'Wallet Tracker'],
    image: '/images/social/wallet-search.png',
    type: 'website'
  },
  '/traders/token-safety': {
    title: 'Token Safety Checker | Smart Contract Security Analysis',
    description: 'Advanced token safety analysis with smart contract auditing, liquidity checks, and risk assessment. Trade safely with comprehensive security tools.',
    keywords: ['Token Safety', 'Smart Contract Audit', 'Security Analysis', 'Risk Assessment', 'Safe Trading'],
    image: '/images/social/token-safety.png',
    type: 'website'
  },
  '/traders/trading-desk': {
    title: 'Professional Trading Desk | Advanced Multi-Chain Trading',
    description: 'Professional trading interface with advanced charting, order management, and multi-chain execution. Trade like a pro with institutional-grade tools.',
    keywords: ['Trading Desk', 'Professional Trading', 'Advanced Charts', 'Order Management', 'Institutional Trading'],
    image: '/images/social/trading-desk.png',
    type: 'website'
  },
  '/traders/copy-trading': {
    title: 'Copy Trading | Follow Successful Crypto Traders',
    description: 'Automated copy trading platform with verified traders, performance analytics, and risk management. Follow the best and earn consistently.',
    keywords: ['Copy Trading', 'Social Trading', 'Automated Trading', 'Trading Signals', 'Performance Analytics'],
    image: '/images/social/copy-trading.png',
    type: 'website'
  },

  // Social & Community
  '/newsfeed': {
    title: 'Crypto Newsfeed | Market Updates & Community Insights',
    description: 'Real-time crypto news, market updates, and community insights. Stay informed with the latest DeFi trends and market analysis.',
    keywords: ['Crypto News', 'Market Updates', 'DeFi Community', 'Blockchain News', 'Market Analysis'],
    image: '/images/social/crypto-newsfeed.png',
    type: 'website'
  },
  '/messaging': {
    title: 'Crypto Messaging | Secure Trading Communication',
    description: 'Secure messaging platform for crypto traders and DeFi enthusiasts. Connect with the community and share insights safely.',
    keywords: ['Crypto Messaging', 'Trading Chat', 'Secure Communication', 'Crypto Community', 'DeFi Chat'],
    image: '/images/social/crypto-messaging.png',
    type: 'website'
  },

  // Account & Settings
  '/settings': {
    title: 'Platform Settings | Customize Your DeFi Experience',
    description: 'Customize your RiddleSwap experience with advanced settings for trading, security, notifications, and multi-chain wallet management.',
    keywords: ['Platform Settings', 'User Preferences', 'Security Configuration', 'Wallet Settings', 'Trading Settings'],
    image: '/images/social/platform-settings.png',
    type: 'website'
  },
  '/create-wallet': {
    title: 'Create Wallet | Secure Multi-Chain Wallet Setup',
    description: 'Create a secure multi-chain wallet with support for 19+ blockchains. Professional-grade security with user-friendly interface.',
    keywords: ['Create Wallet', 'Multi-chain Wallet', 'Secure Wallet', 'Wallet Setup', 'Crypto Security'],
    image: '/images/social/create-wallet.png',
    type: 'website'
  },
  '/wallet-login': {
    title: 'Wallet Login | Secure Access to Your Crypto Assets',
    description: 'Secure login to your multi-chain wallet. Access your crypto assets across 19+ blockchains with enterprise-grade security.',
    keywords: ['Wallet Login', 'Secure Access', 'Multi-chain Login', 'Wallet Security', 'Crypto Access'],
    image: '/images/social/wallet-login.png',
    type: 'website'
  },

  // Information Pages
  '/our-story': {
    title: 'Our Story | RiddleSwap Multi-Chain DeFi Innovation',
    description: 'Learn about RiddleSwap\'s mission to democratize DeFi across all blockchains. Discover our journey, technology, and vision for decentralized finance.',
    keywords: ['About RiddleSwap', 'DeFi Innovation', 'Blockchain Technology', 'Multi-chain', 'Company Story'],
    image: '/images/social/our-story.png',
    type: 'website'
  },
  '/team': {
    title: 'Our Team | Meet the RiddleSwap Development Team',
    description: 'Meet the expert team behind RiddleSwap. Blockchain developers, DeFi specialists, and crypto enthusiasts building the future of finance.',
    keywords: ['RiddleSwap Team', 'Blockchain Developers', 'DeFi Experts', 'Crypto Team', 'Development Team'],
    image: '/images/social/team.png',
    type: 'website'
  },
  '/contact': {
    title: 'Contact Us | Get Support for Multi-Chain DeFi',
    description: 'Get support for RiddleSwap platform. Contact our team for technical assistance, partnerships, or general inquiries about multi-chain DeFi.',
    keywords: ['Contact Support', 'Technical Support', 'Customer Service', 'DeFi Support', 'Platform Help'],
    image: '/images/social/contact-support.png',
    type: 'website'
  },
  '/privacy': {
    title: 'Privacy Policy | Data Protection & Security Standards',
    description: 'RiddleSwap privacy policy and data protection standards. Learn how we protect your data while providing multi-chain DeFi services.',
    keywords: ['Privacy Policy', 'Data Protection', 'Security Standards', 'GDPR Compliance', 'User Privacy'],
    image: '/images/social/privacy-policy.png',
    type: 'website'
  },
  '/terms': {
    title: 'Terms of Service | RiddleSwap Platform Agreement',
    description: 'RiddleSwap terms of service and platform agreement. Understand your rights and responsibilities when using our multi-chain DeFi platform.',
    keywords: ['Terms of Service', 'Platform Agreement', 'User Terms', 'DeFi Terms', 'Service Agreement'],
    image: '/images/social/terms-service.png',
    type: 'website'
  }
};

// Metadata manager class
export class MetadataManager {
  private static instance: MetadataManager;
  private currentMetadata: PageMetadata = DEFAULT_METADATA;

  static getInstance(): MetadataManager {
    if (!MetadataManager.instance) {
      MetadataManager.instance = new MetadataManager();
    }
    return MetadataManager.instance;
  }

  // Set metadata for the current page
  setMetadata(metadata: Partial<PageMetadata>): void {
    this.currentMetadata = {
      ...DEFAULT_METADATA,
      ...metadata
    };
    this.updateDOM();
  }

  // Get current metadata
  getMetadata(): PageMetadata {
    return this.currentMetadata;
  }

  // Generate metadata for user profiles
  generateProfileMetadata(handle: string, bio?: string, profilePicture?: string): PageMetadata {
    return {
      title: `${handle} | RiddleSwap User Profile`,
      description: bio || `View ${handle}'s crypto portfolio, transactions, and activity on RiddleSwap's multi-chain platform.`,
      keywords: ['User Profile', handle, 'Crypto Portfolio', 'DeFi User', 'Multi-chain Wallet'],
      image: profilePicture || PAGE_TYPES['user-profile'].defaultImage,
      url: `${window.location.origin}/profile/${handle}`,
      type: 'profile',
      author: handle
    };
  }

  // Generate metadata for token projects
  generateTokenMetadata(
    name: string, 
    symbol: string, 
    description?: string, 
    logoUrl?: string,
    contractAddress?: string,
    chainName?: string,
    priceUsd?: number,
    volume24h?: number
  ): PageMetadata {
    return {
      title: `${name} (${symbol}) | Token Analytics & Trading`,
      description: description || `Trade ${name} (${symbol}) with advanced analytics, real-time price data, and multi-chain support on RiddleSwap.`,
      keywords: ['Token', symbol, name, 'Crypto Trading', 'Token Analytics', 'DeFi'],
      image: logoUrl || PAGE_TYPES['token-project'].defaultImage,
      type: 'website',
      section: 'Cryptocurrency',
      url: window.location.href,
      // Store explicit token fields for structured data generation
      tokenContract: contractAddress,
      tokenChain: chainName,
      tokenSymbol: symbol,
      priceUsd: priceUsd,
      volume24h: volume24h,
      // Tags for social sharing (don't include contract address to avoid confusion)
      tags: [symbol, chainName || 'blockchain', 'cryptocurrency', 'trading'],
      publishedTime: new Date().toISOString(),
      author: chainName || 'Blockchain Network'
    };
  }

  // Generate metadata for NFT collections
  generateNFTMetadata(name: string, description?: string, imageUrl?: string, collectionSize?: number): PageMetadata {
    return {
      title: `${name} | NFT Collection on RiddleSwap`,
      description: description || `Explore ${name} NFT collection with ${collectionSize || 'unique'} items. Trade, analyze, and discover rare NFTs on the multi-chain marketplace.`,
      keywords: ['NFT Collection', name, 'NFT Marketplace', 'Digital Art', 'Collectibles'],
      image: imageUrl || PAGE_TYPES['nft-collection'].defaultImage,
      type: 'website',
      section: 'NFT'
    };
  }

  // Generate metadata for wallet pages
  generateWalletMetadata(chainName: string, address?: string): PageMetadata {
    const pageType = `${chainName.toLowerCase()}-wallet` as keyof typeof PAGE_TYPES;
    const config = PAGE_TYPES[pageType] || PAGE_TYPES['wallet-profile'];
    
    return {
      title: `${config.label} | ${address ? 'Portfolio Dashboard' : 'Wallet Dashboard'}`,
      description: `Manage your ${chainName} assets with advanced portfolio tracking, transaction history, and DeFi features on RiddleSwap.`,
      keywords: [chainName, 'Wallet', 'Portfolio', 'Crypto Dashboard', address ? 'Address Analytics' : 'Asset Management'],
      image: config.defaultImage,
      type: 'website',
      section: 'Wallet'
    };
  }

  // Generate metadata for dynamic pages based on search results
  generateDynamicMetadata(result: UnifiedSearchResult): PageMetadata {
    switch (result.type) {
      case 'profile':
        return this.generateProfileMetadata(
          result.title,
          result.description,
          result.image
        );
      case 'project':
        if (result.metadata?.asset_type === 'nft') {
          return this.generateNFTMetadata(result.title, result.description, result.image);
        } else {
          return this.generateTokenMetadata(
            result.title,
            result.metadata?.symbol || 'TOKEN',
            result.description,
            result.image
          );
        }
      case 'page':
        return {
          title: result.title,
          description: result.description || '',
          image: result.image || DEFAULT_METADATA.image,
          type: 'website'
        };
      default:
        return DEFAULT_METADATA;
    }
  }

  // Update DOM with current metadata
  private updateDOM(): void {
    this.updateTitle();
    this.updateMetaTags();
    this.updateCanonical();
    this.updateOpenGraph();
    this.updateTwitterCard();
    this.updateStructuredData();
  }

  private updateCanonical(): void {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    
    // Use metadata URL if provided, otherwise current page URL
    canonical.href = this.currentMetadata.url || window.location.href;
  }

  private updateTitle(): void {
    document.title = this.currentMetadata.title;
  }

  private updateMetaTags(): void {
    this.updateOrCreateMeta('description', this.currentMetadata.description);
    if (this.currentMetadata.keywords) {
      this.updateOrCreateMeta('keywords', this.currentMetadata.keywords.join(', '));
    }
    if (this.currentMetadata.author) {
      this.updateOrCreateMeta('author', this.currentMetadata.author);
    }
  }

  private updateOpenGraph(): void {
    this.updateOrCreateMeta('og:title', this.currentMetadata.title, 'property');
    this.updateOrCreateMeta('og:description', this.currentMetadata.description, 'property');
    this.updateOrCreateMeta('og:type', this.currentMetadata.type || 'website', 'property');
    if (this.currentMetadata.image) {
      this.updateOrCreateMeta('og:image', this.currentMetadata.image, 'property');
      this.updateOrCreateMeta('og:image:alt', this.currentMetadata.title, 'property');
      this.updateOrCreateMeta('og:image:width', '1200', 'property');
      this.updateOrCreateMeta('og:image:height', '630', 'property');
    }
    // Always set og:url to current page URL (canonical)
    const canonicalUrl = this.currentMetadata.url || window.location.href;
    this.updateOrCreateMeta('og:url', canonicalUrl, 'property');
    this.updateOrCreateMeta('og:site_name', this.currentMetadata.siteName || 'RiddleSwap', 'property');
    this.updateOrCreateMeta('og:locale', this.currentMetadata.locale || 'en_US', 'property');
    
    // Add tags for better social sharing (only for website type, not article)
    if (this.currentMetadata.tags && this.currentMetadata.tags.length > 0 && this.currentMetadata.type === 'website') {
      // Remove existing tag metas
      const existingTags = document.querySelectorAll('meta[property="og:tag"]');
      existingTags.forEach(tag => tag.remove());
      
      // Add individual tag entries for websites
      this.currentMetadata.tags.forEach(tag => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:tag');
        meta.setAttribute('content', tag);
        document.head.appendChild(meta);
      });
    }
  }

  private updateTwitterCard(): void {
    this.updateOrCreateMeta('twitter:card', this.currentMetadata.twitterCard || 'summary_large_image');
    this.updateOrCreateMeta('twitter:title', this.currentMetadata.title);
    this.updateOrCreateMeta('twitter:description', this.currentMetadata.description);
    // Always set twitter:url to canonical URL
    const canonicalUrl = this.currentMetadata.url || window.location.href;
    this.updateOrCreateMeta('twitter:url', canonicalUrl);
    if (this.currentMetadata.image) {
      this.updateOrCreateMeta('twitter:image', this.currentMetadata.image);
      this.updateOrCreateMeta('twitter:image:alt', this.currentMetadata.title);
    }
  }

  private updateOrCreateMeta(name: string, content: string, attribute: 'name' | 'property' = 'name'): void {
    let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
    
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, name);
      document.head.appendChild(element);
    }
    
    element.setAttribute('content', content);
  }

  // Get page type configuration
  getPageTypeConfig(type: string): PageTypeConfig | undefined {
    return PAGE_TYPES[type];
  }

  // Set page metadata based on route and data
  setPageMetadata(route: string, data?: any): void {
    // Check for static page metadata first
    if (STATIC_PAGE_METADATA[route]) {
      this.setMetadata(STATIC_PAGE_METADATA[route]);
      return;
    }

    // Generate dynamic metadata based on route pattern and data
    if (route.startsWith('/profile/') && data?.handle) {
      this.setMetadata(this.generateProfileMetadata(data.handle, data.bio, data.profilePicture));
    } else if (route.includes('/wallet/') && data?.chainName) {
      this.setMetadata(this.generateWalletMetadata(data.chainName, data.address));
    } else if ((route.includes('/token/') || route.includes('/project/')) && data?.name) {
      this.setMetadata(this.generateTokenMetadata(data.name, data.symbol, data.description, data.logoUrl));
    } else if (route.includes('/nft/') && data?.name) {
      this.setMetadata(this.generateNFTMetadata(data.name, data.description, data.imageUrl, data.collectionSize));
    } else {
      // Fallback to default metadata
      this.setMetadata(DEFAULT_METADATA);
    }
  }

  // Update structured data (JSON-LD)
  private updateStructuredData(): void {
    // Remove existing structured data
    const existingJsonLd = document.querySelector('script[type="application/ld+json"]');
    if (existingJsonLd) {
      existingJsonLd.remove();
    }

    // Generate structured data based on page type
    let structuredData: any = null;
    
    if (this.currentMetadata.section === 'Cryptocurrency') {
      // Generate token/cryptocurrency structured data using explicit token data fields
      const tokenName = this.currentMetadata.title.split(' | ')[0];
      const tokenSymbol = this.currentMetadata.tokenSymbol || 'TOKEN';
      const chainName = this.currentMetadata.tokenChain || 'Blockchain Network';
      const contractAddress = this.currentMetadata.tokenContract;
      const priceUsd = this.currentMetadata.priceUsd;
      
      const additionalProperties = [
        {
          "@type": "PropertyValue",
          "name": "Symbol",
          "value": tokenSymbol
        },
        {
          "@type": "PropertyValue", 
          "name": "Blockchain",
          "value": chainName
        }
      ];

      // Add full contract address if available
      if (contractAddress && contractAddress.length > 10) {
        additionalProperties.push({
          "@type": "PropertyValue",
          "name": "Contract Address",
          "value": contractAddress
        });
      }

      // Add volume if available
      if (this.currentMetadata.volume24h) {
        additionalProperties.push({
          "@type": "PropertyValue",
          "name": "24h Trading Volume",
          "value": `$${this.currentMetadata.volume24h.toLocaleString()}`
        });
      }
      
      structuredData = {
        "@context": "https://schema.org",
        "@type": ["Product", "FinancialProduct"],
        "name": tokenName,
        "alternateName": tokenSymbol,
        "description": this.currentMetadata.description,
        "image": this.currentMetadata.image,
        "url": this.currentMetadata.url || window.location.href,
        "category": "Cryptocurrency",
        "additionalType": "https://schema.org/FinancialProduct",
        "identifier": contractAddress || tokenSymbol,
        "sku": tokenSymbol,
        "brand": {
          "@type": "Brand",
          "name": "RiddleSwap",
          "url": "https://riddleswap.com"
        },
        "manufacturer": {
          "@type": "Organization",
          "name": chainName
        },
        "additionalProperty": additionalProperties,
        "offers": {
          "@type": "Offer",
          "price": priceUsd ? priceUsd.toString() : "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "Organization",
            "name": "RiddleSwap",
            "url": "https://riddleswap.com"
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "reviewCount": "1000",
          "bestRating": "5",
          "worstRating": "1"
        }
      };
    } else if (this.currentMetadata.section === 'NFT') {
      // Generate NFT structured data
      structuredData = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": this.currentMetadata.title.split(' | ')[0],
        "description": this.currentMetadata.description,
        "image": this.currentMetadata.image,
        "url": window.location.href,
        "category": "Digital Art",
        "creator": {
          "@type": "Organization",
          "name": "RiddleSwap"
        }
      };
    } else if (this.currentMetadata.type === 'profile') {
      // Generate profile structured data
      structuredData = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": this.currentMetadata.author || this.currentMetadata.title.split(' | ')[0],
        "description": this.currentMetadata.description,
        "image": this.currentMetadata.image,
        "url": window.location.href,
        "sameAs": [window.location.href]
      };
    } else {
      // Default website structured data
      structuredData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": this.currentMetadata.title,
        "description": this.currentMetadata.description,
        "image": this.currentMetadata.image,
        "url": window.location.href,
        "mainEntity": {
          "@type": "Organization",
          "name": "RiddleSwap",
          "url": "https://riddleswap.com",
          "description": "Multi-chain DeFi trading platform"
        }
      };
    }

    // Add structured data to DOM
    if (structuredData) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }
}

// Singleton instance
export const metadataManager = MetadataManager.getInstance();
