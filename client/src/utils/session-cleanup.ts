// Comprehensive session cleanup utility
export const clearAllStaleSessions = () => {
  // Clear all possible session tokens
  localStorage.removeItem('nft_session_token');
  sessionStorage.removeItem('riddle_session_token');
  localStorage.removeItem('riddle_session_token');
  
  // Clear any other cached session data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('session') || key.includes('token'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear any stuck toast notifications that might be showing session errors
  try {
    // Find all toast elements that might contain "Invalid session" text
    const toastElements = document.querySelectorAll('[data-radix-toast-viewport] > *');
    toastElements.forEach(el => {
      if (el.textContent && el.textContent.includes('Invalid session')) {
        console.log('🗑️ Removing stuck Invalid session toast');
        el.remove();
      }
    });
    
    // Clear any elements with destructive styling that might be stuck
    const destructiveElements = document.querySelectorAll('.destructive');
    destructiveElements.forEach(el => {
      if (el.textContent && el.textContent.includes('Invalid session')) {
        console.log('🗑️ Removing stuck destructive session element');
        el.remove();
      }
    });
  } catch (e) {
    // Ignore DOM errors if elements don't exist
  }
  
  console.log('🧹 Cleared all stale session tokens and stuck UI elements');
};

// Force clear all stuck elements on page load
export const forceResetUI = () => {
  // Wait for DOM to be ready then clear any stuck elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        clearAllStaleSessions();
        // Force a complete UI refresh by triggering a re-render
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });
  } else {
    setTimeout(() => {
      clearAllStaleSessions();
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }
};

// Initialize session cleanup on module load
if (typeof window !== 'undefined') {
  clearAllStaleSessions();
  forceResetUI();
}
