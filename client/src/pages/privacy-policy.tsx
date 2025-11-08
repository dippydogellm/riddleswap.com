import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-4 mb-4">
            <Shield className="w-12 h-12 text-blue-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
              <p className="text-gray-400">Last Updated: October 26, 2025</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card className="bg-slate-900/80 border-blue-500/30">
          <CardContent className="p-8 md:p-12 space-y-8">
            
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
              <p className="text-gray-300 leading-relaxed">
                Welcome to RiddleSwap. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our multi-chain DeFi platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">2.1 Wallet Information</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                When you connect your wallet to RiddleSwap, we collect:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Public wallet addresses (XRPL, Ethereum, Solana, Bitcoin)</li>
                <li>Transaction history on supported blockchains</li>
                <li>NFT holdings and metadata</li>
                <li>Token balances and portfolio data</li>
              </ul>

              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">2.2 Account Information</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                For Riddle Wallet users, we securely store:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Username and handle</li>
                <li>Encrypted private keys (AES-256-GCM encryption)</li>
                <li>Account preferences and settings</li>
                <li>Gaming profile data (for The Trolls Inquisition)</li>
              </ul>

              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">2.3 Usage Data</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                We automatically collect:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>IP address and browser information</li>
                <li>Device type and operating system</li>
                <li>Pages visited and features used</li>
                <li>Transaction details and swap history</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We use collected information to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Provide and maintain our platform services</li>
                <li>Process cryptocurrency swaps and NFT transactions</li>
                <li>Authenticate users and prevent fraud</li>
                <li>Display portfolio and transaction data</li>
                <li>Facilitate NFT gaming battles and tournaments</li>
                <li>Improve our services and user experience</li>
                <li>Send important updates and security notifications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We implement industry-standard security measures:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong>Encryption:</strong> All private keys are encrypted using AES-256-GCM</li>
                <li><strong>Secure Storage:</strong> Sensitive data is stored in encrypted PostgreSQL databases</li>
                <li><strong>HTTPS:</strong> All data transmission uses SSL/TLS encryption</li>
                <li><strong>Session Security:</strong> IP tracking and user agent validation</li>
                <li><strong>Rate Limiting:</strong> Protection against brute force attacks</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Third-Party Services</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We integrate with third-party services for enhanced functionality:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Blockchain RPC providers (Alchemy, Infura)</li>
                <li>Price data APIs (DexScreener, CoinGecko, 1inch)</li>
                <li>NFT metadata services (Bithomp, NFTScan)</li>
                <li>AI services (OpenAI for gaming features)</li>
                <li>Cloud storage (Google Cloud, IPFS via Pinata)</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                These services have their own privacy policies and we encourage you to review them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Blockchain Transparency</h2>
              <p className="text-gray-300 leading-relaxed">
                Please note that blockchain transactions are publicly visible. All swaps, transfers, and NFT transactions are permanently recorded on their respective blockchains (XRPL, Ethereum, Solana, etc.) and can be viewed by anyone using blockchain explorers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Cookies and Tracking</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Maintain your session and authentication</li>
                <li>Remember your preferences</li>
                <li>Analyze platform usage and performance</li>
                <li>Improve user experience</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                You can control cookie preferences through our GDPR consent banner and your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Your Rights</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Request data correction or deletion</li>
                <li>Export your data</li>
                <li>Opt-out of certain data collection</li>
                <li>Disconnect your wallet at any time</li>
                <li>Delete your Riddle Wallet account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Data Retention</h2>
              <p className="text-gray-300 leading-relaxed">
                We retain your data for as long as your account is active or as needed to provide services. Transaction history may be retained for compliance and audit purposes. You can request account deletion at any time, though blockchain transactions remain permanently on-chain.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Children's Privacy</h2>
              <p className="text-gray-300 leading-relaxed">
                RiddleSwap is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">11. International Users</h2>
              <p className="text-gray-300 leading-relaxed">
                RiddleSwap operates globally. By using our platform, you consent to the transfer and processing of your data in various jurisdictions where blockchain networks operate.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">12. Changes to This Policy</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update this Privacy Policy periodically. We will notify users of material changes through our platform or via email. Continued use of RiddleSwap after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">13. Contact Us</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-slate-800 p-6 rounded-lg">
                <p className="text-gray-300">
                  <strong className="text-white">Email:</strong> privacy@riddleswap.com
                </p>
                <p className="text-gray-300 mt-2">
                  <strong className="text-white">Discord:</strong> <a href="https://discord.gg/NfKPdjxF" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">discord.gg/NfKPdjxF</a>
                </p>
                <p className="text-gray-300 mt-2">
                  <strong className="text-white">Twitter:</strong> <a href="https://x.com/RIDDLEXRPL" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@RIDDLEXRPL</a>
                </p>
              </div>
            </section>

            <div className="border-t border-slate-700 pt-6 mt-8">
              <p className="text-gray-400 text-sm">
                This Privacy Policy is effective as of October 26, 2025. RiddleSwap is committed to protecting your privacy and maintaining transparency in our data practices.
              </p>
            </div>

          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <Button 
            variant="outline"
            onClick={() => navigate('/')}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <Button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
