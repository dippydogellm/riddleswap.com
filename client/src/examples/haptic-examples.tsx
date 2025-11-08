/**
 * Haptic Feedback Examples
 * 
 * This file demonstrates all the ways to use haptic feedback in RiddleSwap
 */

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clickable } from "@/components/ui/clickable";
import { useHapticClick, useHapticClickAsync, useHapticFeedback } from "@/hooks/useHapticClick";
import { haptics } from "@/lib/haptics";

export function HapticExamples() {
  // Method 1: Button Component (Automatic)
  const ButtonExample = () => (
    <div>
      {/* Automatic haptic feedback */}
      <Button onClick={() => console.log('Clicked!')}>
        Click Me (Auto Haptic)
      </Button>

      {/* Disable haptics */}
      <Button onClick={() => console.log('Silent')} noHaptic>
        Silent Button
      </Button>
    </div>
  );

  // Method 2: useHapticClick Hook
  const HookExample = () => {
    const handleClick = useHapticClick(() => {
      console.log('Clicked with haptic!');
    });

    const handleHeavyClick = useHapticClick(() => {
      console.log('Heavy haptic!');
    }, 'heavy');

    return (
      <div>
        <div onClick={handleClick} className="cursor-pointer">
          Click me (with hook)
        </div>
        <div onClick={handleHeavyClick} className="cursor-pointer">
          Heavy click
        </div>
      </div>
    );
  };

  // Method 3: Async Operations
  const AsyncExample = () => {
    const handleSave = useHapticClickAsync(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Saved!');
    }, 'medium');

    return <Button onClick={handleSave}>Save (Async)</Button>;
  };

  // Method 4: Clickable Component
  const ClickableExample = () => (
    <Clickable 
      onClick={() => console.log('Clicked!')} 
      hapticType="medium"
      className="p-4 border rounded"
    >
      <div>Click this div</div>
    </Clickable>
  );

  // Method 5: Clickable Card
  const CardExample = () => (
    <Card clickable onClick={() => console.log('Card clicked!')}>
      <CardHeader>
        <CardTitle>Clickable Card</CardTitle>
      </CardHeader>
      <CardContent>
        Click anywhere on this card
      </CardContent>
    </Card>
  );

  // Method 6: Manual Haptics
  const ManualExample = () => {
    const handleSuccess = () => {
      haptics.success();
      console.log('Success!');
    };

    const handleError = () => {
      haptics.error();
      console.log('Error!');
    };

    return (
      <div>
        <Button onClick={handleSuccess}>Trigger Success Haptic</Button>
        <Button onClick={handleError} variant="destructive">
          Trigger Error Haptic
        </Button>
      </div>
    );
  };

  // Method 7: useHapticFeedback Hook
  const FeedbackHookExample = () => {
    const haptic = useHapticFeedback();

    const handleSubmit = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        haptic.success();
      } catch (error) {
        haptic.error();
      }
    };

    return (
      <div>
        <Button onClick={handleSubmit}>Submit Form</Button>
        <Button onClick={() => haptic.light()}>Light</Button>
        <Button onClick={() => haptic.medium()}>Medium</Button>
        <Button onClick={() => haptic.heavy()}>Heavy</Button>
      </div>
    );
  };

  // Real-world example: NFT Card
  const NFTCardExample = () => {
    const haptic = useHapticFeedback();

    const handleBuy = async () => {
      try {
        haptic.medium(); // Initial feedback
        // Simulate purchase
        await new Promise(resolve => setTimeout(resolve, 2000));
        haptic.success(); // Success feedback
      } catch (error) {
        haptic.error(); // Error feedback
      }
    };

    const handleQuickView = useHapticClick(() => {
      console.log('Quick view');
    }, 'light');

    return (
      <Card clickable onClick={handleQuickView}>
        <CardHeader>
          <CardTitle>Cool NFT #1234</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={(e) => {
            e.stopPropagation(); // Prevent card click
            handleBuy();
          }}>
            Buy Now
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-3xl font-bold">Haptic Feedback Examples</h1>
      
      <section>
        <h2 className="text-2xl font-semibold mb-4">1. Button Examples</h2>
        <ButtonExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">2. Hook Examples</h2>
        <HookExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">3. Async Examples</h2>
        <AsyncExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">4. Clickable Component</h2>
        <ClickableExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">5. Card Examples</h2>
        <CardExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">6. Manual Haptics</h2>
        <ManualExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">7. Feedback Hook</h2>
        <FeedbackHookExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">8. Real-world: NFT Card</h2>
        <NFTCardExample />
      </section>
    </div>
  );
}
