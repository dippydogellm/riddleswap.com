import { useState } from "react";
import { useTheme, ThemeMode } from "@/contexts/theme-context";
import { Moon, Sun, Heart, Dog, Fish, Triangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import sealImage from "@assets/image_1752951822543.png";
import greenImage from "@assets/image_1752951871738.png";

const themeConfig: Record<ThemeMode, { label: string; icon: React.ReactNode; color: string }> = {
  light: { label: "Light", icon: <Sun className="h-4 w-4" />, color: "text-yellow-500" },
  dark: { label: "Dark", icon: <Moon className="h-4 w-4" />, color: "text-blue-700" },
  day: { label: "Day", icon: <Sun className="h-4 w-4" />, color: "text-yellow-500" },
  night: { label: "Night", icon: <Moon className="h-4 w-4" />, color: "text-blue-700" },
  fuzzy: { label: "Fuzzy Bears", icon: <Heart className="h-4 w-4" />, color: "text-amber-700" },
  doginals: { label: "Doginals", icon: <Dog className="h-4 w-4" />, color: "text-orange-600" },
  seal: { label: "SEAL", icon: <img src={sealImage} className="h-4 w-4 rounded" />, color: "" },
  green: { label: "ATM", icon: <img src={greenImage} className="h-4 w-4 rounded" />, color: "" },
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const currentTheme = themeConfig[theme];
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-border bg-card hover:bg-accent"
        >
          <span className={currentTheme.color}>{currentTheme.icon}</span>
          <span className="ml-2 hidden md:inline">{currentTheme.label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Select Theme</DialogTitle>
          <DialogDescription>
            Choose your preferred theme for the application
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {(Object.entries(themeConfig) as [ThemeMode, typeof themeConfig[ThemeMode]][]).map(([key, config]) => (
            <Button
              key={key}
              onClick={() => {
                setTheme(key);
                setIsOpen(false);
              }}
              variant={theme === key ? "default" : "outline"}
              className="w-full justify-start gap-2"
            >
              <span className={config.color}>{config.icon}</span>
              <span>{config.label}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
