/**
 * Project Session Manager
 * Handles automatic session validation, renewal, and logout
 */

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  LogOut,
  Timer
} from 'lucide-react';

// Types
interface ProjectSession {
  projectId: string;
  walletAddress: string;
  expiresAt: string;
  lastActivity: string;
  loginMethod: string;
  valid: boolean;
}

interface SessionManagerProps {
  sessionToken: string | null;
  projectId: string;
  onSessionExpired: () => void;
  onSessionWarning?: (minutesRemaining: number) => void;
}

export default function ProjectSessionManager({ 
  sessionToken, 
  projectId, 
  onSessionExpired,
  onSessionWarning 
}: SessionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [warningShown, setWarningShown] = useState(false);

  // Session validation query
  const { data: sessionData, isError, error, refetch } = useQuery<ProjectSession>({
    queryKey: ['project-session', projectId, sessionToken],
    queryFn: async () => {
      if (!sessionToken) throw new Error('No session token');
      
      const response = await apiRequest('/api/projects/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken,
          projectId
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      return result as ProjectSession;
    },
    enabled: !!sessionToken && !!projectId,
    refetchInterval: 60000, // Check every minute
    retry: false,
  });

  // Logout mutation
  const { mutate: logout, isPending: loggingOut } = useMutation({
    mutationFn: async () => {
      if (!sessionToken) return;
      
      await apiRequest('/api/projects/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken,
          projectId
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      queryClient.removeQueries({ queryKey: ['project-session'] });
      onSessionExpired();
    },
    onError: (error: any) => {
      console.error('Logout error:', error);
      // Force logout anyway
      onSessionExpired();
    },
  });

  // Calculate time remaining until session expires
  const calculateTimeRemaining = useCallback(() => {
    if (!sessionData?.expiresAt) return 0;
    
    const expiresAt = new Date(sessionData.expiresAt).getTime();
    const now = new Date().getTime();
    const remaining = Math.max(0, expiresAt - now);
    
    return Math.floor(remaining / 1000 / 60); // Minutes
  }, [sessionData?.expiresAt]);

  // Update time remaining
  useEffect(() => {
    if (!sessionData) return;

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      // Show warning at 10 minutes
      if (remaining <= 10 && remaining > 0 && !warningShown) {
        setShowWarningDialog(true);
        setWarningShown(true);
        onSessionWarning?.(remaining);
      }

      // Auto-logout at 0 minutes
      if (remaining <= 0) {
        handleSessionExpired();
      }
    }, 30000); // Update every 30 seconds

    // Initial calculation
    const remaining = calculateTimeRemaining();
    setTimeRemaining(remaining);

    return () => clearInterval(interval);
  }, [sessionData, calculateTimeRemaining, warningShown, onSessionWarning]);

  // Handle session expired
  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });
    queryClient.removeQueries({ queryKey: ['project-session'] });
    onSessionExpired();
  }, [toast, queryClient, onSessionExpired]);

  // Handle query errors (session invalid)
  useEffect(() => {
    if (isError) {
      console.error('Session validation error:', error);
      handleSessionExpired();
    }
  }, [isError, error, handleSessionExpired]);

  // Refresh session (extend activity)
  const refreshSession = () => {
    refetch();
    setWarningShown(false);
    setShowWarningDialog(false);
  };

  // Handle manual logout
  const handleLogout = () => {
    logout();
  };

  // Don't render anything if no session
  if (!sessionToken || !sessionData) {
    return null;
  }

  const progressPercentage = Math.max(0, Math.min(100, (timeRemaining / 120) * 100));

  return (
    <>
      {/* Session Status Display */}
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="font-medium text-sm">Project Session</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Active
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet:</span>
              <span className="font-mono text-xs">
                {sessionData.walletAddress.slice(0, 6)}...{sessionData.walletAddress.slice(-4)}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Method:</span>
              <Badge variant="secondary" className="text-xs">
                {sessionData.loginMethod}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time Left:</span>
              <span className={`font-medium ${timeRemaining <= 10 ? 'text-orange-600' : 'text-gray-900'}`}>
                {timeRemaining}m
              </span>
            </div>

            <div className="space-y-1">
              <Progress 
                value={progressPercentage} 
                className={`h-2 ${timeRemaining <= 10 ? 'bg-orange-100' : 'bg-gray-100'}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Expires: {new Date(sessionData.expiresAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={refreshSession}
                data-testid="refresh-session"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                data-testid="logout-button"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Session Warning Dialog */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="session-warning-dialog">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-orange-600" />
              <DialogTitle>Session Expiring Soon</DialogTitle>
            </div>
            <DialogDescription>
              Your project session will expire in {timeRemaining} minute{timeRemaining !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              To continue managing your project without interruption, please refresh your session or log in again.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Current Session</p>
              <p className="text-sm text-muted-foreground">
                Method: {sessionData.loginMethod} • Wallet: {sessionData.walletAddress.slice(0, 6)}...{sessionData.walletAddress.slice(-4)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowWarningDialog(false)}
              data-testid="dismiss-warning"
            >
              Dismiss
            </Button>
            <Button
              onClick={refreshSession}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="extend-session"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Extend Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
