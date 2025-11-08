/**
 * The Inquisition Game Branding Theme
 * Colors inspired by the logo: Orange, Red, Dark Blue, Gold
 */

export const inquisitionTheme = {
  // Primary colors from logo
  primary: {
    orange: '#FF8C00',    // Deep orange from logo swirl
    darkOrange: '#FF6B00',
    red: '#FF4444',       // Red from logo swirl
    darkRed: '#CC0000',
    blue: '#1E3A8A',      // Dark blue from chest
    navy: '#0F172A',      // Dark navy background
    gold: '#FFD700',      // Gold text and accents
    darkGold: '#B8860B',
  },
  
  // Gradients for backgrounds
  gradients: {
    hero: 'from-orange-600 via-red-600 to-blue-900',
    card: 'from-slate-900 via-blue-950 to-slate-900',
    button: 'from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700',
    accent: 'from-gold-500 to-amber-600',
    glow: 'from-orange-500/20 via-red-500/20 to-blue-900/20',
  },

  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#D1D5DB',
    gold: '#FFD700',
    orange: '#FF8C00',
    muted: '#9CA3AF',
  },

  // Border and glow effects
  effects: {
    border: 'border-orange-500/30',
    borderGold: 'border-gold-500/50',
    glow: 'shadow-[0_0_15px_rgba(255,140,0,0.3)]',
    glowGold: 'shadow-[0_0_20px_rgba(255,215,0,0.4)]',
    glowRed: 'shadow-[0_0_15px_rgba(255,68,68,0.3)]',
  },

  // Background patterns
  backgrounds: {
    dark: 'bg-slate-950',
    darkCard: 'bg-slate-900/80',
    darkOverlay: 'bg-black/60',
    pattern: 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900',
  }
};

// Collection-specific branding
export const collectionBranding = {
  "The Inquisition": {
    gradient: "from-red-600 to-orange-600",
    taxon: 2,
    issuer: "rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
  },
  "The Inquiry": {
    gradient: "from-yellow-600 to-amber-600",
    taxon: 1,
    issuer: "rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
  },
  "The Lost Emporium": {
    gradient: "from-amber-600 to-orange-600",
    taxon: 3,
    issuer: "rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
  },
  "DANTES AURUM": {
    gradient: "from-purple-600 to-pink-600",
    taxon: 4,
    issuer: "rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
  }
};
