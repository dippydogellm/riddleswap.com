import { useState } from "react";
import { getChainLogoPath, getChainDisplayName } from "@/utils/chains";

interface ChainLogoProps {
  chainId: string | null | undefined;
  size?: number | "sm" | "md" | "lg" | "xl";
  className?: string;
  showTooltip?: boolean;
  "data-testid"?: string;
}

export function ChainLogo({ 
  chainId, 
  size = "md", 
  className = "", 
  showTooltip = false,
  "data-testid": testId
}: ChainLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Early return with fallback if chainId is null/undefined
  if (!chainId || typeof chainId !== 'string') {
    const sizeInPx = typeof size === "number" ? size : size === "sm" ? 16 : size === "md" ? 24 : size === "lg" ? 32 : size === "xl" ? 48 : 24;
    const fallbackSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9IiNmM2Y0ZjYiIHJ4PSI4IiAvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjEwMCIgcj0iMzIiIGZpbGw9IiM2YjcyODAiIC8+PHRleHQgeD0iMTI4IiB5PSIxNzUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNmI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNTAwIj5DaGFpbiBMb2dvPC90ZXh0Pjwvc3ZnPg==';
    
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <img
          src={fallbackSvg}
          alt="Loading chain logo"
          width={sizeInPx}
          height={sizeInPx}
          className="rounded-full object-cover"
          title={showTooltip ? 'Loading...' : undefined}
          data-testid={testId || 'chain-logo-loading'}
        />
      </div>
    );
  }

  // Convert size prop to pixel values
  const getSizeInPx = () => {
    if (typeof size === "number") return size;
    
    switch (size) {
      case "sm": return 16;
      case "md": return 24;
      case "lg": return 32;
      case "xl": return 48;
      default: return 24;
    }
  };

  const sizeInPx = getSizeInPx();
  const logoPath = getChainLogoPath(chainId);
  const displayName = getChainDisplayName(chainId);

  // Base64 SVG fallback that matches home.tsx pattern - ensures fallback is always visible
  const fallbackSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9IiNmM2Y0ZjYiIHJ4PSI4IiAvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjEwMCIgcj0iMzIiIGZpbGw9IiM2YjcyODAiIC8+PHRleHQgeD0iMTI4IiB5PSIxNzUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNmI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNTAwIj5DaGFpbiBMb2dvPC90ZXh0Pjwvc3ZnPg==';
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    if (!imageError) {
      setImageError(true);
      // Match home.tsx pattern - set fallback SVG directly on img src
      target.src = fallbackSvg;
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      {isLoading && (
        <div 
          className="bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
          style={{ width: sizeInPx, height: sizeInPx }}
          data-testid={testId ? `${testId}-loading` : `chain-logo-loading-${chainId}`}
        />
      )}
      
      <img
        src={logoPath}
        alt={`${displayName} logo`}
        width={sizeInPx}
        height={sizeInPx}
        className={`rounded-full object-cover transition-opacity duration-200 ${
          isLoading ? "opacity-0 absolute" : "opacity-100"
        }`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        title={showTooltip ? displayName : undefined}
        data-testid={testId || `chain-logo-${chainId}`}
      />
    </div>
  );
}

// Utility component for chain selection buttons
interface ChainButtonProps {
  chainId: string | null | undefined;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
  "data-testid"?: string;
}

export function ChainButton({ 
  chainId, 
  isSelected, 
  onClick, 
  className = "",
  "data-testid": testId
}: ChainButtonProps) {
  // Handle null/undefined chainId
  if (!chainId || typeof chainId !== 'string') {
    return (
      <button
        onClick={onClick}
        className={`p-4 rounded-lg border-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed ${className}`}
        data-testid={testId || 'chain-button-loading'}
        disabled
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <span className="font-medium text-sm text-gray-400">Loading...</span>
        </div>
      </button>
    );
  }

  const displayName = getChainDisplayName(chainId);
  
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
        isSelected 
          ? "border-primary bg-primary/10 shadow-md" 
          : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
      } ${className}`}
      data-testid={testId || `chain-button-${chainId}`}
    >
      <div className="flex flex-col items-center gap-2">
        <ChainLogo 
          chainId={chainId} 
          size="lg" 
          data-testid={testId ? `${testId}-logo` : `chain-button-logo-${chainId}`}
        />
        <span className="font-medium text-sm">{displayName}</span>
        {isSelected && (
          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        )}
      </div>
    </button>
  );
}
