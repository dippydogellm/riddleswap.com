// Clear all Xaman polling UUIDs from localStorage
export function clearAllXamanPolling() {
  localStorage.removeItem('xaman_pending_uuid');
  localStorage.removeItem('xaman_pending_timestamp');
  
  // Clear any other UUID-related storage
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.includes('uuid') || key.includes('payload') || key.includes('xaman')) {
      localStorage.removeItem(key);
    }
  });

}

// Call this immediately when module loads
clearAllXamanPolling();
