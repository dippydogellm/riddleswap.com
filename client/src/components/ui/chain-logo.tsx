import { useState } from 'react';
import '@/styles/chain-logos.css';

interface ChainLogoProps {
  chain: string;
  iconUrl: string;
  fallback?: string;
  // BACKWARDS COMPATIBILITY FIX: Support both old and new size formats
  size?: 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function ChainLogo({ 
  chain, 
  iconUrl, 
  fallback = '⚪', 
  size = 'medium',
  className = '' 
}: ChainLogoProps) {
  const [imageError, setImageError] = useState(false);
  
  // BACKWARDS COMPATIBILITY FIX: Map legacy size props to new format
  const normalizeSize = (size: ChainLogoProps['size']): 'small' | 'medium' | 'large' => {
    switch (size) {
      case 'sm': return 'small';
      case 'md': return 'medium';
      case 'lg': return 'large';
      case 'small':
      case 'medium':
      case 'large':
        return size;
      default:
        return 'medium';
    }
  };
  
  const normalizedSize = normalizeSize(size);
  
  // Use centralized chain logo classes from chain-logos.css
  const sizeClasses = {
    small: 'chain-logo-small',
    medium: 'chain-logo-medium', 
    large: 'chain-logo-large'
  };
  
  // Get chain-specific class if available
  const chainClass = `chain-logo-${chain.toLowerCase()}`;
  
  if (imageError || !iconUrl) {
    return (
      <div className={`chain-logo-container ${sizeClasses[normalizedSize]} ${className}`}>
        <div className="token-logo-fallback">
          {fallback}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`chain-logo-container ${sizeClasses[normalizedSize]} ${chainClass} ${className}`}>
      <img 
        src={iconUrl}
        alt={`${chain} logo`}
        className="chain-logo"
        onError={() => setImageError(true)}
        onLoad={() => setImageError(false)}
      />
    </div>
  );
}
