import React from 'react';
import { ArrowDown } from 'lucide-react';
// Logo removed - using text branding instead

interface SwapTokenInputProps {
  label: string;
  token: any;
  amount: string;
  onAmountChange: (value: string) => void;
  onTokenSelect: () => void;
  balance?: string;
  isLoading?: boolean;
  usdValue?: string;
  onQuickAmount?: (percentage: number) => void;
  showQuickAmounts?: boolean;
  readOnly?: boolean;
}

export const SwapTokenInput: React.FC<SwapTokenInputProps> = ({
  label,
  token,
  amount,
  onAmountChange,
  onTokenSelect,
  balance,
  isLoading,
  usdValue,
  onQuickAmount,
  showQuickAmounts = false,
  readOnly = false
}) => {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow decimal numbers, including scientific notation and large numbers
    if (/^\d*\.?\d*([eE][+-]?\d+)?$/.test(value) || value === '') {
      onAmountChange(value);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text');
    // Clean pasted content to allow only valid numbers
    const cleaned = paste.replace(/[^0-9.eE+-]/g, '');
    if (cleaned !== paste) {
      e.preventDefault();
      onAmountChange(cleaned);
    }
  };

  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    if (isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(4);
  };

  return (
    <div className="swap-token-input-card">
      <div className="swap-token-input-header">
        <span className="swap-token-input-label">{label}</span>
        {balance && (
          <span className="swap-token-input-balance">
            Balance: {isLoading ? (
              <span className="animate-pulse">...</span>
            ) : (
              formatBalance(balance)
            )}
          </span>
        )}
      </div>

      <div className="swap-token-input-body">
        <div className="swap-token-input-row">
          <input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            onPaste={handlePaste}
            placeholder="Enter custom amount..."
            className="swap-token-amount-input"
            readOnly={readOnly}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            title="Enter any amount - supports large numbers, decimals, and scientific notation"
          />
          
          <button
            type="button"
            onClick={onTokenSelect}
            className="swap-token-selector-button"
          >
            {token ? (
              <>
                {token.icon_url ? (
                  <img 
                    src={token.icon_url} 
                    alt={token.symbol}
                    className="token-image image-sm"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="token-fallback-icon"
                  style={{ display: token.icon_url ? 'none' : 'flex' }}
                >
                  {token.symbol.charAt(0)}
                </div>
                <span className="token-symbol">{token.symbol}</span>
                <ArrowDown className="w-4 h-4 opacity-60" />
              </>
            ) : (
              <>
                <span className="select-token-text">Select token</span>
                <ArrowDown className="w-4 h-4 opacity-60" />
              </>
            )}
          </button>
        </div>

        {showQuickAmounts && balance && parseFloat(balance) > 0 && (
          <div className="swap-quick-amounts">
            <button
              type="button"
              onClick={() => onQuickAmount?.(0.25)}
              className="swap-quick-amount-button"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => onQuickAmount?.(0.5)}
              className="swap-quick-amount-button"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => onQuickAmount?.(0.75)}
              className="swap-quick-amount-button"
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => onQuickAmount?.(1)}
              className="swap-quick-amount-button"
            >
              MAX
            </button>
          </div>
        )}

        {usdValue && amount && (
          <div className="swap-token-usd-value">
            ≈ {usdValue}
          </div>
        )}
      </div>
    </div>
  );
};
