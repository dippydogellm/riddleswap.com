import RDLFooter from "@/components/rdl-footer";
import { TopPromotionalBanner, BottomPromotionalBanner } from "@/components/promotional-banners";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Eye, Lock } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopPromotionalBanner />

      

      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-600 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
                <p className="text-gray-600 dark:text-gray-400">Effective Date: January 20, 2025</p>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2>1. Information We Collect</h2>
              <p>RDL Swap collects minimal information necessary to provide our decentralized exchange services:</p>
              <ul>
                <li><strong>Wallet Addresses:</strong> Your XRPL wallet address when you connect</li>
                <li><strong>Transaction Data:</strong> Public blockchain transaction information</li>
                <li><strong>Usage Analytics:</strong> Anonymous usage patterns to improve our service</li>
              </ul>

              <h2>2. How We Use Your Information</h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 my-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <strong>Transparency Note</strong>
                </div>
                <p className="mb-0">We only use your information to facilitate token swaps and improve our platform. We never sell or share personal data with third parties.</p>
              </div>

              <h2>3. Data Security</h2>
              <p>We implement industry-standard security measures:</p>
              <ul>
                <li>End-to-end encryption for all communications</li>
                <li>Secure storage of minimal user data</li>
                <li>Regular security audits and updates</li>
                <li>No storage of private keys or sensitive wallet information</li>
              </ul>

              <h2>4. Third-Party Services</h2>
              <p>RDL Swap integrates with:</p>
              <ul>
                <li><strong>Xaman Wallet:</strong> For secure wallet connections</li>
                <li><strong>XRPL Network:</strong> For blockchain transactions</li>
                <li><strong>Token APIs:</strong> For real-time price and market data</li>
              </ul>

              <h2>5. Your Rights</h2>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 my-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-green-600" />
                  <strong>Your Control</strong>
                </div>
                <p className="mb-0">You have full control over your data. Disconnect your wallet at any time to stop data collection.</p>
              </div>

              <h2>6. Cookies and Tracking</h2>
              <p>We use minimal cookies for:</p>
              <ul>
                <li>Remembering your wallet connection preferences</li>
                <li>Improving user experience</li>
                <li>Anonymous analytics to enhance our platform</li>
              </ul>

              <h2>7. Data Retention</h2>
              <p>We retain data only as long as necessary to provide our services. Transaction data on the XRPL is permanently stored on the blockchain as per its design.</p>

              <h2>8. Changes to This Policy</h2>
              <p>We may update this privacy policy as our service evolves. Users will be notified of significant changes through our platform.</p>

              <h2>9. Contact Us</h2>
              <p>If you have questions about this privacy policy, please contact us through our community channels or support system.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8">
              <Link href="/">
                <Button className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Swap
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BottomPromotionalBanner />
      <RDLFooter />
    </div>
  );
}
