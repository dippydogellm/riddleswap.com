// Session clearing utility for bridge authentication issues
export function clearAllSessionData() {
  // Clear all possible session storage locations
  localStorage.removeItem('sessionToken');
  sessionStorage.removeItem('walletSession');
  sessionStorage.removeItem('riddle_wallet_session');
  
  console.log('✅ All session data cleared - forcing fresh login');
}

export function handleBridgeAuthError() {
  clearAllSessionData();
  
  alert(`Bridge authentication failed. 

After server restart, sessions are restored from database but private keys need to be re-cached for security.

Please login again to enable bridge transactions.`);
  
  window.location.href = '/wallet-login';
}
