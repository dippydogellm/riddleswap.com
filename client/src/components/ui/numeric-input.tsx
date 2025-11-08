import * as React from "react"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showDoubleZero?: boolean
  onDoubleZeroClick?: () => void
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, showDoubleZero = true, onDoubleZeroClick, value, onChange, ...props }, ref) => {
    const handleDoubleZeroClick = () => {
      haptics.click();
      
      if (onDoubleZeroClick) {
        onDoubleZeroClick();
      } else if (onChange) {
        const currentValue = String(value || '');
        const newValue = currentValue ? currentValue + '.00' : '0.00';
        
        const syntheticEvent = {
          target: { value: newValue },
          currentTarget: { value: newValue }
        } as React.ChangeEvent<HTMLInputElement>;
        
        onChange(syntheticEvent);
      }
    };

    return (
      <div className="relative w-full">
        <input
          type="number"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            showDoubleZero && "pr-14",
            className
          )}
          ref={ref}
          value={value}
          onChange={onChange}
          {...props}
        />
        {showDoubleZero && (
          <button
            type="button"
            onClick={handleDoubleZeroClick}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 rounded bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors"
            tabIndex={-1}
          >
            .00
          </button>
        )}
      </div>
    )
  }
)
NumericInput.displayName = "NumericInput"

export { NumericInput }
