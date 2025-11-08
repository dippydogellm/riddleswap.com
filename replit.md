# Overview
RiddleSwap is a multi-chain DeFi trading platform for cryptocurrency swaps across XRPL, EVM chains (Ethereum, BSC, Polygon, Base, Arbitrum, Optimism), and Solana. It aims to provide a unified, efficient, and secure trading experience, acting as a leading hub for decentralized finance and gaming. Key capabilities include multi-chain wallet management, an NFT marketplace with a broker system, cross-chain bridging, an NFT gaming battle system ("The Trolls Inquisition"), and an NFT-based power system with badge achievements. The platform also features project vanity URLs, custom branding, and an AI-powered game assistant. Developed as a full-stack TypeScript application with a React frontend, RiddleSwap targets a broad market with its comprehensive features and integrates a land marketplace and social media automation.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture
## Frontend
- **Frameworks**: React with TypeScript (Vite), Wouter for routing.
- **Styling**: Tailwind CSS and shadcn/ui.
- **Mobile**: Capacitor for iOS and Android deployment.
- **UI/UX**: Professional dark blue gradient aesthetic, responsive layouts, dynamic elements, clear chain indicators, and a medieval-themed gaming dashboard with day/night mode. Includes GDPR Cookie Consent and a fixed Bottom Shortcut Navigation Bar.
  - **Modal Responsiveness**: All modals/dialogs use dynamic widths - small modals (sm:max-w-xl), medium modals (sm:max-w-3xl), large modals (sm:max-w-4xl to xl:max-w-6xl) with mobile support (w-[95vw]) and proper scrolling (max-h-[90vh]).

## Backend
- **Framework**: Express.js with TypeScript.
- **Authentication**: Session-based with encrypted wallet storage, IP tracking, and user agent validation.
  - **Read-Only Auth Middleware**: Differentiated authentication system that allows GET requests (viewing) to proceed with valid session tokens even when cached private keys are missing, while requiring cached keys for POST/PUT/DELETE/PATCH operations (transactions).
  - **Session Renewal Detection**: Middleware properly identifies when session is valid but private keys are missing from cache, triggering renewal modal instead of full logout.
- **Security**: Middleware for rate limiting, validation, and CORS protection; comprehensive error logging.

## Database
- **ORM**: Drizzle ORM.
- **Database**: PostgreSQL (Neon Database).
- **Schema**: Manages wallets, transactions, NFTs, rewards, bridge operations, NFT gaming data, and NFT project launchpad information.

## Wallet Management
- **Multi-chain Support**: Supports Ethereum, XRPL, Solana, and Bitcoin, including multi-wallet options for XRPL (Riddle, Joey, Xaman).
- **Security**: Client-side encryption of private keys (AES-256-GCM), secure seed phrase management, and no private key exposure for external interactions.
- **External Wallet Integration**: Full browser extension support (MetaMask, Phantom), mobile deep links, and QR modals for XRPL wallets (Xaman, Joey).
- **XRPL Trustline & Token Handling**: Automated trustline creation, dynamic decimal precision, and intelligent token processing with automatic dust handling.

## Trading Infrastructure
- **Token System**: Hybrid data integration from 1inch, DexScreener, and CoinGecko for EVM tokens; Bithomp and DexScreener for XRPL.
- **Multi-DEX Aggregator**: Aggregates major DEXs on EVM chains and Solana.
- **Cross-chain Bridging**: Supports multi-step transactions with visual progress.
- **Exchange System**: Live price fetching, dynamic transaction routing, slippage protection, and backend-controlled swap calculations with a 0.25% platform fee.
- **Token Scanner**: Chain-specific public endpoints with caching for trending tokens, new pairs, and top market cap.

## NFT Brokered Marketplace
- **XRPL Brokered Sales**: Utilizes XRPL's XLS-20 NFTokenCreateOffer/NFTokenAcceptOffer for atomic trades with a 1% broker fee.
- **Offer System**: Supports sell offers, buy offers, and brokered acceptance with automated payment distribution.
- **Security**: Validates offers against ledger data, guards against non-XRP (IOU) offers, and uses password-protected wallet operations.
- **Minting Escrow**: Automated broker-based minting with real-time XRPL monitoring and secure private key encryption.

