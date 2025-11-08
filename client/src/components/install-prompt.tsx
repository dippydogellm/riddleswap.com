import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as installed PWA
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if Android
    const isAndroid = /Android/.test(navigator.userAgent);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔧 Before install prompt event fired');
      // Only prevent default and show custom prompt if we're on mobile
      // For desktop, let the browser handle it
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowInstallButton(true);
      }
      // On desktop, don't prevent default - let browser show its own prompt
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For mobile devices, show install button with delay
    if (!isInStandaloneMode && (iOS || isAndroid)) {
      setTimeout(() => setShowInstallButton(true), 2000);
      
      // Auto-hide after 8 seconds
      setTimeout(() => setShowInstallButton(false), 10000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        console.log('🔧 Showing install prompt...');
        const promptResult = await deferredPrompt.prompt();
        console.log('🔧 Prompt result:', promptResult);
        
        const { outcome } = await deferredPrompt.userChoice;
        console.log('🔧 User choice outcome:', outcome);
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted install');
          setDeferredPrompt(null);
          setShowInstallButton(false);
        } else {
          console.log('❌ User dismissed install');
        }
      } catch (error) {
        console.log('❌ Install prompt failed:', error);
        // Fallback: show manual instructions
        alert('To install: Tap the menu button (⋮) in your browser and select "Add to Home screen"');
      }
    } else {
      console.log('❌ No deferred prompt available');
      // No prompt available, show manual instructions
      alert('To install RiddleSwap:\n\n1. Tap the menu button (⋮) in Chrome\n2. Select "Add to Home screen"\n3. Tap "Add" to confirm');
    }
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
  };

  // Don't show if already installed
  if (isStandalone || !showInstallButton) {
    return null;
  }

  return (
    <div className="install-prompt-container">
      <div className="install-prompt-card">
        <div className="install-prompt-header">
          <div className="install-prompt-content">
            <img 
              src="/images/logos/rdl-logo-official.png" 
              alt="RiddleSwap Professional Banking Platform" 
              className="install-prompt-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="install-prompt-info">
              <h3 className="install-prompt-title">Install RiddleSwap</h3>
              <p className="install-prompt-description">
                {isIOS 
                  ? "Tap Share → Add to Home Screen" 
                  : "Tap menu (⋮) → Add to Home screen"
                }
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="install-prompt-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {!isIOS && (
          <button 
            onClick={handleInstallClick}
            className="install-prompt-button"
          >
            <Download className="w-3 h-3" />
            {deferredPrompt ? 'Install App' : 'Install Guide'}
          </button>
        )}
      </div>
    </div>
  );
}
