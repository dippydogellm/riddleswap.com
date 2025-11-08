import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface TokenLogoProps {
  symbol: string;
  issuer?: string;
  address?: string; // For Solana tokens
  logoURI?: string; // Direct logo URL (for Solana)
  chain?: 'xrpl' | 'solana' | 'evm' | 'ethereum'; // Chain type
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function TokenLogo({ symbol, issuer, address, logoURI, chain = 'xrpl', size = 'sm', className }: TokenLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const sizeClasses = {
    xs: 'w-5 h-5',      // 20px - for small inline icons
    sm: 'w-6 h-6',      // 24px - for swap token selectors
    md: 'w-8 h-8',      // 32px - for swap interface
    lg: 'w-10 h-10',    // 40px - for token cards
    xl: 'w-12 h-12',    // 48px - for larger displays
    '2xl': 'w-16 h-16'  // 64px - for hero sections
  };

  useEffect(() => {
    const fetchTokenLogo = async () => {
      setIsLoading(true);
      setError(false);
      
      try {
        let normalizedSymbol = symbol.toUpperCase();
        
        // Handle hex currency codes (convert to ASCII if possible)
        if (symbol.length === 40 && /^[0-9A-F]+$/i.test(symbol)) {
          try {
            const ascii = Buffer.from(symbol, 'hex').toString('ascii').replace(/\0/g, '');
            if (ascii && ascii.length > 0) {
              normalizedSymbol = ascii.toUpperCase();
            }
          } catch (e) {
            // Continue with original symbol
          }
        }

        // Only XRP gets a hardcoded logo - all other tokens must use authentic APIs only
        // Always show XRP logo regardless of issuer (even if placeholder/empty string is provided)
        if (normalizedSymbol === 'XRP') {
          setLogoUrl('/images/chains/xrp-logo.png');
          setIsLoading(false);
          return;
        }

        // Handle direct logoURI from backend (includes Bithomp icons)
        if (logoURI) {
          setLogoUrl(logoURI);
          setIsLoading(false);
          return;
        }

        // Handle Solana tokens
        if (chain === 'solana' && address) {
          const solanaLogos = [
            `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.png`,
            `https://img.fotofolio.xyz/?url=https%3A%2F%2Farweave.net%2F${address}`,
            `https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet/${address}/logo.png`
          ];
          
          // Try the first logo
          setLogoUrl(solanaLogos[0]);
          setIsLoading(false);
          return;
        }

        // Handle EVM/Ethereum tokens
        if (chain === 'evm' || chain === 'ethereum') {
          // Handle ETH token with local ethereum logo
          if (normalizedSymbol === 'ETH') {
            setLogoUrl('/images/chains/ethereum-logo.png');
            setIsLoading(false);
            return;
          }
          
          // Handle other ERC-20 tokens with contract address
          if (address && address.length === 42 && address.startsWith('0x')) {
            const trustWalletUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
            
            try {
              // Test if the TrustWallet logo exists
              const response = await fetch(trustWalletUrl, { method: 'HEAD' });
              if (response.ok) {
                setLogoUrl(trustWalletUrl);
                setIsLoading(false);
                return;
              }
            } catch (e) {
              console.log(`❌ TokenLogo: TrustWallet logo not found for ${address}`);
            }
          }
          
          console.log(`❌ TokenLogo: No EVM logo found for ${normalizedSymbol}`);
          setError(true);
          setLogoUrl(null);
          setIsLoading(false);
          return;
        }

        // No logo available - hide component
        setError(true);
        setLogoUrl(null);
      } catch (e) {
        setError(true);
        setLogoUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenLogo();
  }, [symbol, issuer, address, logoURI, chain]);

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn(
        sizeClasses[size],
        'rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse',
        className
      )} />
    );
  }

  // Show XRP logo from local PNG
  if (logoUrl === '/images/chains/xrp-logo.svg' || logoUrl === '/images/chains/xrp-logo.png') {
    return (
      <img
        src="/images/chains/xrp-logo.png"
        alt="XRP logo"
        className={cn(sizeClasses[size], 'rounded-full object-cover', className)}
        onError={() => setError(true)}
      />
    );
  }

  // Show ETH logo from local image
  if (logoUrl === '/images/chains/ethereum-logo.png') {
    return (
      <img
        src="/images/chains/ethereum-logo.png"
        alt="ETH logo"
        className={cn(sizeClasses[size], 'rounded-full object-cover', className)}
        onError={() => setError(true)}
      />
    );
  }


  // Show authentic logo if found
  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={`${symbol} logo`}
        className={cn(sizeClasses[size], 'rounded-full object-cover', className)}
        onError={() => setError(true)}
      />
    );
  }

  // This should never happen now with fallback logic
  console.error(`❌ TokenLogo: NO LOGO FOUND for ${symbol}, returning null`);
  return null;
}
