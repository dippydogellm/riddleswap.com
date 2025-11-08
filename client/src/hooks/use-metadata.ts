import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { metadataManager, type PageMetadata } from '@/lib/metadata-manager';

// Hook for managing page metadata
export const useMetadata = (metadata?: Partial<PageMetadata>) => {
  const [location] = useLocation();

  useEffect(() => {
    if (metadata) {
      metadataManager.setMetadata(metadata);
    } else {
      // Set default metadata based on route
      metadataManager.setPageMetadata(location);
    }
  }, [location, metadata]);

  return {
    setMetadata: (newMetadata: Partial<PageMetadata>) => {
      metadataManager.setMetadata(newMetadata);
    },
    getMetadata: () => metadataManager.getMetadata(),
    generateProfileMetadata: metadataManager.generateProfileMetadata.bind(metadataManager),
    generateTokenMetadata: metadataManager.generateTokenMetadata.bind(metadataManager),
    generateNFTMetadata: metadataManager.generateNFTMetadata.bind(metadataManager),
    generateWalletMetadata: metadataManager.generateWalletMetadata.bind(metadataManager)
  };
};

// Hook for profile pages
export const useProfileMetadata = (handle: string, bio?: string, profilePicture?: string) => {
  const metadata = metadataManager.generateProfileMetadata(handle, bio, profilePicture);
  return useMetadata(metadata);
};

// Hook for token pages
export const useTokenMetadata = (name: string, symbol: string, description?: string, logoUrl?: string) => {
  const metadata = metadataManager.generateTokenMetadata(name, symbol, description, logoUrl);
  return useMetadata(metadata);
};

// Hook for NFT pages
export const useNFTMetadata = (name: string, description?: string, imageUrl?: string, collectionSize?: number) => {
  const metadata = metadataManager.generateNFTMetadata(name, description, imageUrl, collectionSize);
  return useMetadata(metadata);
};

// Hook for wallet pages
export const useWalletMetadata = (chainName: string, address?: string) => {
  const metadata = metadataManager.generateWalletMetadata(chainName, address);
  return useMetadata(metadata);
};
