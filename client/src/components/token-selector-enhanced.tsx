import { ChevronDown } from 'lucide-react';
import { TokenSearchResult } from '@/lib/token-api';
const xrpLogo = '/images/chains/xrp-logo.png';


interface TokenSelectorEnhancedProps {
  value: TokenSearchResult | null;
  onClick: () => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

export function TokenSelectorEnhanced({
  value,
  onClick,
  disabled = false,
  placeholder = "Select Token",
  isLoading = false
}: TokenSelectorEnhancedProps) {
  const getTokenLogo = (token: TokenSearchResult) => {
    if (token.symbol === 'XRP') {
      return xrpLogo;
    }
    return token.icon_url || null;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="token-selector-enhanced"
    >
      <div className="token-selector-content">
        {value ? (
          <>
            <div className="token-icon-wrapper">
              {getTokenLogo(value) ? (
                <img 
                  src={getTokenLogo(value)!} 
                  alt={value.symbol} 
                  className="token-icon-enhanced"
                />
              ) : (
                <div className="token-icon-placeholder">
                  {value.symbol.charAt(0)}
                </div>
              )}
              {value.verified && (
                <div className="token-verified-indicator" />
              )}
            </div>
            <div className="token-info">
              <span className="token-symbol-enhanced">{value.symbol}</span>
              {value.name && value.name !== value.symbol && (
                <span className="token-name-enhanced">{value.name}</span>
              )}
            </div>
          </>
        ) : (
          <div className="token-placeholder">
            <div className="token-icon-placeholder empty">
              <span>?</span>
            </div>
            <span className="placeholder-text">{placeholder}</span>
          </div>
        )}
      </div>
      <ChevronDown className={`chevron-icon ${isLoading ? 'rotating' : ''}`} />
    </button>
  );
}
