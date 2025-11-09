/**
 * Project Authentication Setup
 * Configures authentication settings for a newly claimed project
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Lock, 
  Wallet, 
  Clock,
  Users,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Types
interface Project {
  id: string;
  name: string;
  vanity_slug?: string;
  ownerWalletAddress: string;
  issuer_wallet?: string;
  chain?: string;
}

// Validation schema
const authSetupSchema = z.object({
  authType: z.enum(['password', 'wallet_signature', 'hybrid']),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  confirmPassword: z.string().optional(),
  walletSignatureRequired: z.boolean().default(true),
  allowedWalletAddresses: z.string().optional(),
  sessionTimeoutMinutes: z.number().min(15).max(480).default(120),
  maxConcurrentSessions: z.number().min(1).max(10).default(3),
  twoFactorEnabled: z.boolean().default(false),
}).refine((data) => {
  if ((data.authType === 'password' || data.authType === 'hybrid') && data.password) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.authType === 'password' || data.authType === 'hybrid') {
    return data.password && data.password.length >= 8;
  }
  return true;
}, {
  message: "Password is required for this authentication method",
  path: ["password"],
});

// Props
interface ProjectAuthSetupProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSuccess: () => void;
}

export default function ProjectAuthSetup({ isOpen, onClose, project, onSuccess }: ProjectAuthSetupProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof authSetupSchema>>({
    resolver: zodResolver(authSetupSchema),
    defaultValues: {
      authType: 'hybrid',
      password: '',
      confirmPassword: '',
      walletSignatureRequired: true,
      allowedWalletAddresses: '',
      sessionTimeoutMinutes: 120,
      maxConcurrentSessions: 3,
      twoFactorEnabled: false,
    }
  });

  const authType = form.watch('authType');
  const sessionTimeout = form.watch('sessionTimeoutMinutes');

  // Setup mutation
  const { mutate: setupAuth, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof authSetupSchema>) => {
      const payload = {
        projectId: project.id,
        authType: data.authType,
        password: data.password,
        walletSignatureRequired: data.walletSignatureRequired,
        allowedWalletAddresses: data.allowedWalletAddresses 
          ? data.allowedWalletAddresses.split(',').map(addr => addr.trim()).filter(Boolean)
          : [],
        sessionTimeoutMinutes: data.sessionTimeoutMinutes,
        maxConcurrentSessions: data.maxConcurrentSessions,
      };

      const response = await apiRequest('/api/projects/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      return result as { success: boolean; authConfigId: string };
    },
    onSuccess: (data) => {
      toast({
        title: "Authentication Setup Complete",
        description: "Project authentication has been configured successfully.",
      });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to configure project authentication",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof authSetupSchema>) => {
    setupAuth(data);
  };

  const getPasswordStrength = (password: string): { score: number; feedback: string; color: string } => {
    let score = 0;
    let feedback = "Very weak";
    let color = "red";

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
      feedback = "Weak";
      color = "red";
    } else if (score <= 4) {
      feedback = "Good";
      color = "yellow";
    } else {
      feedback = "Strong";
      color = "green";
    }

    return { score: Math.min(score, 6), feedback, color };
  };

  const passwordStrength = form.watch('password') ? getPasswordStrength(form.watch('password')) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="project-auth-setup">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <div>
              <DialogTitle>Set Up Project Authentication</DialogTitle>
              <DialogDescription>
                Configure secure access for <span className="font-medium">{project.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-mono text-sm">{project.ownerWalletAddress}</span>
                </div>
                {project.vanity_slug && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL:</span>
                    <span className="text-blue-600">riddle.app/{project.vanity_slug}</span>
                  </div>
                )}
                {project.chain && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain:</span>
                    <Badge variant="outline">{project.chain.toUpperCase()}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Authentication Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Authentication Method
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to authenticate for project access
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="authType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="space-y-4"
                          >
                            <div className="flex items-start space-x-3 p-4 border rounded-lg">
                              <RadioGroupItem value="password" id="password" className="mt-1" />
                              <div className="space-y-2 flex-1">
                                <label htmlFor="password" className="font-medium cursor-pointer flex items-center gap-2">
                                  <Lock className="h-4 w-4" />
                                  Password Only
                                </label>
                                <p className="text-sm text-muted-foreground">
                                  Use a secure password for authentication. Simple and familiar.
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-start space-x-3 p-4 border rounded-lg">
                              <RadioGroupItem value="wallet_signature" id="wallet" className="mt-1" />
                              <div className="space-y-2 flex-1">
                                <label htmlFor="wallet" className="font-medium cursor-pointer flex items-center gap-2">
                                  <Wallet className="h-4 w-4" />
                                  Wallet Signature Only
                                </label>
                                <p className="text-sm text-muted-foreground">
                                  Sign messages with your wallet for maximum security. No password needed.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start space-x-3 p-4 border rounded-lg border-blue-200 bg-blue-50">
                              <RadioGroupItem value="hybrid" id="hybrid" className="mt-1" />
                              <div className="space-y-2 flex-1">
                                <label htmlFor="hybrid" className="font-medium cursor-pointer flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-blue-600" />
                                  Hybrid (Recommended)
                                </label>
                                <p className="text-sm text-muted-foreground">
                                  Combine password and wallet signature for the highest security.
                                </p>
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                  Most Secure
                                </Badge>
                              </div>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Password Configuration */}
              {(authType === 'password' || authType === 'hybrid') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Password Setup
                    </CardTitle>
                    <CardDescription>
                      Create a strong password for your project
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter a strong password"
                                data-testid="setup-password-input"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          {passwordStrength && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all bg-${passwordStrength.color}-500`}
                                    style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-medium text-${passwordStrength.color}-600`}>
                                  {passwordStrength.feedback}
                                </span>
                              </div>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your password"
                                data-testid="setup-confirm-password-input"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Wallet Configuration */}
              {(authType === 'wallet_signature' || authType === 'hybrid') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Wallet Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure wallet-based authentication settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="walletSignatureRequired"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Require Wallet Signature
                            </FormLabel>
                            <FormDescription>
                              Always require wallet signature for authentication
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowedWalletAddresses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Authorized Wallets (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter wallet addresses separated by commas"
                              data-testid="allowed-wallets-input"
                            />
                          </FormControl>
                          <FormDescription>
                            Your primary wallet ({project.ownerWalletAddress}) is always authorized.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Session Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Session Settings
                  </CardTitle>
                  <CardDescription>
                    Configure session timeout and concurrency limits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="sessionTimeoutMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Session Timeout (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={15}
                            max={480}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="session-timeout-input"
                          />
                        </FormControl>
                        <FormDescription>
                          Sessions will automatically expire after {sessionTimeout} minutes of inactivity.
                          Maximum: 8 hours (480 minutes)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxConcurrentSessions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Concurrent Sessions</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={10}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="max-sessions-input"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum number of active sessions allowed simultaneously
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Security Notice */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Notice:</strong> Your project will be protected by industry-standard security measures including
                  rate limiting, secure session management, and audit logging. You can modify these settings later.
                </AlertDescription>
              </Alert>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={onClose} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} data-testid="setup-auth-button">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting Up...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
