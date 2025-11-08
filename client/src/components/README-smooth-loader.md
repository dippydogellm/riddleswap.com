# Smooth Page Loader Component

Prevents error flashes and provides smooth loading transitions for dynamically loaded pages.

## Problem Solved

When navigating to token or NFT pages, users would see:
1. Error messages flash briefly before content loads
2. Jarring transitions between loading and content states
3. Inconsistent loading experiences

## Usage

### Basic Usage

```tsx
import { SmoothPageLoader, TokenPageSkeleton } from '@/components/smooth-page-loader';

function TokenPage() {
  const { data, isLoading, isError, error, refetch } = useQuery(/* ... */);

  return (
    <SmoothPageLoader
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={refetch}
    >
      {/* Your page content */}
      <div>Token data: {data?.name}</div>
    </SmoothPageLoader>
  );
}
```

### With Custom Skeletons

```tsx
<SmoothPageLoader
  isLoading={isLoading}
  isError={isError}
  error={error}
  loadingComponent={<TokenPageSkeleton />} // Pre-built skeleton
  onRetry={refetch}
>
  {children}
</SmoothPageLoader>
```

### Available Skeletons

- `<TokenPageSkeleton />` - For token analytics pages
- `<NFTPageSkeleton />` - For NFT detail pages

## Key Features

1. **Minimum Loading Time**: Prevents flash by showing loading state for at least 300ms
2. **Smooth Transitions**: Fade-in animations for content
3. **Error Handling**: Built-in error display with retry button
4. **Customizable**: Pass custom loading/error components

## Integration Checklist

To add to existing pages:

1. Import the component
2. Wrap your return statement
3. Pass loading/error states from useQuery
4. Remove manual loading state UI
5. Test transitions

## Example Integration

Before:
```tsx
if (isLoading) return <LoadingSpinner />;
if (isError) return <ErrorMessage />;
return <Content />;
```

After:
```tsx
return (
  <SmoothPageLoader
    isLoading={isLoading}
    isError={isError}
    error={error}
    onRetry={refetch}
  >
    <Content />
  </SmoothPageLoader>
);
```
