import { useEffect, useState } from 'react';
import { SessionRenewalModal } from './session-renewal-modal';
import { sessionManager } from '@/utils/sessionManager';

/**
 * Global Session Renewal Handler
 * - Listens for session renewal needs on ALL pages
 * - Shows password modal when session expires
 * - Automatically continues operations after renewal
 * - No page reload needed!
 */
export function GlobalSessionRenewalHandler() {
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  useEffect(() => {
    console.log('🔐 [GLOBAL RENEWAL] Handler initialized');

    // Listen for session changes
    const unsubscribe = sessionManager.subscribe(() => {
      const session = sessionManager.getSession();
      if (session?.needsRenewal) {
        console.log('⚠️ [GLOBAL RENEWAL] Session needs renewal - showing modal');
        setShowRenewalModal(true);
      } else if (showRenewalModal && !session?.needsRenewal) {
        // Session renewed successfully
        console.log('✅ [GLOBAL RENEWAL] Session renewed - closing modal');
        setShowRenewalModal(false);
      }
    });

    // Check initial state
    const session = sessionManager.getSession();
    if (session?.needsRenewal) {
      console.log('⚠️ [GLOBAL RENEWAL] Initial check - session needs renewal');
      setShowRenewalModal(true);
    }

    return () => {
      unsubscribe();
    };
  }, [showRenewalModal]);

  const handleRenewalSuccess = async () => {
    console.log('✅ [GLOBAL RENEWAL] Session renewed successfully - continuing operations');
    
    // Force session check to clear needsRenewal flag
    await sessionManager.checkSession();
    
    // Close modal
    setShowRenewalModal(false);
  };

  const handleClose = () => {
    // Allow user to close the modal
    console.log('🔐 [GLOBAL RENEWAL] User closed renewal modal');
    setShowRenewalModal(false);
  };

  return (
    <SessionRenewalModal
      isOpen={showRenewalModal}
      onClose={handleClose}
      onSuccess={handleRenewalSuccess}
    />
  );
}