## NFT Project Launchpad
- **IPFS Integration**: Pinata for image and metadata uploads.
- **XRPL Minting**: Broker-wallet based NFT minting on XRPL mainnet with royalty support.
- **Project Discovery**: Auto-detection of NFT projects from XRPL issuer addresses.
- **Marketing & Promotion**: Vanity URLs with SEO, custom branding, auto-generated sitemaps, and paid advertising placements.
- **Tools**: Airdrop system for token/NFT distribution, and a snapshot tool.

## Image Management System
- **AI-Generated Images**: All DALL-E generated images are permanently stored in Replit Object Storage at /api/storage/uploads/generated-images/
- **External NFT Images**: IPFS URLs from external NFT collections automatically converted to Bithomp CDN (https://cdn.bithomp.com/ipfs/) for reliable serving
- **Image Path Normalization**: Utility functions ensure consistent image paths across the platform
- **Migration System**: Automated migration script (server/fix-image-paths-migration.ts) fixes legacy image paths and identifies expired temporary DALL-E URLs
- **Admin Tools**: Admin-only endpoints at /api/admin/image-storage for monitoring, migration, and regeneration of images

## NFT Gaming Battle System - "The Trolls Inquisition"
- **Game Mechanics**: Features 4 XRPL NFT collections for thematic power boosts, a power level system, and 14 achievement badges.
- **AI Integration**: "The Oracle AI" (powered by OpenAI) provides chat guidance, voice narration, battle commentary, and DALL-E 3 image generation.
- **Battle System**: 1v1 and group battles with three combat types, a wager system, AI opponents, and real-time narration.
- **Automated Wagering**: Utilizes a broker wallet for automatic payouts and a bank wallet for deposits, supporting XRP, RDL token, and NFT offer payments with an 80% payout formula.
- **Tournament System**: Creator-controlled tournaments with entry fees, automated prize distribution, and power-based bracket generation.
- **Matchmaking**: Power-based opponent matching within a 20% variance.
- **Leaderboards**: Player and alliance leaderboards with rank tracking and history.
- **Anti-Cheat**: Server-side deterministic hash computation and verification.
- **Public Profiles**: Public API for player profiles displaying NFT collections and AI-generated images.

## Alliance System (Multi-Member Guilds)
- **Guild Management**: Creation of alliances with customizable details and types.
- **Membership**: Supports up to 20 members with roles and permissions.
- **Treasury**: Alliance treasury for RDL tokens and XRP with member contribution tracking.
- **Recruitment**: Application-based or open recruitment with approval workflows.
- **Statistics**: Tracks total power, victories, defeats, and global ranking.

## Land Marketplace & Inventory System
- **Land Plots**: 1000 medieval fantasy land plots for purchase with unique terrain types, features, and procedurally generated traits.
- **Payment Options**: XRP or RDL token with 25% discount for RDL payments.
- **AI-Generated Images**: DALL-E 3 integration for unique land plot visualizations.
- **Land Inventory**: Comprehensive system for placing NFTs, buildings, and weapons on owned land plots with position tracking and stat bonuses.
- **Ownership Management**: Full CRUD API for land inventory with authentication and ownership validation.
- **API Endpoints**: Public land browsing, authenticated purchases, and inventory management.

## Oracle Social Media Automation
- **Integrations**: Automated posting to Twitter and Telegram.
- **Engagement Engine**: AI-powered (GPT-5) engagement engine for Twitter, monitoring keywords, sentiment analysis, smart auto-reply system with approval workflows, and automated likes/retweets.
- **Swap Activity Announcements**: Real-time XRPL monitoring for RDL token swaps, generating automatic announcements for whale trades ($10k+ USD), posting to Twitter and Telegram.
- **Dashboard**: "Oracle Terminal Dashboard" provides real-time monitoring of social media activities.

# External Dependencies
## Blockchain APIs
- Bithomp XRPL API
- DexScreener API
- Jupiter API
- Alchemy/Infura
- CoinGecko API

## AI Services
- OpenAI API

## Database Services
- Neon Database (PostgreSQL)
- Google Cloud Storage

## Authentication & Security
- Express Session
- Node.js Crypto
- Express-rate-limit

## Payment & Wallet Services
- Reown AppKit
- Xaman SDK
- ethers.js
- xrpl.js

## Development & Build Tools
- Vite
- TypeScript
- Tailwind CSS
- Capacitor
- Pinata