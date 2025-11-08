import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sessionManager } from '@/utils/sessionManager';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Users } from 'lucide-react';

export function ReconnectionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const checkReconnectionNeeded = () => {
      if (sessionManager.needsReconnection()) {
        setIsOpen(true);
      }
    };

    // Check immediately
    checkReconnectionNeeded();

    // Check periodically
    const interval = setInterval(checkReconnectionNeeded, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    if (!handle.trim() || !password.trim()) {
      setError('Please enter both handle and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await sessionManager.attemptReconnection(handle.trim(), password);

      if (success) {
        toast({
          title: "Reconnected Successfully",
          description: "You are now connected to your gaming session"
        });

        setIsOpen(false);
        
        // Redirect to post-reconnect path
        const redirectPath = sessionManager.getPostReconnectPath();
        if (redirectPath !== window.location.pathname) {
          window.location.href = redirectPath;
        } else {
          // Force reload to update the UI
          window.location.reload();
        }
      } else {
        setError('Invalid credentials or no active session found. Please check your handle and password.');
      }
    } catch (error) {
      console.error('Reconnection error:', error);
      setError('Failed to reconnect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipToLogin = () => {
    sessionStorage.removeItem('needs_reconnection');
    setIsOpen(false);
    window.location.href = '/wallet-login';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="reconnection-dialog">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <DialogTitle>Session Reconnection Required</DialogTitle>
          </div>
          <DialogDescription>
            You have an active gaming session that needs reconnection. Please enter your credentials to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              type="text"
              placeholder="Enter your handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReconnect()}
              data-testid="input-handle"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReconnect()}
              data-testid="input-password"
            />
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleReconnect}
              disabled={isLoading}
              className="flex-1"
              data-testid="button-reconnect"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reconnect Session
            </Button>
            
            <Button
              onClick={handleSkipToLogin}
              variant="outline"
              className="flex-1"
              data-testid="button-skip-to-login"
            >
              <Users className="mr-2 h-4 w-4" />
              New Login
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Your gaming session was restored by the server. Enter your credentials to reconnect.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
