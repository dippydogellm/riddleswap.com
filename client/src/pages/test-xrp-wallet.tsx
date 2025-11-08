import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function TestXRPWallet() {
  const { isAuthenticated, walletAddresses, walletData, user } = useAuth();
  const { toast } = useToast();
  const [balanceData, setBalanceData] = useState<any>(null);
  const [nftsData, setNftsData] = useState<any>(null);
  const [tokensData, setTokensData] = useState<any>(null);
  
  const walletAddress = user?.walletAddress || walletData?.xrpAddress || walletAddresses?.xrpAddress || walletAddresses?.xrp;
  
  const testLogin = async () => {
    try {
      const response = await fetch('/api/riddle-wallet/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: 'dippydoge', masterPassword: 'Neverknow1.' })
      });
      
      const data = await response.json() as any;
      if (data.success) {
        // Store session
        localStorage.setItem('sessionToken', data.sessionToken);
        sessionStorage.setItem('riddle_wallet_session', JSON.stringify({
          sessionToken: data.sessionToken,
          handle: 'dippydoge',
          walletData: data.walletData,
          walletAddresses: data.walletData,
          expiresAt: data.expiresAt
        }));
        
        toast({
          title: "Login Successful",
          description: "Session stored, please refresh page"
        });
        
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };
  
  const fetchWalletData = async () => {
    if (!walletAddress) {
      console.log('No wallet address available');
      return;
    }
    
    const token = localStorage.getItem('sessionToken');
    
    try {
      // Fetch balance
      const balanceResp = await fetch(`/api/public/wallets/xrp/balance/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const balance = await balanceResp.json();
      setBalanceData(balance);
      
      // Fetch NFTs
      const nftsResp = await fetch(`/api/wallet/nfts/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const nfts = await nftsResp.json();
      setNftsData(nfts);
      
      // Fetch tokens
      const tokensResp = await fetch(`/api/wallet/tokens/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tokens = await tokensResp.json();
      setTokensData(tokens);
      
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated && walletAddress) {
      fetchWalletData();
    }
  }, [isAuthenticated, walletAddress]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-8">XRP Wallet Test Page</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <p>Authenticated: {isAuthenticated ? '✅ YES' : '❌ NO'}</p>
          <p>Wallet Address: {walletAddress || 'Not Available'}</p>
          <p>Session Token: {localStorage.getItem('sessionToken') ? 'Present' : 'Missing'}</p>
          
          {!isAuthenticated && (
            <Button onClick={testLogin} className="mt-4">
              Test Login (dippydoge)
            </Button>
          )}
        </div>
        
        {isAuthenticated && balanceData && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
            <h2 className="text-xl font-semibold mb-4">Balance Data</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(balanceData, null, 2)}
            </pre>
          </div>
        )}
        
        {isAuthenticated && nftsData && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
            <h2 className="text-xl font-semibold mb-4">NFTs ({nftsData.count || 0})</h2>
            <pre className="text-sm overflow-auto max-h-96">
              {JSON.stringify(nftsData.nfts?.slice(0, 2), null, 2)}
            </pre>
          </div>
        )}
        
        {isAuthenticated && tokensData && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
            <h2 className="text-xl font-semibold mb-4">Tokens ({tokensData.count || 0})</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(tokensData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
