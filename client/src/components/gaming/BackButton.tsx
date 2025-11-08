import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  to?: string;
  label?: string;
  theme?: 'light' | 'dark';
}

export function BackButton({ to = "/inquisition", label = "Back to Dashboard", theme = 'dark' }: BackButtonProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleBack = () => {
    toast({
      title: "🔙 Navigating Back",
      description: `Returning to ${label.replace('Back to ', '')}...`,
      duration: 2000,
    });
    
    setTimeout(() => {
      setLocation(to);
    }, 300);
  };

  return (
    <Button
      variant="outline"
      onClick={handleBack}
      className={`
        ${theme === 'dark' 
          ? 'bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-slate-700/50 hover:border-purple-400' 
          : 'bg-white/50 border-purple-300 text-purple-700 hover:bg-purple-50'
        }
        font-bold transition-all duration-200
      `}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
