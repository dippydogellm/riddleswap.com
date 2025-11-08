// Riddle Bridge Page - Clean implementation using the Bridge Module
import React from 'react';
import { BridgeMain } from '@/components/bridge';

export default function RiddleBridge() {
  // Dynamic SEO for Bridge Page
  React.useEffect(() => {
    // Update page title
    document.title = "Riddle Bridge - Cross-Chain Token Bridge | XRP, BTC, ETH, SOL to RDL";
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Bridge XRP, Bitcoin, Ethereum, Solana, BNB, Base, and Polygon tokens to RDL with instant processing, 1% fees, and enterprise-grade security.');
    }
    
    // Update canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', 'https://riddle.finance/bridge');
    }
    
    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Riddle Bridge - Secure Cross-Chain Token Bridge');
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', 'Bridge tokens across 7+ blockchains to RDL with instant processing and competitive fees.');
    }
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', 'https://riddle.finance/bridge');
    }
  }, []);

  return <BridgeMain />;
}
