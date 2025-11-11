import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Paper,
  Divider,
  IconButton,
  InputAdornment,
  Alert,
  Slider,
  Grid,
  Link as MuiLink
} from '@mui/material';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/utils/sessionManager';
import { SessionRenewalModal } from '@/components/SessionRenewalModal';
import { 
  Person as User, 
  Security as Shield, 
  Notifications as Bell, 
  Palette, 
  Storage as Database,
  Visibility as Eye,
  VisibilityOff as EyeOff,
  Save,
  Lock,
  Shortcut as ShortcutsIcon
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const session = useSession();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  
  const [settings, setSettings] = useState({
    displayName: localStorage.getItem('displayName') || '',
    email: localStorage.getItem('email') || '',
    timezone: localStorage.getItem('timezone') || 'UTC',
    twoFactorEnabled: localStorage.getItem('twoFactorEnabled') === 'true',
    sessionTimeout: localStorage.getItem('sessionTimeout') || '30',
    requirePasswordForPayments: localStorage.getItem('requirePasswordForPayments') === 'true',
    autoLogoutMinutes: parseInt(localStorage.getItem('autoLogoutMinutes') || '30', 10),
    emailNotifications: localStorage.getItem('emailNotifications') !== 'false',
    pushNotifications: localStorage.getItem('pushNotifications') !== 'false',
    tradeAlerts: localStorage.getItem('tradeAlerts') !== 'false',
    theme: localStorage.getItem('theme') || 'system',
    language: localStorage.getItem('language') || 'en',
    currency: localStorage.getItem('currency') || 'USD',
    apiKey: localStorage.getItem('apiKey') || '',
    rpcEndpoint: localStorage.getItem('rpcEndpoint') || 'https://xrplcluster.com',
  });

  useEffect(() => {
    if ((session as any).needsRenewal) {
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);

  const handleSave = (section: string) => {
    Object.entries(settings).forEach(([key, value]) => {
      localStorage.setItem(key, value.toString());
    });

    toast({
      title: "Settings Saved",
      description: `${section} settings have been updated successfully.`,
    });
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ bgcolor: '#0a0118', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
            Settings
          </Typography>
          <Typography variant="body1" sx={{ color: '#9ca3af' }}>
            Manage your account preferences and application settings
          </Typography>
        </Box>

        <Paper sx={{ bgcolor: '#1a1625', borderRadius: 2 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': { color: '#9ca3af', minHeight: 64 },
              '& .Mui-selected': { color: '#3b82f6' }
            }}
          >
            <Tab icon={<User />} label="Profile" iconPosition="start" />
            <Tab icon={<Shield />} label="Security" iconPosition="start" />
            <Tab icon={<Bell />} label="Notifications" iconPosition="start" />
            <Tab icon={<Palette />} label="Appearance" iconPosition="start" />
            <Tab icon={<ShortcutsIcon />} label="Shortcuts" iconPosition="start" />
            <Tab icon={<Database />} label="API" iconPosition="start" />
          </Tabs>

          {/* Profile Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ px: 3 }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <User /> Profile Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Display Name"
                    value={settings.displayName}
                    onChange={(e) => updateSetting('displayName', e.target.value)}
                    sx={{ 
                      '& .MuiInputLabel-root': { color: '#9ca3af' },
                      '& .MuiOutlinedInput-root': { color: 'white' }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email Address"
                    value={settings.email}
                    onChange={(e) => updateSetting('email', e.target.value)}
                    sx={{ 
                      '& .MuiInputLabel-root': { color: '#9ca3af' },
                      '& .MuiOutlinedInput-root': { color: 'white' }
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#9ca3af' }}>Timezone</InputLabel>
                    <Select
                      value={settings.timezone}
                      onChange={(e) => updateSetting('timezone', e.target.value)}
                      label="Timezone"
                      sx={{ color: 'white' }}
                    >
                      <MenuItem value="UTC">UTC</MenuItem>
                      <MenuItem value="America/New_York">Eastern Time</MenuItem>
                      <MenuItem value="America/Chicago">Central Time</MenuItem>
                      <MenuItem value="America/Denver">Mountain Time</MenuItem>
                      <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                      <MenuItem value="Europe/London">London</MenuItem>
                      <MenuItem value="Europe/Paris">Paris</MenuItem>
                      <MenuItem value="Asia/Tokyo">Tokyo</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    startIcon={<Save />}
                    onClick={() => handleSave('Profile')}
                    sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
                  >
                    Save Profile Settings
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Security Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ px: 3 }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Shield /> Security Settings
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                Configure security settings to protect your account and transactions
              </Alert>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.requirePasswordForPayments}
                      onChange={(e) => updateSetting('requirePasswordForPayments', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3b82f6' }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        <Lock sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                        Require Password for Payments
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Always prompt for your password before swaps, trades, NFT purchases, and wagers
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Divider sx={{ my: 3, borderColor: '#374151' }} />

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.twoFactorEnabled}
                      onChange={(e) => updateSetting('twoFactorEnabled', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3b82f6' }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        Two-Factor Authentication
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Add an extra layer of security to your account
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Divider sx={{ my: 3, borderColor: '#374151' }} />

              <Box sx={{ mb: 3 }}>
                <Typography sx={{ color: 'white', fontWeight: 500, mb: 2 }}>
                  Auto-Logout Timer: {settings.autoLogoutMinutes} minutes
                </Typography>
                <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
                  Automatically log out after period of inactivity
                </Typography>
                <Slider
                  value={settings.autoLogoutMinutes}
                  onChange={(e, value) => updateSetting('autoLogoutMinutes', value)}
                  min={5}
                  max={480}
                  step={5}
                  marks={[
                    { value: 5, label: '5m' },
                    { value: 30, label: '30m' },
                    { value: 60, label: '1h' },
                    { value: 120, label: '2h' },
                    { value: 480, label: '8h' }
                  ]}
                  valueLabelDisplay="auto"
                  sx={{
                    color: '#3b82f6',
                    '& .MuiSlider-markLabel': { color: '#9ca3af' }
                  }}
                />
              </Box>

              <Divider sx={{ my: 3, borderColor: '#374151' }} />

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel sx={{ color: '#9ca3af' }}>Session Timeout</InputLabel>
                <Select
                  value={settings.sessionTimeout}
                  onChange={(e) => updateSetting('sessionTimeout', e.target.value)}
                  label="Session Timeout"
                  sx={{ color: 'white' }}
                >
                  <MenuItem value="15">15 minutes</MenuItem>
                  <MenuItem value="30">30 minutes</MenuItem>
                  <MenuItem value="60">1 hour</MenuItem>
                  <MenuItem value="120">2 hours</MenuItem>
                  <MenuItem value="480">8 hours</MenuItem>
                </Select>
              </FormControl>

              <Button 
                variant="contained" 
                fullWidth 
                startIcon={<Save />}
                onClick={() => handleSave('Security')}
                sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
              >
                Save Security Settings
              </Button>
            </Box>
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ px: 3 }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Bell /> Notification Preferences
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.emailNotifications}
                      onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3b82f6' }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        Email Notifications
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Receive notifications via email
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.pushNotifications}
                      onChange={(e) => updateSetting('pushNotifications', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3b82f6' }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        Push Notifications
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Receive push notifications in your browser
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.tradeAlerts}
                      onChange={(e) => updateSetting('tradeAlerts', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3b82f6' }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        Trade Alerts
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Get notified about trading opportunities and price changes
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Button 
                variant="contained" 
                fullWidth 
                startIcon={<Save />}
                onClick={() => handleSave('Notifications')}
                sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
              >
                Save Notification Settings
              </Button>
            </Box>
          </TabPanel>

          {/* Appearance Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ px: 3 }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Palette /> Appearance & Display
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#9ca3af' }}>Theme</InputLabel>
                    <Select
                      value={settings.theme}
                      onChange={(e) => updateSetting('theme', e.target.value)}
                      label="Theme"
                      sx={{ color: 'white' }}
                    >
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                      <MenuItem value="system">System</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#9ca3af' }}>Language</InputLabel>
                    <Select
                      value={settings.language}
                      onChange={(e) => updateSetting('language', e.target.value)}
                      label="Language"
                      sx={{ color: 'white' }}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Spanish</MenuItem>
                      <MenuItem value="fr">French</MenuItem>
                      <MenuItem value="de">German</MenuItem>
                      <MenuItem value="ja">Japanese</MenuItem>
                      <MenuItem value="ko">Korean</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#9ca3af' }}>Default Currency</InputLabel>
                    <Select
                      value={settings.currency}
                      onChange={(e) => updateSetting('currency', e.target.value)}
                      label="Default Currency"
                      sx={{ color: 'white' }}
                    >
                      <MenuItem value="USD">USD - US Dollar</MenuItem>
                      <MenuItem value="EUR">EUR - Euro</MenuItem>
                      <MenuItem value="GBP">GBP - British Pound</MenuItem>
                      <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
                      <MenuItem value="BTC">BTC - Bitcoin</MenuItem>
                      <MenuItem value="ETH">ETH - Ethereum</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    startIcon={<Save />}
                    onClick={() => handleSave('Appearance')}
                    sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
                  >
                    Save Appearance Settings
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Shortcuts Tab */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ px: 3 }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShortcutsIcon /> Quick Access Shortcuts
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                Quick links to frequently used pages
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: '#111827', border: '1px solid #374151' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>Gaming</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <MuiLink href="/gaming-dashboard-v3" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Gaming Dashboard
                        </MuiLink>
                        <MuiLink href="/gaming-battles" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Battles
                        </MuiLink>
                        <MuiLink href="/gaming-profile" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Gaming Profile
                        </MuiLink>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: '#111827', border: '1px solid #374151' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>Trading</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <MuiLink href="/trading-dashboard" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Trading Dashboard
                        </MuiLink>
                        <MuiLink href="/trade-v3" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Swap & Trade
                        </MuiLink>
                        <MuiLink href="/trading-desk" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Trading Desk
                        </MuiLink>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: '#111827', border: '1px solid #374151' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>Wallet</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <MuiLink href="/create-wallet" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Create Wallet
                        </MuiLink>
                        <MuiLink href="/wallet-login" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Login to Wallet
                        </MuiLink>
                        <MuiLink href="/portfolio" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Portfolio
                        </MuiLink>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: '#111827', border: '1px solid #374151' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>NFTs</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <MuiLink href="/gaming-nfts" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          Gaming NFTs
                        </MuiLink>
                        <MuiLink href="/nft-marketplace" sx={{ color: '#3b82f6', textDecoration: 'none' }}>
                          NFT Marketplace
                        </MuiLink>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* API Tab */}
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ px: 3 }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Database /> API Configuration
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="API Key"
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => updateSetting('apiKey', e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end">
                          {showApiKey ? <EyeOff /> : <Eye />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ 
                    '& .MuiInputLabel-root': { color: '#9ca3af' },
                    '& .MuiOutlinedInput-root': { color: 'white' }
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="RPC Endpoint"
                  value={settings.rpcEndpoint}
                  onChange={(e) => updateSetting('rpcEndpoint', e.target.value)}
                  sx={{ 
                    '& .MuiInputLabel-root': { color: '#9ca3af' },
                    '& .MuiOutlinedInput-root': { color: 'white' }
                  }}
                />
              </Box>

              <Button 
                variant="contained" 
                fullWidth 
                startIcon={<Save />}
                onClick={() => handleSave('API')}
                sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
              >
                Save API Settings
              </Button>
            </Box>
          </TabPanel>
        </Paper>

        <SessionRenewalModal 
          open={showRenewalModal}
          onOpenChange={setShowRenewalModal}
        />
      </Container>
    </Box>
  );
};

export default SettingsPage;
