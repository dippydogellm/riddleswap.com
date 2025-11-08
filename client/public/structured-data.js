// Structured data for SEO - moved from inline for CSP compliance
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Riddle Bridge",
  "alternateName": "Cross-Chain Token Bridge",
  "description": "Secure cross-chain bridge for seamless token transfers between XRP, Bitcoin, Ethereum, Solana, BNB, Base, and Polygon networks to RDL tokens with instant processing and enterprise-grade security",
  "url": "https://riddle.finance/bridge",
  "applicationCategory": "FinanceApplication",
  "applicationSubCategory": "Blockchain Bridge",
  "operatingSystem": "Any",
  "browserRequirements": "Modern Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "1",
    "priceCurrency": "USD",
    "description": "1% bridge fee"
  },
  "featureList": [
    "Cross-chain token bridging",
    "Multi-wallet support (Xaman, MetaMask, WalletConnect)",
    "Real-time transaction verification",
    "Enterprise-grade security",
    "Support for 7+ blockchains",
    "Instant processing"
  ],
  "supportedBlockchains": ["XRP Ledger", "Bitcoin", "Ethereum", "Solana", "BNB Chain", "Base", "Polygon"],
  "image": "https://riddle.finance/logo.jpg",
  "screenshot": "https://riddle.finance/logo.jpg",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "850",
    "bestRating": "5",
    "worstRating": "1"
  },
  "author": {
    "@type": "Organization",
    "name": "Riddle Finance",
    "url": "https://riddle.finance"
  }
};

// Add structured data to page
const script = document.createElement('script');
script.type = 'application/ld+json';
script.textContent = JSON.stringify(structuredData);
document.head.appendChild(script);