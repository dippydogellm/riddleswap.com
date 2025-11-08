# Haptic Feedback System

## Overview
RiddleSwap includes a comprehensive haptic feedback system for mobile devices that provides tactile responses to user interactions.

## Available Haptic Patterns

### `haptics.click()` - 15ms
Standard click feedback for buttons and interactive elements.

### `haptics.light()` - 10ms  
Light tap for subtle interactions like hover effects or selections.

### `haptics.medium()` - 20ms
Medium feedback for important actions.

### `haptics.heavy()` - 30ms
Heavy feedback for critical actions or warnings.

### `haptics.success()` - [10ms, 50ms, 10ms]
Success pattern for completed actions.

### `haptics.error()` - [20ms, 40ms, 20ms, 40ms, 20ms]
Error pattern for failed actions or validation errors.

## Usage

### 1. Button Component (Automatic)
All `<Button>` components automatically trigger haptic feedback on click:

```tsx
import { Button } from "@/components/ui/button";

// Automatic haptic feedback
<Button onClick={handleClick}>Click Me</Button>

// Disable haptics if needed
<Button onClick={handleClick} noHaptic>Silent Button</Button>
```

### 2. useHapticClick Hook
For custom clickable elements:

```tsx
import { useHapticClick } from "@/hooks/useHapticClick";

function MyComponent() {
  const handleClick = useHapticClick(() => {
    console.log('Clicked!');
  });

  return <div onClick={handleClick}>Click me</div>;
}

// With custom haptic type
const handleClick = useHapticClick(() => {
  // your logic
}, 'heavy');
```

### 3. Async Callbacks
For async operations:

```tsx
import { useHapticClickAsync } from "@/hooks/useHapticClick";

const handleSave = useHapticClickAsync(async () => {
  await saveData();
}, 'medium');
```

### 4. Clickable Component
Wrapper for clickable divs:

```tsx
import { Clickable } from "@/components/ui/clickable";

<Clickable onClick={handleClick} hapticType="medium">
  <div>Click me!</div>
</Clickable>
```

### 5. Card Component
Cards can be clickable with haptics:

```tsx
import { Card } from "@/components/ui/card";

<Card clickable onClick={handleClick}>
  Card content
</Card>

// Custom haptic type
<Card clickable hapticType="heavy" onClick={handleClick}>
  Important card
</Card>
```

### 6. Manual Haptic Feedback
Direct access to haptics:

```tsx
import { haptics } from "@/lib/haptics";

// In your event handler
const handleSuccess = () => {
  haptics.success();
  showSuccessMessage();
};

const handleError = () => {
  haptics.error();
  showErrorMessage();
};
```

### 7. useHapticFeedback Hook
Convenient hook for multiple haptic types:

```tsx
import { useHapticFeedback } from "@/hooks/useHapticClick";

function MyComponent() {
  const haptic = useHapticFeedback();

  const handleSubmit = async () => {
    try {
      await submitForm();
      haptic.success();
    } catch (error) {
      haptic.error();
    }
  };

  return <Button onClick={handleSubmit}>Submit</Button>;
}
```

## Best Practices

1. **Default to `haptics.click()`** for most interactions
2. **Use `haptics.success()`** after successful operations (save, submit, etc.)
3. **Use `haptics.error()`** for errors and validation failures
4. **Use `haptics.heavy()`** for critical actions (delete, confirm)
5. **Use `haptics.light()`** for subtle feedback (selections, previews)
6. **Don't overuse** - Not every micro-interaction needs haptics

## Components with Built-in Haptics

- ✅ `Button` - Automatic haptic on click
- ✅ `Card` - Optional with `clickable` prop
- ✅ `Dialog` - Close button has haptic feedback
- ✅ `Clickable` - Wrapper for any clickable element

## Browser Compatibility

The haptic system uses the Vibration API, which is supported on:
- ✅ Chrome for Android
- ✅ Firefox for Android  
- ✅ Samsung Internet
- ❌ iOS Safari (requires native app via Capacitor)
- ❌ Desktop browsers (gracefully degrades)

The system automatically checks for vibration support and degrades gracefully on unsupported devices.
