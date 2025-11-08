import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Shield, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clearAllWalletData } from '@/lib/queryClient';

interface SessionExtensionModalProps {
  isOpen: boolean;
  onExtend: () => Promise<boolean>;
  onLogout: () => void;
  timeRemaining?: number; // in seconds
}

export function SessionExtensionModal({ 
  isOpen, 
  onExtend, 
  onLogout, 
  timeRemaining = 300 
}: SessionExtensionModalProps) {
  const { toast } = useToast();
  const [isExtending, setIsExtending] = useState(false);
  const [countdown, setCountdown] = useState(Math.max(timeRemaining, 60)); // At least 60 seconds

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      const success = await onExtend();
      if (success) {
        toast({
          title: "Session Extended",
          description: "Your session has been extended successfully",
          variant: "default"
        });
      } else {
        toast({
          title: "Extension Failed",
          description: "Unable to extend session. You'll be logged out.",
          variant: "destructive"
        });
        // Auto logout after failed extension
        setTimeout(onLogout, 2000);
      }
    } catch (error) {
      console.error('Session extension error:', error);
      toast({
        title: "Extension Error",
        description: "An error occurred. You'll be logged out for security.",
        variant: "destructive"
      });
      setTimeout(onLogout, 2000);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    clearAllWalletData();
    onLogout();
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
      variant: "default"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Your session will expire in <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {formatTime(countdown)}
            </span>
            <br />
            <span className="text-sm mt-2 block">
              Would you like to extend your session to continue using RiddleSwap?
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full sm:w-auto"
            disabled={isExtending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout Now
          </Button>
          <Button
            onClick={handleExtend}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isExtending}
          >
            <Shield className="mr-2 h-4 w-4" />
            {isExtending ? 'Extending...' : 'Extend Session'}
          </Button>
        </DialogFooter>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          For your security, you'll be automatically logged out if no action is taken.
        </div>
      </DialogContent>
    </Dialog>
  );
}
