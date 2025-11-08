/**
 * Browser polyfills for Node.js modules
 * Fixes "Buffer is not defined" and other Node.js compatibility issues
 */

import { Buffer } from 'buffer';

// Make Buffer available globally
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = (window as any).process || { env: {} };
}

// Pre-load emotion to prevent styled_default error
try {
  // Force emotion packages to load before MUI
  require('@emotion/react');
  require('@emotion/styled');
} catch (e) {
  // Silently fail if CommonJS not available (ESM will handle it)
}

// Export for module usage
export { Buffer };
