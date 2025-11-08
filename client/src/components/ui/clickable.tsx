import * as React from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

export interface ClickableProps extends React.HTMLAttributes<HTMLDivElement> {
  noHaptic?: boolean;
  hapticType?: 'click' | 'light' | 'medium' | 'heavy';
}

/**
 * A clickable div wrapper that automatically adds haptic feedback
 * 
 * @example
 * ```tsx
 * <Clickable onClick={() => console.log('clicked')}>
 *   Click me!
 * </Clickable>
 * ```
 */
const Clickable = React.forwardRef<HTMLDivElement, ClickableProps>(
  ({ className, noHaptic = false, hapticType = 'click', onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!noHaptic) {
        haptics[hapticType]();
      }
      onClick?.(e);
    };

    return (
      <div
        ref={ref}
        className={cn("cursor-pointer", className)}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Clickable.displayName = "Clickable";

export { Clickable };
