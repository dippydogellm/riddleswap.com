// Session Display Component - Shows current authentication status
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, User, Key, Clock } from 'lucide-react';

interface SessionInfo {
  handle?: string;
  expiresAt?: number;
  isValid?: boolean;
  walletType?: string;
}

export function SessionDisplay() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSession = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        setSessionInfo(null);
        return;
      }

      // Check session validity by making a test call
      const response = await fetch('/api/auth/session-check', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json() as any;
        setSessionInfo({
          handle: data.handle || 'Unknown',
          expiresAt: data.expiresAt,
          isValid: true,
          walletType: data.walletType || 'Multi-chain'
        });
      } else {
        setSessionInfo(null);
        localStorage.removeItem('sessionToken');
      }
    } catch (err) {
      setError('Failed to check session status');
      setSessionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sessionToken');
    setSessionInfo(null);
    window.location.href = '/';
  };

  const testSolanaPayment = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Please login first');
        return;
      }

      const response = await fetch('/api/sol/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          handle: sessionInfo?.handle,
          password: 'test', // This should come from user input in real app
          destination: '2PgtCtabd1pEjayhG1FbqqbyvfMNL3ukqE8PcU1jT8Ve',
          amount: '100000',
          tokenMint: 'HbD2SQCB5rDSf3ZYY7xqJMYRAZqR7K1Qg76KL3PqzgMY' // PEPE token
        })
      });

      const result = await response.json() as any;
      
      if (result.success) {
        alert(`PEPE transaction sent! Signature: ${result.txHash}`);
        console.log('Transaction result:', result);
      } else {
        alert(`Transaction failed: ${result.error}`);
      }
    } catch (err) {
      alert('Transaction failed: Network error');
      console.error('Payment error:', err);
    }
  };

  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout | null = null;
    
    // Check immediately
    checkSession();
    
    // Only set up periodic checking if we have a session
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
      // Check session every 2 minutes (less aggressive)
      sessionCheckInterval = setInterval(checkSession, 120000);
    }
    
    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, []);

  const formatTimeRemaining = (expiresAt?: number) => {
    if (!expiresAt) return 'Unknown';
    
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Checking session...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sessionInfo) {
    return (
      <Card className="w-full max-w-md border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <User className="w-5 h-5 mr-2" />
            No Active Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">Please login to access wallet features</p>
          <Button 
            onClick={() => window.location.href = '/wallet-login'} 
            className="w-full"
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="w-full max-w-md border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-600">
            <Wallet className="w-5 h-5 mr-2" />
            Active Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Handle:</span>
            <Badge variant="outline" className="flex items-center">
              <User className="w-3 h-3 mr-1" />
              {sessionInfo.handle}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Wallet Type:</span>
            <Badge variant="secondary" className="flex items-center">
              <Key className="w-3 h-3 mr-1" />
              {sessionInfo.walletType}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Expires:</span>
            <Badge variant="outline" className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatTimeRemaining(sessionInfo.expiresAt)}
            </Badge>
          </div>

          <div className="pt-4 space-y-2">
            <Button 
              onClick={testSolanaPayment}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Test PEPE Transfer (Mainnet)
            </Button>
            <Button 
              onClick={handleLogout}
              variant="outline" 
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
