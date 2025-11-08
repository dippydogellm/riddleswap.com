import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SessionRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SessionRenewalModal({ isOpen, onClose, onSuccess }: SessionRenewalModalProps) {
  const [password, setPassword] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleRenewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsRenewing(true);
    setError('');

    try {
      const response = await apiRequest('/api/riddle-wallet/renew-session', {
        method: 'POST',
        body: JSON.stringify({ masterPassword: password })
      });

      const data = await response.json() as any;

      if (data.success) {
        toast({
          title: "Session Renewed",
          description: "Your session has been successfully renewed. Continuing your operation...",
        });
        
        setPassword('');
        
        // Call onSuccess callback to retry the operation
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        setError(data.error || 'Failed to renew session');
      }
    } catch (err) {
      console.error('Session renewal error:', err);
      setError('Failed to renew session. Please try again.');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setIsRenewing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            Renew Your Session
          </DialogTitle>
          <DialogDescription>
            Your session has expired or private keys need to be refreshed. Please enter your password to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRenewSession} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="renewal-password">Master Password</Label>
            <Input
              id="renewal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your master password"
              disabled={isRenewing}
              autoFocus
            />
            <p className="text-xs text-gray-500">
              This will restore your private keys for transaction signing
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isRenewing || !password}
            >
              {isRenewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renewing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Renew Session
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
