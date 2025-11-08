import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Calendar, 
  Sword, 
  Trophy, 
  Users, 
  Zap,
  Clock,
  Crown,
  Star,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface GameEvent {
  id: string;
  type: 'battle' | 'tournament' | 'quest' | 'alliance' | 'special';
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  status: 'upcoming' | 'active' | 'completed';
  rewards?: string[];
  participants?: number;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionable?: boolean;
}

export const GameStatusBar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'notifications'>('events');

  // Production-ready: No mock data - notifications come from real backend data
  const events: GameEvent[] = [];
  const notifications: Notification[] = [];

  const getEventIcon = (type: GameEvent['type']) => {
    switch (type) {
      case 'tournament': return <Trophy className="h-4 w-4" />;
      case 'battle': return <Sword className="h-4 w-4" />;
      case 'quest': return <Star className="h-4 w-4" />;
      case 'alliance': return <Users className="h-4 w-4" />;
      case 'special': return <Crown className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <Star className="h-4 w-4 text-green-400" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-400" />;
      default: return <Bell className="h-4 w-4 text-blue-400" />;
    }
  };

  const formatTimeUntil = (dateString: string) => {
    const now = new Date();
    const target = new Date(dateString);
    const diff = target.getTime() - now.getTime();
    
    if (diff < 0) return 'Started';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const activeEvents = events.filter(e => e.status === 'active').length;
  const upcomingEvents = events.filter(e => e.status === 'upcoming').length;

  return (
    <div className="w-full mb-4">
      {/* Compact Status Bar */}
      <Card className="bg-slate-900/60 backdrop-blur-sm border-blue-500/30">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-slate-300">Game Status</span>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-green-500/30 text-green-300">
                  <Zap className="h-3 w-3 mr-1" />
                  {activeEvents} Active
                </Badge>
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-300">
                  <Clock className="h-3 w-3 mr-1" />
                  {upcomingEvents} Upcoming
                </Badge>
                {unreadNotifications > 0 && (
                  <Badge variant="outline" className="border-red-500/30 text-red-300">
                    <Bell className="h-3 w-3 mr-1" />
                    {unreadNotifications} New
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-300 hover:text-white"
              data-testid="button-expand-status"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Status Details */}
      {isExpanded && (
        <Card className="mt-2 bg-slate-800/50 backdrop-blur-sm border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant={activeTab === 'events' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('events')}
                className="text-sm"
                data-testid="button-tab-events"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Events ({events.length})
              </Button>
              <Button
                variant={activeTab === 'notifications' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('notifications')}
                className="text-sm"
                data-testid="button-tab-notifications"
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications ({unreadNotifications})
              </Button>
            </div>

            <ScrollArea className="h-40">
              {activeTab === 'events' ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getEventIcon(event.type)}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white">{event.title}</h4>
                          <p className="text-xs text-slate-400 mt-1">{event.description}</p>
                          {event.rewards && (
                            <div className="flex gap-1 mt-2">
                              {event.rewards.map((reward, index) => (
                                <Badge key={index} variant="outline" className="text-xs border-yellow-500/30 text-yellow-300">
                                  {reward}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge 
                          variant={event.status === 'active' ? 'default' : 'outline'}
                          className={`text-xs ${
                            event.status === 'active' 
                              ? 'bg-green-600 text-white' 
                              : 'border-blue-500/30 text-blue-300'
                          }`}
                        >
                          {event.status === 'active' ? 'Active' : formatTimeUntil(event.startTime)}
                        </Badge>
                        {event.participants && (
                          <p className="text-xs text-slate-400 mt-1">
                            {event.participants} players
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={`flex items-start justify-between p-3 rounded-lg border ${
                        notification.read 
                          ? 'bg-slate-700/20 border-slate-600/20' 
                          : 'bg-slate-700/40 border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div>
                          <h4 className={`text-sm font-medium ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                            {notification.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">{notification.message}</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {formatTimeUntil(notification.timestamp)} ago
                          </p>
                        </div>
                      </div>
                      
                      {notification.actionable && !notification.read && (
                        <Button size="sm" variant="outline" className="text-xs">
                          View
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
