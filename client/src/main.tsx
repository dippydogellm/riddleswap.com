// Import polyfills first to ensure Node.js compatibility
import './polyfills';
import { createRoot } from "react-dom/client";
import App from "./App";
import ThemeProvider from './contexts/ThemeProvider';
import './styles/base.css';
import './styles/mobile-responsive.css';
import './styles/sidebar.css';
import './styles/install-prompt.css';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        // console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        // console.log('SW registration failed: ', registrationError);
      });
  });
}

// Set up automatic error logging BEFORE React starts

// Capture unhandled JavaScript errors
window.addEventListener('error', (event) => {
  const errorData = {
    error_message: event.message || 'Unknown error',
    stack_trace: event.error?.stack || 'No stack trace available',
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    error_type: 'react_error' as const,
    severity: 'high' as const,
    component_name: event.filename || 'unknown',
    browser_info: {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    },
    error_context: {
      lineno: event.lineno,
      colno: event.colno,
      filename: event.filename
    }
  };

  // Auto-log the error
  fetch('/api/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData)
  }).catch(err => console.error('Failed to auto-log error:', err));
  
  console.error('🚨 AUTO-LOGGED ERROR:', event);
});

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const errorData = {
    error_message: event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection',
    stack_trace: event.reason?.stack || 'No stack trace available',
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    error_type: 'api_error' as const,
    severity: 'medium' as const,
    browser_info: {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    },
    error_context: {
      rejectedPromise: true,
      reason: String(event.reason)
    }
  };

  // Auto-log the error
  fetch('/api/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData)
  }).catch(err => console.error('Failed to auto-log promise rejection:', err));
  
  console.error('🚨 AUTO-LOGGED PROMISE REJECTION:', event);
});

const root = document.getElementById("root");

  if (root) {
    const reactRoot = createRoot(root);
    reactRoot.render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
  } else {
  console.error('❌ main.tsx: Root element not found!');
}
