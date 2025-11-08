import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

export function useBackNavigation() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const goBack = (destination: string = '/', message?: string) => {
    navigate(destination);
    
    if (message) {
      toast({
        title: "Navigation",
        description: message,
        duration: 2000,
      });
    }
  };

  const goBackWithToast = (destination: string = '/', customMessage?: string) => {
    const defaultMessage = customMessage || `Navigating back to ${destination === '/' ? 'home' : destination.replace('/', '')}`;
    goBack(destination, defaultMessage);
  };

  return { goBack, goBackWithToast };
}
