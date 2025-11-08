# Haptic Feedback Quick Reference

## ✅ Components with Built-in Haptics

### Automatic Haptic Feedback (No Extra Code Needed)
All these components automatically trigger haptic feedback when clicked:

1. **`<Button>`** - All button variants (default, destructive, outline, etc.)
   - Haptic: `click` (15ms)
   - Disable: `<Button noHaptic>`

2. **`<Card clickable>`** - Clickable cards
   - Haptic: `click` (15ms) by default
   - Custom: `<Card clickable hapticType="heavy">`
   - Disable: `<Card clickable noHaptic>`

3. **`<Dialog>` Close Button** - X button in dialogs
   - Haptic: `click` (15ms)

4. **`<TabsTrigger>`** - Tab switches
   - Haptic: `light` (10ms)
   - Disable: `<TabsTrigger noHaptic>`

5. **`<Switch>`** - Toggle switches
   - Haptic: `light` (10ms)
   - Disable: `<Switch noHaptic>`

6. **`<Clickable>`** - Wrapper for any clickable div
   - Haptic: `click` (15ms) by default
   - Custom: `<Clickable hapticType="medium">`

## 🚀 Quick Usage

### For Regular Buttons
```tsx
import { Button } from "@/components/ui/button";

<Button onClick={handleClick}>Click Me</Button>
```

### For Clickable Divs
```tsx
import { Clickable } from "@/components/ui/clickable";

<Clickable onClick={handleClick} hapticType="medium">
  <div>Click me!</div>
</Clickable>
```

### For Custom Click Handlers
```tsx
import { useHapticClick } from "@/hooks/useHapticClick";

const handleClick = useHapticClick(() => {
  console.log('Clicked!');
}, 'heavy'); // Optional: specify haptic type

<div onClick={handleClick}>Click</div>
```

### For Success/Error Feedback
```tsx
import { useHapticFeedback } from "@/hooks/useHapticClick";

const haptic = useHapticFeedback();

try {
  await saveData();
  haptic.success(); // ✅
} catch (error) {
  haptic.error(); // ❌
}
```

### For Async Operations
```tsx
import { useHapticClickAsync } from "@/hooks/useHapticClick";

const handleSave = useHapticClickAsync(async () => {
  await saveData();
});

<Button onClick={handleSave}>Save</Button>
```

## 📱 Haptic Patterns

| Pattern | Duration | Use Case |
|---------|----------|----------|
| `click` | 15ms | Buttons, standard clicks |
| `light` | 10ms | Tabs, switches, subtle interactions |
| `medium` | 20ms | Important actions |
| `heavy` | 30ms | Critical actions (delete, confirm) |
| `success` | [10, 50, 10]ms | Successful operations |
| `error` | [20, 40, 20, 40, 20]ms | Errors, validation failures |

## 💡 Best Practices

✅ **DO:**
- Use Button component for clickable elements (auto-haptics)
- Use `success()` for completed actions
- Use `error()` for failures
- Use `heavy` for destructive actions

❌ **DON'T:**
- Add haptics to every micro-interaction
- Use heavy haptics for common actions
- Forget to disable when needed (`noHaptic` prop)

## 🔧 Manual Haptics (Advanced)

For direct control:
```tsx
import { haptics } from "@/lib/haptics";

haptics.click();   // Standard click
haptics.success(); // Success pattern
haptics.error();   // Error pattern
haptics.heavy();   // Heavy feedback
```

## 📖 Full Documentation

See `client/src/lib/haptics-readme.md` for complete documentation
See `client/src/examples/haptic-examples.tsx` for working examples
