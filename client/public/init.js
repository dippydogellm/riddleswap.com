// Initialization script moved from inline for CSP compliance
// Initialize application

// Polyfill Buffer for browser environment
if (typeof global === 'undefined') {
  var global = globalThis;
}
if (typeof Buffer === 'undefined') {
  window.Buffer = window.Buffer || {};
}

// CRITICAL FIX: Intercept and fix WebSocket URL construction 
// This fixes the "wss://localhost:undefined" error by patching WebSocket constructor for Replit environment
if (typeof window !== 'undefined') {
  // Store original WebSocket constructor
  const OriginalWebSocket = window.WebSocket;
  
  // WebSocket override temporarily disabled to prevent Vite HMR conflicts
  
// Copy static properties from original WebSocket
window.WebSocket.prototype = OriginalWebSocket.prototype;  // Set up additional environment info for Vite
  if (typeof window.__vite_is_modern_browser === 'undefined') {
    window.__vite_is_modern_browser = true;
  }
}