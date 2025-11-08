import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsOfService() {
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
            <FileText className="w-12 h-12 text-blue-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
              <p className="text-gray-400">Last Updated: October 26, 2025</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card className="bg-slate-900/80 border-blue-500/30">
          <CardContent className="p-8 md:p-12 space-y-8">
            
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                By accessing and using RiddleSwap ("Platform", "Service", "we", "us"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                RiddleSwap provides:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Multi-chain cryptocurrency swap services (XRPL, Ethereum, BSC, Polygon, Solana, etc.)</li>
                <li>Cross-chain bridge functionality</li>
                <li>NFT marketplace with brokered sales (XRPL XLS-20)</li>
                <li>NFT project launchpad and minting services</li>
                <li>NFT gaming platform "The Trolls Inquisition"</li>
                <li>Wallet management services</li>
                <li>Token scanner and analytics tools</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Eligibility</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                To use RiddleSwap, you must:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Be at least 18 years of age</li>
                <li>Have the legal capacity to enter into binding contracts</li>
                <li>Not be prohibited from using cryptocurrency services in your jurisdiction</li>
                <li>Comply with all applicable local, state, national, and international laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Wallet and Account Security</h2>
              
              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">4.1 Your Responsibility</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                You are solely responsible for:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Maintaining the security of your wallet and private keys</li>
                <li>All transactions made from your wallet</li>
                <li>Keeping your password and seed phrase confidential</li>
                <li>Any loss of funds due to compromised credentials</li>
              </ul>

              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">4.2 No Recovery</h3>
              <p className="text-gray-300 leading-relaxed">
                RiddleSwap cannot recover lost passwords, seed phrases, or private keys. We cannot reverse blockchain transactions. All cryptocurrency transactions are final and irreversible.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Fees and Charges</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                RiddleSwap charges fees for various services:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong>Trading Fee:</strong> 0.25% on all swaps</li>
                <li><strong>NFT Broker Fee:</strong> 1% on brokered NFT sales</li>
                <li><strong>Gaming Platform Fee:</strong> 20% of wager pools in battles</li>
                <li><strong>Gas Fees:</strong> Network fees are paid directly to blockchain validators</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                Fees are subject to change with reasonable notice to users.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Prohibited Activities</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You agree NOT to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Use the platform for money laundering or illegal activities</li>
                <li>Manipulate markets or engage in wash trading</li>
                <li>Exploit bugs or vulnerabilities for personal gain</li>
                <li>Use automated bots without authorization</li>
                <li>Impersonate others or create fake accounts</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Interfere with platform operations or other users</li>
                <li>Attempt to gain unauthorized access to systems</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Intellectual Property</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                All platform content, including but not limited to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>RiddleSwap branding and logos</li>
                <li>Software code and algorithms</li>
                <li>User interface designs</li>
                <li>Documentation and guides</li>
                <li>AI-generated content (The Oracle)</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                These are owned by RiddleSwap or our licensors and protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. NFT Gaming Rules</h2>
              
              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">8.1 The Trolls Inquisition</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                By participating in NFT gaming battles:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>You acknowledge all battles are games of skill, not gambling</li>
                <li>Power calculations are deterministic and transparent</li>
                <li>The platform takes a 20% fee from prize pools</li>
                <li>Disputes are resolved by platform administrators</li>
                <li>Cheating or exploitation results in account suspension</li>
              </ul>

              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">8.2 Wagering</h3>
              <p className="text-gray-300 leading-relaxed">
                All wagers are voluntary. Once a battle is initiated with a wager, it cannot be cancelled. Winners are determined by the battle system and payouts are automated.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Risk Disclosures</h2>
              
              <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg mb-4">
                <h3 className="text-xl font-semibold text-red-400 mb-3">⚠️ Important Warnings</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Cryptocurrency trading is highly risky and volatile</li>
                  <li>You may lose all invested funds</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>Smart contracts may contain bugs or vulnerabilities</li>
                  <li>Blockchain networks may experience outages or congestion</li>
                  <li>Regulatory changes may affect platform operations</li>
                </ul>
              </div>

              <p className="text-gray-300 leading-relaxed">
                <strong className="text-white">You acknowledge these risks and agree that RiddleSwap is not responsible for any losses.</strong>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Disclaimers</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>MERCHANTABILITY</li>
                <li>FITNESS FOR A PARTICULAR PURPOSE</li>
                <li>NON-INFRINGEMENT</li>
                <li>ACCURACY OR COMPLETENESS OF DATA</li>
                <li>UNINTERRUPTED OR ERROR-FREE SERVICE</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">11. Limitation of Liability</h2>
              <p className="text-gray-300 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, RIDDLESWAP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">12. Indemnification</h2>
              <p className="text-gray-300 leading-relaxed">
                You agree to indemnify and hold harmless RiddleSwap, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the platform or violation of these terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">13. Termination</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We reserve the right to:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Suspend or terminate your account at any time</li>
                <li>Refuse service to anyone for any reason</li>
                <li>Modify or discontinue the platform without notice</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                You may terminate your account at any time by disconnecting your wallet and ceasing platform use.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">14. Governing Law</h2>
              <p className="text-gray-300 leading-relaxed">
                These Terms are governed by and construed in accordance with applicable international laws. Any disputes shall be resolved through binding arbitration.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">15. Changes to Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                We may modify these Terms at any time. Continued use of the platform after changes constitutes acceptance of the modified terms. Material changes will be communicated through the platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">16. Contact Information</h2>
              <div className="bg-slate-800 p-6 rounded-lg">
                <p className="text-gray-300">
                  <strong className="text-white">Email:</strong> legal@riddleswap.com
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
                By using RiddleSwap, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
