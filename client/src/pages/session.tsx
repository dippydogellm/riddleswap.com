// Session Status Page
import { SessionDisplay } from '@/components/session-display';

export default function SessionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Session Status
          </h1>
          <p className="text-gray-600">
            View your current authentication status and test wallet operations
          </p>
        </div>
        
        <div className="flex justify-center">
          <SessionDisplay />
        </div>

        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold mb-3">Available Operations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-blue-50 rounded">
                <strong>Solana Payments</strong>
                <p className="text-gray-600">Send SOL and SPL tokens including PEPE</p>
              </div>
              <div className="p-3 bg-green-50 rounded">
                <strong>XRPL Swaps</strong>
                <p className="text-gray-600">Native token swaps with trustlines</p>
              </div>
              <div className="p-3 bg-purple-50 rounded">
                <strong>EVM Chains</strong>
                <p className="text-gray-600">Multi-chain wallet operations</p>
              </div>
              <div className="p-3 bg-orange-50 rounded">
                <strong>Bridge Operations</strong>
                <p className="text-gray-600">Cross-chain asset transfers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
