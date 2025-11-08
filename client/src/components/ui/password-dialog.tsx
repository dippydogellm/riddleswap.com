import React, { useState, useEffect } from 'react';
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
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Check if we have a saved password
      const savedPassword = sessionStorage.getItem('riddle_temp_password');
      if (savedPassword) {
        setPassword(savedPassword);
        setSavePassword(true);
      } else {
        setPassword('');
        setSavePassword(false);
      }
      setShowPassword(false);
      setInternalLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (password.trim() && !internalLoading) {
      setInternalLoading(true);
      try {
        // Save password if checkbox is checked
        if (savePassword) {
          sessionStorage.setItem('riddle_temp_password', password);
        } else {
          sessionStorage.removeItem('riddle_temp_password');
        }
        await onConfirm(password);
        setPassword('');
        setInternalLoading(false);
      } catch (error) {

        setInternalLoading(false);
        // Don't clear password on error so user can try again
      }
    }
  };

  const handleCancel = () => {
    setPassword('');
    setInternalLoading(false);
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !internalLoading) {
      handleConfirm();
    }
  };

  const isProcessing = internalLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your wallet password"
                className="pr-10"
                autoFocus
                disabled={isProcessing}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isProcessing}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="savePassword"
              checked={savePassword}
              onChange={(e) => setSavePassword(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <Label htmlFor="savePassword" className="text-sm text-gray-600 dark:text-gray-400">
              Remember password for this session
            </Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!password.trim() || isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
