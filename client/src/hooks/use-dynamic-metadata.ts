import { useEffect } from "react";

export interface PageMetadata {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  keywords?: string;
  isArmyCivilization?: boolean;
  armyCrest?: string;
}

// Default gaming metadata
const DEFAULT_METADATA = {
  title: "The Trolls Inquisition | Multi-Chain Medieval Mayhem - XRPL NFT Gaming",
  description: "Enter The Trolls Inquisition Multi-Chain Medieval Mayhem! Epic XRPL NFT gaming platform featuring army battles, civilization building, land conquest, and cross-chain warfare across multiple blockchains.",
  image: "/images/trolls-inquisition-card.png",
  imageAlt: "The Trolls Inquisition - Multi-Chain Medieval Mayhem Gaming Platform",
  type: "game",
  keywords: "XRPL Gaming, NFT Gaming, Medieval Strategy, Multi-chain Gaming, Blockchain Gaming, The Inquisition, Trolls, XRPL NFTs, Gaming Platform, Strategy Game"
};

export const useDynamicMetadata = (metadata?: PageMetadata) => {
  useEffect(() => {
    // Determine which image to use
    let imageUrl = DEFAULT_METADATA.image;
    let imageAlt = DEFAULT_METADATA.imageAlt;
    
    // Exception: Army civilization profiles use army crests
    if (metadata?.isArmyCivilization && metadata?.armyCrest) {
      imageUrl = metadata.armyCrest;
      imageAlt = `${metadata.title || 'Army Civilization'} - Crest and Profile`;
    } else if (metadata?.image) {
      imageUrl = metadata.image;
      imageAlt = metadata.imageAlt || DEFAULT_METADATA.imageAlt;
    }
    
    // Merge with defaults
    const finalMetadata = {
      title: metadata?.title || DEFAULT_METADATA.title,
      description: metadata?.description || DEFAULT_METADATA.description,
      image: imageUrl,
      imageAlt: imageAlt,
      type: metadata?.type || DEFAULT_METADATA.type,
      keywords: metadata?.keywords || DEFAULT_METADATA.keywords
    };

    // Update document title
    document.title = finalMetadata.title;

    // Helper function to update or create meta tags
    const updateMetaTag = (selector: string, attribute: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        if (selector.includes('property=')) {
          element.setAttribute('property', selector.split('"')[1]);
        } else {
          element.setAttribute('name', selector.split('"')[1]);
        }
        document.head.appendChild(element);
      }
      element.setAttribute(attribute, content);
    };

    // Update standard meta tags
    updateMetaTag('meta[name="description"]', 'content', finalMetadata.description);
    updateMetaTag('meta[name="keywords"]', 'content', finalMetadata.keywords);

    // Update Open Graph tags
    updateMetaTag('meta[property="og:title"]', 'content', finalMetadata.title);
    updateMetaTag('meta[property="og:description"]', 'content', finalMetadata.description);
    updateMetaTag('meta[property="og:type"]', 'content', finalMetadata.type);
    updateMetaTag('meta[property="og:image"]', 'content', finalMetadata.image);
    updateMetaTag('meta[property="og:image:secure_url"]', 'content', finalMetadata.image);
    updateMetaTag('meta[property="og:image:alt"]', 'content', finalMetadata.imageAlt);

    // Update Twitter Card tags
    updateMetaTag('meta[name="twitter:title"]', 'content', finalMetadata.title);
    updateMetaTag('meta[name="twitter:description"]', 'content', finalMetadata.description);
    updateMetaTag('meta[name="twitter:image"]', 'content', finalMetadata.image);
    updateMetaTag('meta[name="twitter:image:src"]', 'content', finalMetadata.image);
    updateMetaTag('meta[name="twitter:image:alt"]', 'content', finalMetadata.imageAlt);

    // Update canonical URL if needed
    const currentUrl = window.location.href;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = currentUrl;

    // Add structured data for gaming platform
    const existingStructuredData = document.querySelector('#dynamic-structured-data');
    if (existingStructuredData) {
      existingStructuredData.remove();
    }

    const structuredData = {
      "@context": "https://schema.org",
      "@type": metadata?.isArmyCivilization ? "Organization" : "Game",
      "name": finalMetadata.title,
      "description": finalMetadata.description,
      "image": finalMetadata.image,
      "url": currentUrl,
      "gameLocation": "Web Browser",
      "gamePlatform": "XRPL, Ethereum, Solana, Multi-chain",
      "genre": ["Strategy", "Medieval", "NFT Gaming", "Blockchain"],
      "publisher": {
        "@type": "Organization",
        "name": "Riddle.Finance",
        "url": "https://riddle.finance"
      }
    };

    const script = document.createElement('script');
    script.id = 'dynamic-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

  }, [metadata]);

  return null; // This hook doesn't render anything
};

// Predefined metadata for common gaming pages
export const GAMING_METADATA = {
  dashboard: {
    title: "Gaming Dashboard | The Trolls Inquisition - Manage Your Medieval Empire",
    description: "Command your medieval empire in The Trolls Inquisition! Manage armies, view NFT collections, deploy forces, and conquer lands in this epic multi-chain strategy game."
  },
  
  landExplorer: {
    title: "Land Explorer | The Trolls Inquisition - Discover & Conquer Territories",
    description: "Explore the vast medieval world of The Trolls Inquisition! Discover unclaimed lands, plan conquests, and expand your empire across the blockchain realm."
  },
  
  weaponsArsenal: {
    title: "Weapons Arsenal | The Trolls Inquisition - Equip Your Army",
    description: "Arm your forces with legendary weapons in The Trolls Inquisition! Browse, upgrade, and equip powerful NFT weapons to dominate the battlefield."
  },
  
  marketplace: {
    title: "NFT Marketplace | The Trolls Inquisition - Trade Medieval Assets",
    description: "Trade powerful NFTs in The Trolls Inquisition marketplace! Buy, sell, and collect rare medieval assets, weapons, and army units."
  },
  
  armyCivilizationProfile: (armyName: string, crestImage: string) => ({
    title: `${armyName} Army Profile | The Trolls Inquisition - Civilization Details`,
    description: `Discover the ${armyName} civilization in The Trolls Inquisition! View army stats, territory control, battle history, and strategic advantages.`,
    isArmyCivilization: true,
    armyCrest: crestImage,
    type: "profile"
  })
};
