import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { useSession } from "@/utils/sessionManager";

interface SessionRenewalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionRenewalModal({ open, onOpenChange }: SessionRenewalModalProps) {
  const session = useSession();
  const [password, setPassword] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRenewal = async () => {
    if (!password || !session.handle) {
      setError("Password is required");
      return;
    }

    setIsRenewing(true);
    setError(null);

    try {
      // Use the login endpoint to get fresh keys with password
      const response = await fetch("/api/riddle-wallet/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          handle: session.handle,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("✅ Session renewed successfully with fresh keys");
        
        // Update session with new token and keys
        if (data.sessionToken) {
          localStorage.setItem('riddle_session_token', data.sessionToken);
          localStorage.setItem('sessionToken', data.sessionToken);
          
          const sessionData = {
            sessionToken: data.sessionToken,
            handle: data.handle || session.handle,
            username: data.username || session.username,
            authenticated: true,
            walletData: data.walletData || data.walletAddresses,
            walletAddresses: data.walletAddresses || data.walletData,
            expiresAt: data.expiresAt,
            loginTime: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            autoLogoutEnabled: false,
            autoLogoutMinutes: 30
          };
          
          sessionStorage.setItem('riddle_wallet_session', JSON.stringify(sessionData));
        }
        
        // Force refresh the session
        await session.refresh();
        
        // Close modal and clear password
        setPassword("");
        onOpenChange(false);
        
        // Reload the page to ensure all components pick up the new session
        window.location.reload();
      } else {
        setError(data.error || "Failed to renew session. Please check your password.");
      }
    } catch (err) {
      console.error("❌ Session renewal error:", err);
      setError("An error occurred while renewing your session. Please try again.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleLogout = () => {
    session.logout();
    onOpenChange(false);
  };

  const handleDismiss = () => {
    // Allow user to dismiss and continue browsing
    // Modal will show again when they try to make a payment/transaction
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <DialogTitle>Session Renewal Required</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            Your session needs renewal to perform transactions. You can continue browsing or renew now to trade, swap, or make payments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive" className="bg-red-950 border-red-800">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="handle" className="text-slate-300">
              Handle
            </Label>
            <Input
              id="handle"
              value={session.handle || ""}
              disabled
              className="bg-slate-800 border-slate-700 text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your wallet password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRenewing) {
                  handleRenewal();
                }
              }}
              disabled={isRenewing}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            disabled={isRenewing}
            className="text-slate-400 hover:text-white"
          >
            Continue Browsing
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isRenewing}
            className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
          >
            Logout
          </Button>
          <Button
            onClick={handleRenewal}
            disabled={isRenewing || !password}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRenewing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Renewing...
              </>
            ) : (
              "Renew Now"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
