import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface SafeComponentProps {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
}

export function SafeGamingComponent({ children, componentName, fallback }: SafeComponentProps) {
  const defaultFallback = (
    <Card className="bg-slate-800/50 border-red-500/30">
      <CardContent className="p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-gray-300 text-sm">
          {componentName} temporarily unavailable
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Your data is safe. Try refreshing the page.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary fallback={fallback || defaultFallback}>
      {children}
    </ErrorBoundary>
  );
}
