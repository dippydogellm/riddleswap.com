import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Rocket, Shield, Coins } from "lucide-react";
import { useLocation } from "wouter";
import "../styles/bridge-countdown.css";

export default function BridgeCountdown() {
  const [, setLocation] = useLocation();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Calculate next Sunday at 18:00 GMT (12:00 + 6 hours)
  const getNextSundayGMT = () => {
    const nowUTC = new Date();
    
    // Find next Sunday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const daysUntilSunday = (7 - nowUTC.getUTCDay()) % 7;
    const nextSunday = new Date(nowUTC);
    
    if (daysUntilSunday === 0) {
      // It's Sunday - check if it's past 18:00 GMT
      if (nowUTC.getUTCHours() >= 18) {
        // Past launch time, set for next Sunday
        nextSunday.setUTCDate(nowUTC.getUTCDate() + 7);
      }
    } else {
      // Not Sunday, set to next Sunday
      nextSunday.setUTCDate(nowUTC.getUTCDate() + daysUntilSunday);
    }
    
    // Set to 18:00 GMT (6 hours added from original 12:00)
    nextSunday.setUTCHours(18, 0, 0, 0);
    
    return nextSunday;
  };
  
  const launchDateGMT = getNextSundayGMT();

  useEffect(() => {
    const timer = setInterval(() => {
      const nowUTC = new Date();
      const distance = launchDateGMT.getTime() - nowUTC.getTime();

      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        // Launch time reached - redirect to live bridge
        setLocation('/wallet-bridge');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-black flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-4 text-white hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex justify-center mb-6">
            <img 
              src="/attached_assets/image_1755533299474.png" 
              alt="Riddle.Finance" 
              className="w-20 h-20 rounded-xl border-2 border-blue-400 shadow-lg"
            />
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4 animate-pulse">
            Bridge Launch Coming Soon
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            The revolutionary multi-chain bridge is launching this Sunday at 18:00 GMT (6:00 PM GMT). 
            Get ready to transfer tokens seamlessly across all major blockchains.
          </p>
        </div>

        {/* Countdown Timer */}
        <Card className="bg-black/50 border-blue-500/30 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white flex items-center justify-center gap-2">
              <Clock className="w-8 h-8 text-blue-400" />
              Launch Countdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="countdown-item">
                <div className="countdown-number">{formatTime(timeLeft.days)}</div>
                <div className="countdown-label">Days</div>
              </div>
              <div className="countdown-item">
                <div className="countdown-number">{formatTime(timeLeft.hours)}</div>
                <div className="countdown-label">Hours</div>
              </div>
              <div className="countdown-item">
                <div className="countdown-number">{formatTime(timeLeft.minutes)}</div>
                <div className="countdown-label">Minutes</div>
              </div>
              <div className="countdown-item">
                <div className="countdown-number">{formatTime(timeLeft.seconds)}</div>
                <div className="countdown-label">Seconds</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-black/30 border-blue-500/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Rocket className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Multi-Chain Support</h3>
              <p className="text-blue-200">
                Bridge tokens between Bitcoin, Ethereum, Solana, XRP, and more
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-purple-500/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Shield className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Bank-Grade Security</h3>
              <p className="text-purple-200">
                Military-grade encryption and secure wallet integration
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-green-500/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Coins className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Real-Time Rates</h3>
              <p className="text-green-200">
                Live market pricing and instant cross-chain transfers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Launch Details */}
        <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-400/30">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Launch Details</h2>
            <div className="space-y-2 text-blue-200">
              <p><strong className="text-white">Date:</strong> Sunday, 18:00 GMT (6:00 PM GMT)</p>
              <p><strong className="text-white">Supported Chains:</strong> BTC, ETH, SOL, XRP, BSC, BASE, MATIC</p>
              <p><strong className="text-white">Live Testing:</strong> All transactions confirmed working</p>
              <p><strong className="text-white">Bank Wallets:</strong> Deployed and operational</p>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <div className="text-center">
          <p className="text-blue-300 text-lg">
            System Status: <span className="text-green-400 font-bold">All Systems Ready</span>
          </p>
          <p className="text-sm text-blue-400 mt-2">
            The bridge will automatically become available at launch time
          </p>
        </div>
      </div>
    </div>
  );
}
