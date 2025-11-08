import { ExternalLink, Gamepad2, ArrowLeftRight } from "lucide-react";

export function TopPromotionalBanner() {
  return (
    <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white py-3 px-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute inset-0 bg-white rounded-lg blur opacity-30"></div>
            <Gamepad2 className="relative h-5 w-5" />
          </div>
          <span className="text-sm font-medium">
            Welcome to Riddle.Finance - Your Multi-Chain Trading Platform
          </span>
        </div>
        <div 
          className="flex items-center space-x-2 text-sm font-bold bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 opacity-60"
        >
          <span>Bridge Coming Soon</span>
          <ArrowLeftRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function BottomPromotionalBanner() {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white py-8 px-4 mt-12 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-indigo-600/10 animate-pulse"></div>
      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo and Info */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full blur opacity-50"></div>
              <img 
                src="/inquisition-logo.png" 
                alt="The Inquisition NFT Game" 
                className="relative w-24 h-24 rounded-full border-3 border-orange-400 shadow-2xl"
              />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-3xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                The Inquisition
              </h3>
              <p className="text-base text-gray-300 max-w-md leading-relaxed">
                Collect exclusive NFT cards on XRPL, build strategic decks, and engage in epic blockchain battles
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <a 
              href="https://inquisition.game/marketplace" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-8 py-4 rounded-xl font-bold transition-all duration-300 flex items-center space-x-2 shadow-xl transform hover:scale-105 hover:shadow-2xl"
            >
              <span>Buy NFTs Now</span>
              <ExternalLink className="h-5 w-5" />
            </a>
            <a 
              href="https://inquisition.game" 
              target="_blank" 
              rel="noopener noreferrer"
              className="glass border-2 border-orange-400/50 hover:border-orange-400 px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center space-x-2 hover:bg-orange-400/20 backdrop-blur-md"
            >
              <Gamepad2 className="h-5 w-5" />
              <span>Play Game</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
