import { ReactNode, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SmoothPageLoaderProps {
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  children: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  onRetry?: () => void;
  minLoadingTime?: number; // Minimum time to show loading (prevents flash)
}

export function SmoothPageLoader({
  isLoading,
  isError = false,
  error = null,
  children,
  loadingComponent,
  errorComponent,
  onRetry,
  minLoadingTime = 300 // 300ms minimum loading prevents flash
}: SmoothPageLoaderProps) {
  const [showLoading, setShowLoading] = useState(isLoading);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  // Track when loading starts
  useEffect(() => {
    if (isLoading && !loadingStartTime) {
      setLoadingStartTime(Date.now());
      setShowLoading(true);
    }
  }, [isLoading, loadingStartTime]);

  // Handle transition from loading to content
  useEffect(() => {
    if (!isLoading && loadingStartTime) {
      const elapsedTime = Date.now() - loadingStartTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      const timer = setTimeout(() => {
        setShowLoading(false);
        setLoadingStartTime(null);
      }, remainingTime);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingStartTime, minLoadingTime]);

  // Show loading state
  if (showLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    
    // Default loading skeleton
    return (
      <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    
    // Default error display
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3">
            <div>
              <p className="font-semibold">Failed to load content</p>
              <p className="text-sm mt-1">
                {error?.message || 'An error occurred while loading this page'}
              </p>
            </div>
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onRetry}
                className="w-fit"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show content with smooth transition
  return (
    <div className="animate-in fade-in duration-500">
      {children}
    </div>
  );
}

// Token/NFT specific loading skeleton
export function TokenPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <Skeleton className="h-96 w-full rounded-lg" />

      {/* Swap Interface */}
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function NFTPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back button */}
      <Skeleton className="h-10 w-24" />

      {/* NFT Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Image */}
        <Skeleton className="aspect-square w-full rounded-lg" />

        {/* Details */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          
          {/* Traits Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      </div>

      {/* Offers Section */}
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
