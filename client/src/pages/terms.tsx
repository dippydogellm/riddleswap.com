import RDLFooter from "@/components/rdl-footer";
import { TopPromotionalBanner, BottomPromotionalBanner } from "@/components/promotional-banners";

import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, AlertTriangle, Scale } from "lucide-react";
import { Link } from "wouter";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopPromotionalBanner />

      

      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                <Scale className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
                <p className="text-gray-600 dark:text-gray-400">Effective Date: January 20, 2025</p>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2>1. Acceptance of Terms</h2>
              <p>By using RDL Swap, you agree to these Terms of Service. If you disagree with any part of these terms, you may not use our service.</p>

              <h2>2. Description of Service</h2>
              <p>RDL Swap is a decentralized exchange interface for XRPL tokens that:</p>
              <ul>
                <li>Facilitates token swaps on the XRP Ledger</li>
                <li>Provides real-time market data and analytics</li>
                <li>Connects to Xaman wallet for secure transactions</li>
                <li>Offers portfolio tracking and trading tools</li>
              </ul>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 my-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <strong>Important Disclaimer</strong>
                </div>
                <p className="mb-0">RDL Swap is a decentralized interface. You maintain full control and responsibility for your funds and transactions.</p>
              </div>

              <h2>3. User Responsibilities</h2>
              <p>As a user, you agree to:</p>
              <ul>
                <li>Use the service in compliance with applicable laws</li>
                <li>Verify token issuer addresses before trading</li>
                <li>Understand the risks of cryptocurrency trading</li>
                <li>Secure your wallet and private keys</li>
                <li>Not engage in manipulative trading practices</li>
              </ul>

              <h2>4. Risks and Disclaimers</h2>
              <h3>Trading Risks</h3>
              <ul>
                <li><strong>Volatility:</strong> Token prices can fluctuate dramatically</li>
                <li><strong>Liquidity:</strong> Some tokens may have limited trading volume</li>
                <li><strong>Smart Contract Risk:</strong> Potential technical vulnerabilities</li>
                <li><strong>Regulatory Risk:</strong> Changing legal landscapes</li>
              </ul>

              <h3>Platform Disclaimers</h3>
              <ul>
                <li>We do not provide investment advice</li>
                <li>Token listings do not constitute endorsements</li>
                <li>Users must verify token authenticity</li>
                <li>Platform availability is not guaranteed</li>
              </ul>

              <h2>5. Prohibited Activities</h2>
              <p>You may not:</p>
              <ul>
                <li>Use the platform for illegal activities</li>
                <li>Attempt to manipulate token prices</li>
                <li>Exploit platform vulnerabilities</li>
                <li>Create fake tokens or misleading information</li>
                <li>Interfere with other users' transactions</li>
              </ul>

              <h2>6. Intellectual Property</h2>
              <p>RDL Swap interface and branding are proprietary. Users may not copy, modify, or distribute our intellectual property without permission.</p>

              <h2>7. Limitation of Liability</h2>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 my-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-red-600" />
                  <strong>Liability Limitation</strong>
                </div>
                <p className="mb-0">RDL Swap is provided "as is" without warranties. We are not liable for trading losses, technical issues, or third-party actions.</p>
              </div>

              <h2>8. Indemnification</h2>
              <p>Users agree to indemnify RDL Swap against any claims arising from their use of the platform or violation of these terms.</p>

              <h2>9. Termination</h2>
              <p>We may suspend or terminate access to our service at any time for violations of these terms or for operational reasons.</p>

              <h2>10. Governing Law</h2>
              <p>These terms are governed by the laws of the jurisdiction where RDL Swap operates, without regard to conflict of law principles.</p>

              <h2>11. Changes to Terms</h2>
              <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of new terms.</p>

              <h2>12. Contact Information</h2>
              <p>For questions about these terms, contact us through our official communication channels or community support.</p>
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
