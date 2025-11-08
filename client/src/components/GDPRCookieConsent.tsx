import { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GDPRCookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    // Only hide if user has explicitly accepted
    const consentStatus = localStorage.getItem('gdpr_cookie_consent');
    if (consentStatus !== 'accepted') {
      // Show popup after 1 second delay
      const timer = setTimeout(() => setShowConsent(true), 1000);
      return () => clearTimeout(timer); // Cleanup on unmount
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('gdpr_cookie_consent', 'accepted');
    localStorage.setItem('gdpr_consent_date', new Date().toISOString());
    setShowConsent(false);
  };

  const declineCookies = () => {
    localStorage.setItem('gdpr_cookie_consent', 'declined');
    localStorage.setItem('gdpr_consent_date', new Date().toISOString());
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4 pointer-events-none">
      <div className="bg-gradient-to-r from-blue-900/95 to-purple-900/95 backdrop-blur-lg border border-blue-500/30 rounded-2xl shadow-2xl max-w-2xl w-full pointer-events-auto animate-in slide-in-from-bottom duration-500">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Cookie className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Cookie Consent</h3>
            </div>
            <button
              onClick={declineCookies}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <p className="text-gray-300 mb-6 leading-relaxed">
            We use cookies to enhance your browsing experience, remember your preferences, 
            and provide personalized features. By clicking "Accept", you consent to our use 
            of cookies.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={acceptCookies}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Accept Cookies
            </Button>
            <Button
              onClick={declineCookies}
              variant="outline"
              className="flex-1 border-2 border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold py-3 rounded-xl transition-all duration-200"
            >
              Decline
            </Button>
          </div>

          {/* Privacy link */}
          <p className="text-xs text-gray-500 mt-4 text-center">
            Learn more in our{' '}
            <a href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
