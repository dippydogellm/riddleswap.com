import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PullToRefreshOptions {
  threshold?: number;
  maxPullDistance?: number;
  onRefresh?: () => Promise<void>;
}

export function usePullToRefresh({
  threshold = 80,
  maxPullDistance = 150,
  onRefresh
}: PullToRefreshOptions = {}) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    let touchStartY = 0;
    let currentPullDistance = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at top of page
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        startY.current = touchStartY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY === 0 || window.scrollY > 0) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY;

      if (distance > 0) {
        // Apply resistance curve
        const resistanceFactor = Math.min(distance / maxPullDistance, 1);
        currentPullDistance = Math.min(distance * (1 - resistanceFactor * 0.5), maxPullDistance);
        
        setPullDistance(currentPullDistance);
        setIsPulling(true);

        // Prevent scrolling when pulling
        if (currentPullDistance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (currentPullDistance > threshold && !isRefreshing) {
        setIsRefreshing(true);
        
        try {
          // Invalidate all queries to refresh data
          await queryClient.invalidateQueries();
          
          // Call custom refresh handler if provided
          if (onRefresh) {
            await onRefresh();
          }
          
          // Small delay for better UX
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Refresh failed:', error);
        } finally {
          setIsRefreshing(false);
        }
      }

      // Reset state
      setIsPulling(false);
      setPullDistance(0);
      touchStartY = 0;
      currentPullDistance = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [threshold, maxPullDistance, isRefreshing, queryClient, onRefresh]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    shouldShowIndicator: isPulling || isRefreshing
  };
}
