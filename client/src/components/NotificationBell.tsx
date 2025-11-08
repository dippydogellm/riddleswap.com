import { useState, useEffect } from 'react';
import { Bell, MessageCircle, Smartphone } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  IconButton, 
  Badge, 
  Popover, 
  List, 
  ListItemButton, 
  Typography, 
  Box, 
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button as MuiButton,
  Divider
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { pushNotificationService } from '@/services/push-notification-service';
import { Capacitor } from '@capacitor/core';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [platform, setPlatform] = useState<string>('web');
  const [isNative, setIsNative] = useState<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const open = Boolean(anchorEl);

  useEffect(() => {
    const initNotifications = async () => {
      const currentPlatform = Capacitor.getPlatform();
      const isNativeApp = Capacitor.isNativePlatform();
      setPlatform(currentPlatform);
      setIsNative(isNativeApp);
      await pushNotificationService.initialize();
      const hasPermission = await pushNotificationService.areNotificationsEnabled();
      if (!hasPermission) {
        setTimeout(() => setShowPermissionDialog(true), 3000);
      }
    };
    initNotifications();
  }, []);

  const requestNotificationPermission = async () => {
    const granted = await pushNotificationService.requestPermission();
    if (granted) {
      const platformName = platform === 'ios' ? 'iPhone' : platform === 'android' ? 'Android' : 'Desktop';
  toast({ title: 'Notifications enabled!', description: `You'll receive push notifications on your ${platformName}.` });
    } else {
      toast({ title: 'Notifications disabled', description: 'You can enable them later in settings.', variant: 'destructive' });
    }
    setShowPermissionDialog(false);
  };

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  const { data: notificationsData, isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await apiRequest('/api/notifications?limit=20', { method: 'GET' });
      const data = await response.json() as any;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      if (data && Array.isArray(data.notifications)) return data.notifications;
      return [];
    },
    enabled: open,
  });

  const notifications = notificationsData || [];

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
  return apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      toast({ title: 'All notifications marked as read' });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    setAnchorEl(null);
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      message: '', mention: '@', like: '', comment: '', follow: '',
      call_incoming: '', call_missed: '', system: 'ℹ'
    };
    return icons[type] || '';
  };

  return (
    <>
      <Dialog open={showPermissionDialog} onClose={() => setShowPermissionDialog(false)} maxWidth='sm' fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isNative ? <Smartphone className='w-5 h-5' /> : <Bell className='w-5 h-5' />}
          <span>Enable {isNative ? 'Push' : ''} Notifications?</span>
        </DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            Get instant notifications for new messages, mentions, and important updates.
          </Typography>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setShowPermissionDialog(false)}>Not Now</MuiButton>
          <MuiButton onClick={requestNotificationPermission} variant='contained'>Enable</MuiButton>
        </DialogActions>
      </Dialog>

      <IconButton size='small' onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge badgeContent={unreadCount > 9 ? '9+' : unreadCount} color='error'>
          <Bell className='w-5 h-5' />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 384, maxHeight: '80vh' } }}
      >
        <Box sx={{ p: 2, background: 'linear-gradient(to right, #2563eb, #9333ea)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant='h6' fontWeight='bold'>Notifications</Typography>
          {unreadCount > 0 && (
            <MuiButton size='small' onClick={() => markAllAsReadMutation.mutate()} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
              Mark all read
            </MuiButton>
          )}
        </Box>

        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {isLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ mb: 1 }} />
              <Typography variant='body2' color='text.secondary'>Loading...</Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Bell className='w-16 h-16 opacity-30 mx-auto mb-2' style={{ color: '#9ca3af' }} />
              <Typography variant='body1' fontWeight='medium'>No notifications yet</Typography>
              <Typography variant='body2' color='text.secondary'>You're all caught up!</Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification) => (
                <ListItemButton
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    p: 2,
                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                    borderLeft: notification.isRead ? 'none' : '4px solid',
                    borderLeftColor: 'primary.main'
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
                    <Typography sx={{ fontSize: '2rem', flexShrink: 0 }}>{getNotificationIcon(notification.type)}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant='body2' fontWeight='semibold'>{notification.title}</Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {notification.content}
                      </Typography>
                      <Typography variant='caption' color='primary' fontWeight='medium'>
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </Typography>
                    </Box>
                    {!notification.isRead && (
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0, mt: 0.5 }} />
                    )}
                  </Box>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        <Divider />
        <Box sx={{ p: 1.5 }}>
          <MuiButton fullWidth size='small' startIcon={<MessageCircle className='w-4 h-4' />} onClick={() => { window.location.href = '/messaging'; setAnchorEl(null); }}>
            Go to Messages
          </MuiButton>
        </Box>
      </Popover>
    </>
  );
}
