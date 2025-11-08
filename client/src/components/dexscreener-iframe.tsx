import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface DexScreenerIframeProps {
  chain: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  issuer?: string;
  className?: string;
}

export default function DexScreenerIframe({ 
  chain, 
  tokenSymbol, 
  tokenAddress, 
  issuer, 
  className = "" 
}: DexScreenerIframeProps) {
  
  const dexScreenerUrl = useMemo(() => {
    // Build the DexScreener URL based on chain and token data
    let baseUrl = 'https://dexscreener.com';
    let embedUrl = '';
    
    // For XRPL: use issuer if provided, otherwise fall back to tokenAddress
    const xrplIssuer = issuer || tokenAddress;
    
    switch (chain.toLowerCase()) {
      case 'xrpl':
        // XRPL format: /xrpl/{SYMBOL}.{ISSUER}_{QUOTE}
        if (tokenSymbol && xrplIssuer) {
          // For XRPL, tokens that are not exactly 3 letters need to be hex encoded
          let encodedSymbol = tokenSymbol;
          if (tokenSymbol.length !== 3) {
            // Convert to hex and pad to 40 characters with zeros
            encodedSymbol = Array.from(tokenSymbol)
              .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
              .join('')
              .toUpperCase()
              .padEnd(40, '0');
          }
          embedUrl = `${baseUrl}/xrpl/${encodedSymbol}.${xrplIssuer}_XRP?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'ethereum':
      case 'eth':
        // Ethereum format: /ethereum/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/ethereum/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'bsc':
      case 'binance':
        // BSC format: /bsc/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/bsc/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'polygon':
      case 'matic':
        // Polygon format: /polygon/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/polygon/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'arbitrum':
        // Arbitrum format: /arbitrum/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/arbitrum/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'optimism':
        // Optimism format: /optimism/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/optimism/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'base':
        // Base format: /base/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/base/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'solana':
      case 'sol':
        // Solana format: /solana/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/solana/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'avalanche':
      case 'avax':
        // Avalanche format: /avalanche/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/avalanche/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      case 'fantom':
      case 'ftm':
        // Fantom format: /fantom/{address}
        if (tokenAddress) {
          embedUrl = `${baseUrl}/fantom/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
        
      default:
        // Fallback to ethereum for unknown chains
        if (tokenAddress) {
          embedUrl = `${baseUrl}/ethereum/${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
        }
        break;
    }
    
    return embedUrl;
  }, [chain, tokenSymbol, tokenAddress, issuer]);

  // Don't render if we don't have the necessary data to build the URL
  if (!dexScreenerUrl) {
    return null;
  }

  return (
    <div className={className}>
      <div 
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '125%'
        }}
        className="dexscreener-embed"
      >
        <style>{`
          .dexscreener-embed {
            padding-bottom: 125%; /* Default mobile aspect ratio */
          }
          @media(min-width: 768px) {
            .dexscreener-embed {
              padding-bottom: 85% !important; /* Tablet aspect ratio */
            }
          }
          @media(min-width:1400px) {
            .dexscreener-embed {
              padding-bottom: 65% !important; /* Desktop aspect ratio */
            }
          }
        `}</style>
        <iframe
          src={dexScreenerUrl}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            border: 0
          }}
          allowFullScreen
          loading="lazy"
          title={`DexScreener chart for ${tokenSymbol || 'Token'}`}
          data-testid="iframe-dexscreener-chart"
          // Mobile-friendly iframe attributes
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        />
      </div>
    </div>
  );
}
