// Consistent number formatting utilities

// Format XRP amounts with appropriate decimal places
export const formatXRP = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';
  
  // For very small amounts
  if (num < 0.0001) return num.toFixed(6);
  
  // For small amounts
  if (num < 1) return num.toFixed(4);
  
  // For medium amounts
  if (num < 1000) return num.toFixed(2);
  
  // For large amounts
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

// Format USD values
export const formatUSD = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '$0.00';
  
  // For very small amounts
  if (num < 0.01) return `$${num.toFixed(4)}`;
  
  // Standard formatting
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format token amounts with appropriate precision
export const formatTokenAmount = (amount: number | string, decimals: number = 4): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';
  
  // For very small amounts  
  if (num < 0.0001) return num.toFixed(6);
  
  // For small amounts
  if (num < 1) return num.toFixed(decimals);
  
  // For medium amounts
  if (num < 1000) return num.toFixed(2);
  
  // For large amounts
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

// Format percentage values
export const formatPercentage = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${num.toFixed(2)}%`;
};

// Format large numbers with abbreviations
export const formatCompact = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(0);
};
