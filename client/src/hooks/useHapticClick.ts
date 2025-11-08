import { useCallback } from 'react';
import { haptics } from '@/lib/haptics';

/**
 * Hook to add haptic feedback to any clickable element
 * 
 * @example
 * ```tsx
 * const handleClick = useHapticClick(() => {
 *   console.log('Clicked!');
 * });
 * 
 * <div onClick={handleClick}>Click me</div>
 * ```
 */
export function useHapticClick<T = any>(
  callback: (event: T) => void,
  hapticType: 'click' | 'light' | 'medium' | 'heavy' = 'click'
) {
  return useCallback(
    (event: T) => {
      haptics[hapticType]();
      callback(event);
    },
    [callback, hapticType]
  );
}

/**
 * Hook to add haptic feedback with async callback
 */
export function useHapticClickAsync<T = any>(
  callback: (event: T) => Promise<void>,
  hapticType: 'click' | 'light' | 'medium' | 'heavy' = 'click'
) {
  return useCallback(
    async (event: T) => {
      haptics[hapticType]();
      await callback(event);
    },
    [callback, hapticType]
  );
}

/**
 * Hook for success/error haptics
 */
export function useHapticFeedback() {
  return {
    success: () => haptics.success(),
    error: () => haptics.error(),
    click: () => haptics.click(),
    light: () => haptics.light(),
    medium: () => haptics.medium(),
    heavy: () => haptics.heavy(),
  };
}
