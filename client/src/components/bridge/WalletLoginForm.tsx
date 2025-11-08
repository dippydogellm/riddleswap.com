import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WalletLoginFormProps {
  onLoginSuccess: (sessionData: any) => void;
  isLoading?: boolean;
}

export function WalletLoginForm({ onLoginSuccess, isLoading = false }: WalletLoginFormProps) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/riddle-wallet/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.trim(),
          masterPassword: password
        })
      });

      if (response.ok) {
        const loginData = await response.json() as any;
        
        // Store session token in both storages
        localStorage.setItem('sessionToken', loginData.sessionToken);
        sessionStorage.setItem('riddle_wallet_session', JSON.stringify({
          sessionToken: loginData.sessionToken,
          handle: handle,
          authenticated: true,
          timestamp: Date.now()
        }));
        
        // Store wallet data as backup for persistence
        if (loginData.walletAddresses) {
          localStorage.setItem('riddle_wallet_data', JSON.stringify({
            sessionToken: loginData.sessionToken,
            walletAddresses: loginData.walletAddresses,
            authenticated: true,
            timestamp: Date.now()
          }));
        }

        toast({
          title: "Login Successful",
          description: `Welcome back, ${handle}!`,
        });

        onLoginSuccess(loginData);
      } else {
        const errorData = (await response.json()).catch(() => ({ error: 'Login failed' }));
        setError(errorData.error || 'Invalid credentials');
        toast({
          title: "Login Failed", 
          description: errorData.error || 'Please check your credentials',
          variant: "destructive",
        });
      }
    } catch (err) {
      setError('Network error - please try again');
      toast({
        title: "Connection Error",
        description: 'Unable to connect to server',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
          <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle className="text-xl">Connect Your Wallet</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to access your multi-chain wallet
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="handle">Wallet Handle</Label>
            <Input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Enter your wallet handle"
              disabled={isSubmitting || isLoading}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Master Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your master password"
              disabled={isSubmitting || isLoading}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || isLoading || !handle.trim() || !password}
          >
            <Lock className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
        
        <div className="mt-4 text-xs text-center text-muted-foreground">
          Your credentials are encrypted and stored securely
        </div>
      </CardContent>
    </Card>
  );
}
