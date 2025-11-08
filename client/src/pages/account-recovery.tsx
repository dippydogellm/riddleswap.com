import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { hashPassword } from "@/lib/password-utils";
import "@/styles/global-theme.css";

export default function AccountRecovery() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form state
  const [handle, setHandle] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [selectedChain, setSelectedChain] = useState<'ETH' | 'XRP' | 'SOL' | 'BTC'>('ETH');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [step, setStep] = useState(1); // 1: verify key, 2: set new password
  const [verifiedWallet, setVerifiedWallet] = useState<any>(null);

  const chainOptions = [
    { value: 'ETH', label: 'Ethereum', icon: 'Ξ', placeholder: '0x...' },
    { value: 'XRP', label: 'XRP Ledger', icon: '✕', placeholder: 's...' },
    { value: 'SOL', label: 'Solana', icon: '◎', placeholder: 'Array of 32 bytes...' },
    { value: 'BTC', label: 'Bitcoin', icon: '₿', placeholder: 'L... or K...' }
  ];

  const handleVerifyPrivateKey = async () => {
    if (!handle.trim()) {
      toast({
        title: "Handle Required",
        description: "Please enter your wallet handle",
        variant: "destructive"
      });
      return;
    }

    if (!privateKey.trim()) {
      toast({
        title: "Private Key Required",
        description: "Please enter your private key",
        variant: "destructive"
      });
      return;
    }

    setIsRecovering(true);

    try {
      // Verify private key with server
      const response = await fetch('/api/riddle-wallet/verify-private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          privateKey,
          chain: selectedChain
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || 'Private key verification failed');
      }

      const data = await response.json() as any;
      setVerifiedWallet(data.wallet);
      setStep(2);
      
      toast({
        title: "Private Key Verified!",
        description: `Successfully verified ${selectedChain} private key for @${handle}`,
      });

    } catch (error: any) {

      toast({
        title: "Verification Failed",
        description: error.message || "Invalid private key or handle",
        variant: "destructive"
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter a new password",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please confirm your new password",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive"
      });
      return;
    }

    setIsRecovering(true);

    try {
      // Reset password with server
      const response = await fetch('/api/riddle-wallet/reset-password-with-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          privateKey,
          chain: selectedChain,
          newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.message || 'Password reset failed');
      }

      toast({
        title: "Password Reset Successful!",
        description: "Your password has been updated. You can now log in.",
      });

      // Redirect to login page
      setTimeout(() => {
        setLocation('/wallet-login');
      }, 2000);

    } catch (error: any) {

      toast({
        title: "Reset Failed",
        description: error.message || "Unable to reset password",
        variant: "destructive"
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto pt-20">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full w-fit mx-auto mb-4">
              <Shield className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Account Recovery
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {step === 1 ? 'Verify your identity with a private key' : 'Set your new password'}
            </p>
          </div>

          {step === 1 ? (
            <div className="space-y-6">
              {/* Handle Input */}
              <div>
                <Label htmlFor="handle" className="block text-sm font-medium mb-2">
                  Wallet Handle
                </Label>
                <Input
                  id="handle"
                  type="text"
                  placeholder="Enter your @handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace('@', ''))}
                  className="w-full"
                />
              </div>

              {/* Chain Selection */}
              <div>
                <Label className="block text-sm font-medium mb-3">
                  Select Blockchain
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {chainOptions.map((chain) => (
                    <button
                      key={chain.value}
                      onClick={() => setSelectedChain(chain.value as any)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedChain === chain.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{chain.icon}</span>
                        <span className="font-medium text-sm">{chain.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Private Key Input */}
              <div>
                <Label htmlFor="privateKey" className="block text-sm font-medium mb-2">
                  {selectedChain} Private Key
                </Label>
                <Input
                  id="privateKey"
                  type="password"
                  placeholder={chainOptions.find(c => c.value === selectedChain)?.placeholder}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value.trim())}
                  className="w-full font-mono text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter the private key for any of your blockchain wallets
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                      Security Notice
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                      Your private key is only used to verify ownership and will not be stored
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleVerifyPrivateKey}
                disabled={isRecovering || !handle || !privateKey}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Verify Private Key
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-green-800 dark:text-green-200 font-medium">
                      Identity Verified
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-sm">
                      Welcome back @{handle}! Set your new password below.
                    </p>
                  </div>
                </div>
              </div>

              {/* New Password */}
              <div>
                <Label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                  New Master Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                )}
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={isRecovering || !newPassword || newPassword !== confirmPassword}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="text-center mt-6">
            <button
              onClick={() => setLocation('/wallet-login')}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
