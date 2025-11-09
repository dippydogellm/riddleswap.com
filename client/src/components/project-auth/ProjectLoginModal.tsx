/**
 * Project Login Modal
 * Provides secure authentication for project owners
 */

import { useState, useEffect } from 'react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Lock, 
  Wallet, 
  Eye, 
  EyeOff, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  Clock,
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
  status: string;
}

interface ProjectAuth {
  id: string;
  auth_type: 'password' | 'wallet_signature' | 'hybrid';
  wallet_signature_required: boolean;
  session_timeout_minutes: number;
  two_factor_enabled: boolean;
  lockout_until?: string;
  failed_login_attempts: number;
}

// Validation schemas
const passwordLoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const walletLoginSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  signature: z.string().min(1, "Signature is required"),
  nonce: z.string().min(1, "Nonce is required"),
  chain: z.string().min(1, "Chain is required"),
});

// Props
interface ProjectLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSuccess: (sessionData: any) => void;
}

interface WalletAuthState {
  nonce?: string;
  message?: string;
  expiresAt?: string;
  step: 'generate' | 'sign' | 'verify';
}

export default function ProjectLoginModal({ isOpen, onClose, project, onSuccess }: ProjectLoginModalProps) {
  const { toast } = useToast();
  const [authMethod, setAuthMethod] = useState<'password' | 'wallet' | 'hybrid'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [projectAuth, setProjectAuth] = useState<ProjectAuth | null>(null);
  const [walletAuthState, setWalletAuthState] = useState<WalletAuthState>({ step: 'generate' });
  const [sessionProgress, setSessionProgress] = useState(0);

  // Forms
  const passwordForm = useForm<z.infer<typeof passwordLoginSchema>>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { password: '' }
  });

  const walletForm = useForm<z.infer<typeof walletLoginSchema>>({
    resolver: zodResolver(walletLoginSchema),
    defaultValues: {
      walletAddress: '',
      signature: '',
      nonce: '',
      chain: project.chain || 'xrp'
    }
  });

  // Load project auth configuration
  const { mutate: fetchAuthConfig } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/auth/config/${project.id}`);
      const result = await response.json();
      return result as { auth: ProjectAuth };
    },
    onSuccess: (data) => {
      setProjectAuth(data.auth);
      setAuthMethod(data.auth.auth_type === 'hybrid' ? 'password' : (data.auth.auth_type === 'wallet_signature' ? 'wallet' : 'password'));
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Error",
        description: error.message || "Failed to load project authentication settings",
        variant: "destructive",
      });
    },
  });

  // Generate wallet nonce
  const { mutate: generateNonce, isPending: generatingNonce } = useMutation({
    mutationFn: async (data: { walletAddress: string; chain: string }) => {
      const response = await apiRequest('/api/auth-nonce', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: data.walletAddress,
          chain: data.chain,
          walletType: 'metamask' // Default, could be dynamic
        })
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setWalletAuthState({
        step: 'sign',
        nonce: data.nonce,
        message: data.message,
        expiresAt: data.expiresAt
      });
      walletForm.setValue('nonce', data.nonce);
      toast({
        title: "Nonce Generated",
        description: "Please sign the message with your wallet",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Nonce Generation Failed",
        description: error.message || "Failed to generate authentication nonce",
        variant: "destructive",
      });
    },
  });

  // Login mutations
  const { mutate: loginWithPassword, isPending: passwordLogging } = useMutation({
    mutationFn: async (data: z.infer<typeof passwordLoginSchema>) => {
      const response = await apiRequest(`/api/projects/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          loginMethod: 'password',
          password: data.password,
          ipAddress: '', // Will be set by backend
          userAgent: navigator.userAgent
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      return result as { sessionToken: string; expiresAt: string; sessionTimeoutMinutes: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Login Successful",
        description: `Welcome back! Session expires in ${Math.floor(data.sessionTimeoutMinutes / 60)} hours.`,
      });
      onSuccess(data);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const { mutate: loginWithWallet, isPending: walletLogging } = useMutation({
    mutationFn: async (data: z.infer<typeof walletLoginSchema>) => {
      const response = await apiRequest(`/api/projects/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          loginMethod: 'wallet_signature',
          walletAddress: data.walletAddress,
          signature: data.signature,
          nonce: data.nonce,
          chain: data.chain,
          ipAddress: '', // Will be set by backend
          userAgent: navigator.userAgent
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      return result as { sessionToken: string; expiresAt: string; sessionTimeoutMinutes: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Login Successful",
        description: `Wallet authentication successful! Session expires in ${Math.floor(data.sessionTimeoutMinutes / 60)} hours.`,
      });
      onSuccess(data);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Wallet Login Failed",
        description: error.message || "Signature verification failed",
        variant: "destructive",
      });
      setWalletAuthState({ step: 'generate' });
    },
  });

  // Load auth configuration when modal opens
  useEffect(() => {
    if (isOpen && project.id) {
      fetchAuthConfig();
    }
  }, [isOpen, project.id]);

  // Session timeout progress
  useEffect(() => {
    if (projectAuth && isOpen) {
      const interval = setInterval(() => {
        // This is just for demo - in real implementation, you'd track actual session time
        setSessionProgress(prev => Math.min(prev + 2, 100));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [projectAuth, isOpen]);

  // Handle password login
  const handlePasswordLogin = (data: z.infer<typeof passwordLoginSchema>) => {
    loginWithPassword(data);
  };

  // Handle wallet login
  const handleWalletLogin = (data: z.infer<typeof walletLoginSchema>) => {
    loginWithWallet(data);
  };

  // Request wallet signature (placeholder - would integrate with actual wallet)
  const requestWalletSignature = async () => {
    if (!walletAuthState.message || !walletForm.getValues('walletAddress')) {
      toast({
        title: "Wallet Required",
        description: "Please enter your wallet address first",
        variant: "destructive",
      });
      return;
    }

    // This is a placeholder - in real implementation, you'd integrate with wallet providers
    toast({
      title: "Wallet Signature Required",
      description: "Please sign the message in your wallet to complete authentication",
    });

    // For demo purposes, simulate signature
    setTimeout(() => {
      walletForm.setValue('signature', 'demo_signature_placeholder');
      setWalletAuthState(prev => ({ ...prev, step: 'verify' }));
    }, 2000);
  };

  if (!projectAuth) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading authentication settings...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isLocked = projectAuth.lockout_until && new Date(projectAuth.lockout_until) > new Date();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="project-login-modal">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <div>
              <DialogTitle>Project Authentication</DialogTitle>
              <DialogDescription>
                Sign in to manage <span className="font-medium">{project.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLocked && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Account is temporarily locked due to multiple failed attempts. 
              Try again after {new Date(projectAuth.lockout_until!).toLocaleTimeString()}.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Project Info */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium">{project.name}</p>
              <p className="text-sm text-muted-foreground">
                {project.vanity_slug ? `riddle.app/${project.vanity_slug}` : project.id}
              </p>
            </div>
            <Badge variant="outline" className={`${
              project.status === 'active' ? 'border-green-500 text-green-600' : 'border-gray-500 text-gray-600'
            }`}>
              {project.status}
            </Badge>
          </div>

          {/* Authentication Methods */}
          {projectAuth && !isLocked && (
            <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as any)}>
              <TabsList className="grid w-full grid-cols-2">
                {(projectAuth.auth_type === 'password' || projectAuth.auth_type === 'hybrid') && (
                  <TabsTrigger value="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password
                  </TabsTrigger>
                )}
                {(projectAuth.auth_type === 'wallet_signature' || projectAuth.auth_type === 'hybrid') && (
                  <TabsTrigger value="wallet" className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Wallet
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Password Login */}
              <TabsContent value="password">
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handlePasswordLogin)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your project password"
                                disabled={passwordLogging}
                                data-testid="password-input"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="toggle-password-visibility"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={passwordLogging}
                      data-testid="password-login-button"
                    >
                      {passwordLogging ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Sign In with Password
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              {/* Wallet Login */}
              <TabsContent value="wallet">
                <Form {...walletForm}>
                  <form onSubmit={walletForm.handleSubmit(handleWalletLogin)} className="space-y-4">
                    <FormField
                      control={walletForm.control}
                      name="walletAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wallet Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={`Enter your ${project.chain?.toUpperCase() || 'wallet'} address`}
                              disabled={generatingNonce || walletLogging}
                              data-testid="wallet-address-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {walletAuthState.step === 'generate' && (
                      <Button 
                        type="button"
                        className="w-full"
                        onClick={() => {
                          const walletAddress = walletForm.getValues('walletAddress');
                          const chain = walletForm.getValues('chain');
                          if (walletAddress) {
                            generateNonce({ walletAddress, chain });
                          }
                        }}
                        disabled={generatingNonce || !walletForm.getValues('walletAddress')}
                        data-testid="generate-nonce-button"
                      >
                        {generatingNonce ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Challenge...
                          </>
                        ) : (
                          <>
                            <Wallet className="mr-2 h-4 w-4" />
                            Generate Authentication Challenge
                          </>
                        )}
                      </Button>
                    )}

                    {walletAuthState.step === 'sign' && (
                      <div className="space-y-4">
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            Challenge expires at {walletAuthState.expiresAt && new Date(walletAuthState.expiresAt).toLocaleTimeString()}
                          </AlertDescription>
                        </Alert>
                        
                        <div className="p-3 bg-gray-50 rounded text-sm font-mono break-all">
                          {walletAuthState.message}
                        </div>

                        <Button 
                          type="button"
                          className="w-full"
                          onClick={requestWalletSignature}
                          data-testid="sign-message-button"
                        >
                          <Wallet className="mr-2 h-4 w-4" />
                          Sign Message
                        </Button>
                      </div>
                    )}

                    {walletAuthState.step === 'verify' && (
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={walletLogging}
                        data-testid="wallet-login-button"
                      >
                        {walletLogging ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying Signature...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Complete Authentication
                          </>
                        )}
                      </Button>
                    )}
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          )}

          {/* Security Info */}
          {projectAuth && (
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-center justify-between">
                <span>Session Timeout:</span>
                <span>{projectAuth.session_timeout_minutes} minutes</span>
              </div>
              {projectAuth.failed_login_attempts > 0 && (
                <div className="flex items-center justify-between">
                  <span>Failed Attempts:</span>
                  <span className="text-orange-600">{projectAuth.failed_login_attempts}/5</span>
                </div>
              )}
              {projectAuth.two_factor_enabled && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span>Two-factor authentication enabled</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
