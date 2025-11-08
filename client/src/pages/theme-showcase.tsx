import { useState, useEffect } from "react";
import { Sun, Moon, Sparkles, Eye, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ThemeShowcase() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('gaming-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Toggle theme with animation
  const toggleTheme = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('gaming-theme', newTheme);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' 
        : 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50'
    }`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {theme === 'dark' ? (
          <>
            {/* Stars */}
            <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="absolute top-40 right-20 w-1 h-1 bg-white rounded-full animate-pulse delay-150"></div>
            <div className="absolute top-60 left-1/3 w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-300"></div>
            <div className="absolute bottom-40 right-1/4 w-2 h-2 bg-white rounded-full animate-pulse delay-500"></div>
            
            {/* Moon */}
            <div className="absolute top-10 right-10 w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-400 rounded-full shadow-2xl shadow-blue-500/20">
              <div className="absolute top-4 left-4 w-6 h-6 bg-gray-300 rounded-full opacity-40"></div>
              <div className="absolute top-12 left-14 w-4 h-4 bg-gray-300 rounded-full opacity-30"></div>
            </div>
          </>
        ) : (
          <>
            {/* Sun rays */}
            <div className="absolute top-10 right-10 w-32 h-32">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full animate-pulse"></div>
              <div className="absolute inset-2 bg-gradient-to-r from-yellow-200 to-orange-300 rounded-full"></div>
              <div className="absolute inset-4 bg-gradient-to-r from-yellow-100 to-orange-200 rounded-full"></div>
              
              {/* Rays */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-1 h-20 bg-gradient-to-t from-transparent to-yellow-300/40 origin-bottom"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                  }}
                ></div>
              ))}
            </div>

            {/* Clouds */}
            <div className="absolute top-32 left-20 opacity-30">
              <div className="w-16 h-6 bg-white rounded-full"></div>
              <div className="w-12 h-5 bg-white rounded-full relative -top-3 left-10"></div>
            </div>
            <div className="absolute top-48 right-32 opacity-20">
              <div className="w-20 h-7 bg-white rounded-full"></div>
              <div className="w-14 h-6 bg-white rounded-full relative -top-4 left-12"></div>
            </div>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="relative container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
            theme === 'dark' 
              ? 'bg-orange-500/20 text-orange-300' 
              : 'bg-orange-500/30 text-orange-700'
          }`}>
            <Palette className="w-5 h-5" />
            <span className="font-semibold">Theme Experience</span>
          </div>

          <h1 className={`text-5xl sm:text-7xl font-bold mb-6 transition-colors duration-700 ${
            theme === 'dark' 
              ? 'text-white' 
              : 'text-gray-900'
          }`}>
            {theme === 'dark' ? (
              <span className="flex items-center justify-center gap-4">
                <Moon className="w-16 h-16 text-blue-400" />
                Night Mode
              </span>
            ) : (
              <span className="flex items-center justify-center gap-4">
                <Sun className="w-16 h-16 text-yellow-500" />
                Day Mode
              </span>
            )}
          </h1>

          <p className={`text-xl mb-8 transition-colors duration-700 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {theme === 'dark' 
              ? "Experience the mystery and power of the night" 
              : "Embrace the clarity and energy of daylight"}
          </p>

          {/* Theme toggle button */}
          <Button
            onClick={toggleTheme}
            disabled={isTransitioning}
            className={`px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
            }`}
          >
            {isTransitioning ? (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-spin" />
                Transforming...
              </span>
            ) : theme === 'dark' ? (
              <span className="flex items-center gap-2">
                <Sun className="w-5 h-5" />
                Switch to Day Mode
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Switch to Night Mode
              </span>
            )}
          </Button>
        </div>

        {/* Feature comparison */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Dark mode features */}
          <Card className={`transition-all duration-700 ${
            theme === 'dark'
              ? 'bg-slate-900/80 border-orange-500/30 backdrop-blur scale-105 shadow-2xl shadow-orange-500/20'
              : 'bg-white/50 border-gray-300 backdrop-blur'
          }`}>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Moon className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-400' : 'text-gray-400'}`} />
                <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                  Night Mode
                </h3>
              </div>
              
              <ul className={`space-y-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                <li className="flex items-start gap-2">
                  <Eye className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400" />
                  <span><strong>Reduced Eye Strain:</strong> Perfect for extended gaming sessions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 text-purple-400" />
                  <span><strong>Immersive Atmosphere:</strong> Enhanced medieval fantasy aesthetic</span>
                </li>
                <li className="flex items-start gap-2">
                  <Moon className="w-5 h-5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span><strong>Focus Enhancement:</strong> Better concentration in low-light environments</span>
                </li>
              </ul>

              <div className={`mt-6 p-4 rounded-lg ${
                theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-gray-100'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-gray-600'}`}>
                  Optimized for nighttime battles and strategic planning
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Light mode features */}
          <Card className={`transition-all duration-700 ${
            theme === 'light'
              ? 'bg-white/80 border-yellow-500/30 backdrop-blur scale-105 shadow-2xl shadow-yellow-500/20'
              : 'bg-slate-900/50 border-slate-700 backdrop-blur'
          }`}>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sun className={`w-8 h-8 ${theme === 'light' ? 'text-yellow-500' : 'text-gray-600'}`} />
                <h3 className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-gray-400'}`}>
                  Day Mode
                </h3>
              </div>
              
              <ul className={`space-y-3 ${theme === 'light' ? 'text-gray-700' : 'text-gray-500'}`}>
                <li className="flex items-start gap-2">
                  <Eye className="w-5 h-5 mt-0.5 flex-shrink-0 text-orange-400" />
                  <span><strong>High Visibility:</strong> Crystal clear interface in bright environments</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 text-yellow-400" />
                  <span><strong>Energizing Design:</strong> Vibrant colors for active gameplay</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sun className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
                  <span><strong>Detail Clarity:</strong> Enhanced text readability and UI elements</span>
                </li>
              </ul>

              <div className={`mt-6 p-4 rounded-lg ${
                theme === 'light' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-800'
              }`}>
                <p className={`text-sm ${theme === 'light' ? 'text-orange-700' : 'text-gray-500'}`}>
                  Perfect for daytime conquests and civilization building
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visual examples grid */}
        <div className="mt-16 max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-8 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Interface Preview
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Battles", icon: "⚔️", color: "orange" },
              { title: "Squadrons", icon: "🛡️", color: "blue" },
              { title: "Land Plots", icon: "🏰", color: "green" },
              { title: "Alliances", icon: "👥", color: "purple" },
              { title: "Leaderboards", icon: "🏆", color: "yellow" },
              { title: "Oracle AI", icon: "🔮", color: "pink" },
            ].map((item) => (
              <Card
                key={item.title}
                className={`transition-all duration-500 hover:scale-105 ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-800 hover:border-orange-500/50'
                    : 'bg-white/70 border-gray-300 hover:border-yellow-500/50'
                } backdrop-blur`}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <h3 className={`font-semibold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {item.title}
                  </h3>
                  <div className={`h-1 w-16 mx-auto rounded-full ${
                    theme === 'dark'
                      ? `bg-${item.color}-500`
                      : `bg-${item.color}-400`
                  }`}></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Current theme info */}
        <div className="mt-16 text-center">
          <Card className={`max-w-2xl mx-auto ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20'
              : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
          } backdrop-blur`}>
            <CardContent className="p-8">
              <h3 className={`text-xl font-bold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Your Current Theme
              </h3>
              <p className={`mb-6 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {theme === 'dark'
                  ? "You're currently experiencing The Trolls Inquisition in Night Mode - optimized for immersive gaming and reduced eye strain during extended sessions."
                  : "You're currently experiencing The Trolls Inquisition in Day Mode - designed for maximum clarity and vibrant visuals in well-lit environments."}
              </p>
              <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold ${
                theme === 'dark'
                  ? 'bg-blue-600 text-white'
                  : 'bg-yellow-500 text-gray-900'
              }`}>
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                {theme === 'dark' ? 'Night Mode Active' : 'Day Mode Active'}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
