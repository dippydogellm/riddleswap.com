import { Bell, Zap, Coins, Sun, Moon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  message: string;
  type: 'battle' | 'alliance' | 'system';
  timestamp: string;
}

interface ActionBarProps {
  notifications: Notification[];
  xrpBalance: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleMenu: () => void;
}

export function ActionBar({ 
  notifications, 
  xrpBalance, 
  theme, 
  onToggleTheme,
  onToggleMenu
}: ActionBarProps) {
  const unreadCount = notifications.length;

  return (
    <div className={`${theme === 'dark' ? 'bg-slate-900/95 border-orange-500/30' : 'bg-white border-orange-300'} backdrop-blur-sm border-b sticky top-0 z-50 transition-all duration-300`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: Logo & Menu */}
          <div className="flex items-center gap-3">
            <Button
              onClick={onToggleMenu}
              variant="ghost"
              size="sm"
              className="sm:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className={`text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent`}>
              The Trolls Inquisition
            </h1>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* XRP Balance - Always visible */}
            <div className={`flex items-center gap-1 sm:gap-2 ${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg px-2 py-1 sm:px-3 sm:py-1.5`}>
              <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
              <span className={`text-xs sm:text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {xrpBalance}
              </span>
            </div>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 min-w-[18px] h-[18px] flex items-center justify-center">
                  {unreadCount}
                </Badge>
              )}
            </Button>

            {/* Theme Toggle - Always visible */}
            <Button
              onClick={onToggleTheme}
              variant="ghost"
              size="sm"
              className="flex"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-blue-600" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Notification Ticker - Only on desktop */}
      {notifications.length > 0 && (
        <div className={`hidden md:block ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'} border-t border-orange-500/20 py-1 px-4 overflow-hidden`}>
          <div className="flex items-center gap-4 animate-marquee whitespace-nowrap">
            <Zap className="w-3 h-3 text-orange-400 flex-shrink-0" />
            {notifications.slice(0, 5).map((notif) => (
              <span key={notif.id} className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {notif.message}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
