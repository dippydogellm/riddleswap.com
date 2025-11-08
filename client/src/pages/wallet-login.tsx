import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { WalletConnectionDashboard } from "@/components/wallet-connection-dashboard";
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import HomeIcon from '@mui/icons-material/Home';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AccountCircle from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';

export default function WalletLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [handle, setHandle] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [existingSession, setExistingSession] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const sessionData = sessionStorage.getItem('riddle_wallet_session');
      let sessionToken = localStorage.getItem('sessionToken');

      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          if (session.handle && session.sessionToken) {
            sessionToken = session.sessionToken;
          }
        } catch (error) {
          sessionStorage.removeItem('riddle_wallet_session');
          return;
        }
      }

      if (sessionToken) {
        try {
          const response = await fetch('/api/riddle-wallet/session', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
              setExistingSession(data);
              setLocation('/wallet-dashboard');
              return;
            }
          }
        } catch (error) {
          console.error('Session check failed:', error);
        }

        // If invalid, clear storage
        sessionStorage.removeItem('riddle_wallet_session');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('riddle_session_token');
      }
    };

    checkSession();
  }, [setLocation]);

  const handleLogin = async () => {
    if (!handle.trim()) {
      toast({ title: 'Handle Required', description: 'Please enter your @riddle handle', variant: 'destructive' });
      return;
    }
    if (!masterPassword) {
      toast({ title: 'Password Required', description: 'Please enter your master password', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, masterPassword })
      });

      const data = await loginResponse.json();
      if (loginResponse.ok && data.success) {
        const sessionData = {
          handle,
          username: handle,
          walletId: data.walletData?.handle || handle,
          sessionToken: data.sessionToken,
          loginTime: new Date().toISOString(),
          expiresAt: new Date(data.expiresAt).toISOString(),
          autoLogoutEnabled: true,
          autoLogoutMinutes: 30,
          lastActivity: new Date().toISOString(),
          linkedWalletAddress: data.walletData?.linkedWalletAddress,
          walletAddresses: {
            xrpAddress: data.walletData?.xrpAddress,
            ethAddress: data.walletData?.ethAddress,
            solAddress: data.walletData?.solAddress,
            btcAddress: data.walletData?.btcAddress
          },
          linkedWalletChain: data.walletData?.linkedWalletChain,
          walletData: data.walletData
        };

        const { clearAllWalletData } = await import('../lib/queryClient');
        clearAllWalletData();

        sessionStorage.setItem('riddle_wallet_session', JSON.stringify(sessionData));
        localStorage.setItem('sessionToken', data.sessionToken);
        localStorage.setItem('riddle_session_token', data.sessionToken);

        const { sessionManager } = await import('../utils/sessionManager');
        sessionManager.setSession(data.sessionToken, sessionData);

        toast({ title: 'Login Successful', description: `Welcome back, @${handle}!` });
        setLocation('/wallet-dashboard');
        return;
      }

      toast({ title: 'Login Failed', description: data.error || 'Invalid handle or password.', variant: 'destructive' });
    } catch (error) {
      toast({ title: 'Login Failed', description: 'An error occurred while logging in. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('riddle_wallet_session');
    setExistingSession(null);
    toast({ title: 'Logged Out', description: 'You have been logged out successfully' });
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        <div className="flex items-center justify-between mb-4">
          <IconButton size="small" onClick={() => setLocation('/')} aria-label="home">
            <HomeIcon />
          </IconButton>
          <WalletIcon fontSize="large" />
          <div className="w-9" />
        </div>

        <Typography variant="h4" component="h1" gutterBottom>
          Welcome Back
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Sign in to your Riddle Wallet
        </Typography>

        {existingSession && (
          <Paper variant="outlined" sx={{ p: 2, my: 2, backgroundColor: 'action.hover' }}>
            <div className="flex justify-between items-center">
              <div>
                <Typography variant="subtitle1">Already Logged In</Typography>
                <Typography variant="body2">Welcome back, @{existingSession.handle}!</Typography>
              </div>
              <div>
                <Button variant="contained" size="small" onClick={() => setLocation('/wallet-dashboard')} sx={{ mr: 1 }}>Go to Dashboard</Button>
                <Button variant="outlined" size="small" onClick={handleLogout}>Logout</Button>
              </div>
            </div>
          </Paper>
        )}

        <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <TextField
            fullWidth
            margin="normal"
            id="handle"
            label="Riddle Handle"
            placeholder="yourhandle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace('@', ''))}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircle />
                </InputAdornment>
              ),
            }}
            inputProps={{ inputMode: 'text', autoComplete: 'username' }}
          />

          <TextField
            fullWidth
            margin="normal"
            id="password"
            label="Master Password"
            placeholder="Enter your master password"
            type={showPassword ? 'text' : 'password'}
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'hide password' : 'show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{ autoComplete: 'current-password' }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            sx={{ mt: 2, mb: 1 }}
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Access Wallet'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <div className="text-center">
          <Button variant="text" onClick={() => setLocation('/external-wallets')}>Use External Wallets Instead →</Button>
          <Typography variant="caption" display="block" color="text.secondary">Connect MetaMask, Phantom, Xaman, or Joey</Typography>
        </div>

        <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          <Typography variant="h6">New to Riddle?</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>Create your secure multi-chain wallet in under 60 seconds</Typography>
          <Button variant="contained" fullWidth onClick={() => setLocation('/create-wallet')} startIcon={<WalletIcon />}>Create Your @riddle Wallet</Button>
        </Box>

        <div className="mt-2 flex justify-between items-center">
          <Button variant="text" onClick={() => setLocation('/account-recovery')}>Forgot your password? Recover account</Button>
        </div>
      </Paper>
    </Container>
  );
}
