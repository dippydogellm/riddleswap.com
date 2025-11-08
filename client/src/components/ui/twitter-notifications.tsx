import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Phone, PhoneCall, Heart, MessageCircle, UserPlus, AtSign, X, Repeat } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import { Separator } from './separator';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'call_incoming' | 'call_missed' | 'like' | 'comment' | 'follow' | 'mention' | 'retweet';
  title: string;
  content: string;
  actionUrl?: string;
  relatedId?: string;
  senderHandle?: string;
  senderName?: string;
  senderAvatar?: string;
  isRead: boolean;
  createdAt: string;
}

const notificationIcons = {
  message: MessageCircle,
  call_incoming: Phone,
  call_missed: PhoneCall,
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  retweet: Repeat
};

const notificationColors = {
  message: 'text-blue-500',
  call_incoming: 'text-green-500',
  call_missed: 'text-red-500',
  like: 'text-red-500',
  comment: 'text-blue-500',
  follow: 'text-purple-500',
  mention: 'text-orange-500',
  retweet: 'text-green-600'
};

interface TwitterNotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TwitterNotifications({ isOpen, onClose }: TwitterNotificationsProps) {
  const queryClient = useQueryClient();

  // Fetch notifications - only if authenticated
  const { data: notificationsData, isLoading } = useQuery<{ notifications: Notification[] }>({
    queryKey: ['/api/notifications'],
    enabled: isOpen,
    retry: false, // Don't retry failed requests
    refetchOnWindowFocus: false
  });

  const notifications = notificationsData?.notifications || [];

  // Fetch unread count - with error handling
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/notifications/unread-count'],
    retry: false, // Don't retry failed requests
    refetchOnWindowFocus: false,
    refetchInterval: 30000 // Only check every 30 seconds
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed top-16 right-4 w-80 max-w-sm bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
          {(unreadData?.unreadCount ?? 0) > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadData?.unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.some((n: Notification) => !n.isRead) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-96">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notification: Notification) => {
              const IconComponent = notificationIcons[notification.type];
              const iconColor = notificationColors[notification.type];
              
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors",
                    !notification.isRead && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("flex-shrink-0 mt-1", iconColor)}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {notification.content}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        {notification.senderHandle && (
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            @{notification.senderHandle}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread count with error handling
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false, // Don't retry failed requests
    refetchOnWindowFocus: false
  });

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2"
      >
        <Bell className="h-5 w-5" />
        {(unreadData?.unreadCount ?? 0) > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {(unreadData?.unreadCount ?? 0) > 99 ? '99+' : unreadData?.unreadCount}
          </Badge>
        )}
      </Button>

      <TwitterNotifications 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </div>
  );
}
