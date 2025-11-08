import fs from 'fs';
import path from 'path';

// Land plot terrain types and metadata
interface LandPlotNFTMetadata {
  id: number;
  name: string;
  description: string;
  image: string;
  animation_url?: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    coordinates: { x: number; y: number };
    terrain_type: string;
    resources: string[];
    size_multiplier: number;
    xrp_price: number;
    rdl_price: number;
    early_bird_discount: number;
    yearly_yield: number;
    yield_percentage: number;
    rarity_score: number;
    founding_riddle_wallets?: string[];
  };
}

// Generate terrain-specific traits and rarity
const getTerrainTraits = (terrain: string, x: number, y: number, sizeMultiplier: number) => {
  const resourceMap = {
    forest: ['Timber', 'Herbs', 'Game'],
    mountain: ['Iron', 'Gold', 'Stone'],
    plains: ['Grain', 'Horses', 'Cattle'],
    water: ['Fish', 'Pearls', 'Trade Routes'],
    village: ['Crafts', 'Knowledge', 'Trade'],
    castle: ['Military', 'Influence', 'Tribute']
  };

  const rarityMap = {
    forest: 20,
    mountain: 30, 
    plains: 15,
    water: 25,
    village: 35,
    castle: 50
  };

  // Calculate position-based bonuses
  const cornerBonus = (x === 0 || x === 39) && (y === 0 || y === 24) ? 10 : 0;
  const centerBonus = (x >= 18 && x <= 22) && (y >= 11 && y <= 14) ? 15 : 0;
  const sizeBonus = sizeMultiplier * 10;

  const baseRarity = rarityMap[terrain as keyof typeof rarityMap] || 20;
  const totalRarity = baseRarity + cornerBonus + centerBonus + sizeBonus;

  return {
    resources: resourceMap[terrain as keyof typeof resourceMap] || [],
    rarity_score: totalRarity
  };
};

// Generate pricing for each plot
const calculatePricing = (terrain: string, sizeMultiplier: number, plotIndex: number) => {
  const basePrices = {
    forest: 50,
    mountain: 75,
    plains: 40,
    water: 60,
    village: 100,
    castle: 200
  };

  const basePrice = basePrices[terrain as keyof typeof basePrices] || 50;
  const variance = Math.sin(plotIndex * 0.1) * 25; // Deterministic variance based on plot index
  const finalPrice = Math.floor((basePrice + variance) * sizeMultiplier);
  
  const xrpPrice = Math.max(10, finalPrice); // Minimum 10 XRP
  const isEarlyBird = plotIndex < 500; // First 500 plots get early bird
  const discountedPrice = isEarlyBird ? Math.floor(xrpPrice * 0.25) : xrpPrice;
  
  return {
    xrp_price: xrpPrice,
    rdl_price: xrpPrice * 1000, // 1:1000 conversion
    early_bird_discount: isEarlyBird ? 75 : 0,
    discounted_xrp_price: discountedPrice,
    discounted_rdl_price: discountedPrice * 1000
  };
};

// Generate yield calculations
const calculateYield = (terrain: string, xrpPrice: number) => {
  const yieldPercentages = {
    forest: 8,
    mountain: 10,
    plains: 7,
    water: 9,
    village: 12,
    castle: 15
  };

  const baseYield = yieldPercentages[terrain as keyof typeof yieldPercentages] || 8;
  const variance = Math.random() * 3; // 0-3% variance
  const finalYieldPercent = baseYield + variance;
  const yearlyYield = Math.floor(xrpPrice * (finalYieldPercent / 100));

  return {
    yearly_yield: yearlyYield,
    yield_percentage: Math.round(finalYieldPercent * 100) / 100
  };
};

// Generate all 1000 land plot metadata files
export const generateAllLandPlotMetadata = () => {
  const metadataDir = path.join(process.cwd(), 'public', 'nft-metadata', 'land-plots');
  
  // Ensure directory exists
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const terrainTypes = ['forest', 'mountain', 'plains', 'water', 'village'];
  const generatedPlots: LandPlotNFTMetadata[] = [];

  console.log('🏰 Generating 1000 land plot NFT metadata files...');

  for (let i = 0; i < 1000; i++) {
    const x = i % 40;
    const y = Math.floor(i / 40);
    
    // Deterministic terrain selection based on position
    const terrainIndex = (x + y * 7) % terrainTypes.length;
    const terrain = terrainTypes[terrainIndex];
    
    // Deterministic size calculation
    const sizeRoll = Math.sin(i * 0.13) * 0.5 + 0.5; // 0-1 range
    let sizeMultiplier = 1;
    if (sizeRoll > 0.95) sizeMultiplier = 3; // 5% chance for 3x
    else if (sizeRoll > 0.75) sizeMultiplier = 2; // 20% chance for 2x

    const traits = getTerrainTraits(terrain, x, y, sizeMultiplier);
    const pricing = calculatePricing(terrain, sizeMultiplier, i);
    const yields = calculateYield(terrain, pricing.xrp_price);

    const metadata: LandPlotNFTMetadata = {
      id: i + 1,
      name: `Trolls Inquisition Land Plot #${i + 1}`,
      description: `A ${terrain} domain at coordinates (${x}, ${y}) in the Trolls Inquisition realm. This ${sizeMultiplier}x sizeable plot contains ${traits.resources.join(', ')} and offers ${yields.yield_percentage}% yearly yield. Part of the legendary 1000-plot medieval kingdom where epic battles and alliances are forged.`,
      image: `https://riddleswap.replit.app/api/nft-images/land-plots/${i + 1}.png`,
      external_url: `https://riddleswap.replit.app/nft-gaming-dashboard?plot=${i + 1}`,
      attributes: [
        { trait_type: "Terrain Type", value: terrain },
        { trait_type: "X Coordinate", value: x },
        { trait_type: "Y Coordinate", value: y },
        { trait_type: "Size Multiplier", value: `${sizeMultiplier}x` },
        { trait_type: "Resources Count", value: traits.resources.length },
        { trait_type: "Primary Resource", value: traits.resources[0] || "None" },
        { trait_type: "Rarity Score", value: traits.rarity_score },
        { trait_type: "XRP Price", value: pricing.xrp_price },
        { trait_type: "Early Bird Eligible", value: pricing.early_bird_discount > 0 ? "Yes" : "No" },
        { trait_type: "Yearly Yield (XRP)", value: yields.yearly_yield },
        { trait_type: "Yield Percentage", value: `${yields.yield_percentage}%` },
        { trait_type: "Position Type", value: getPositionType(x, y) }
      ],
      properties: {
        coordinates: { x, y },
        terrain_type: terrain,
        resources: traits.resources,
        size_multiplier: sizeMultiplier,
        xrp_price: pricing.xrp_price,
        rdl_price: pricing.rdl_price,
        early_bird_discount: pricing.early_bird_discount,
        yearly_yield: yields.yearly_yield,
        yield_percentage: yields.yield_percentage,
        rarity_score: traits.rarity_score
      }
    };

    // Write individual JSON file
    const fileName = `${i + 1}.json`;
    const filePath = path.join(metadataDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));

    generatedPlots.push(metadata);

    if ((i + 1) % 100 === 0) {
      console.log(`✅ Generated ${i + 1}/1000 metadata files`);
    }
  }

  // Create summary file
  const summaryPath = path.join(metadataDir, '_collection_summary.json');
  const collectionSummary = {
    name: "Trolls Inquisition Land Plots",
    description: "1000 unique medieval land plots in the Trolls Inquisition Multi-Chain Mayhem Edition",
    total_plots: 1000,
    grid_size: "40x25",
    terrain_distribution: getTerrainDistribution(generatedPlots),
    rarity_distribution: getRarityDistribution(generatedPlots),
    price_range: getPriceRange(generatedPlots),
    generated_at: new Date().toISOString()
  };
  
  fs.writeFileSync(summaryPath, JSON.stringify(collectionSummary, null, 2));

  console.log('🎉 Successfully generated all 1000 land plot NFT metadata files!');
  console.log(`📁 Files saved to: ${metadataDir}`);
  
  return generatedPlots;
};

// Helper functions
const getPositionType = (x: number, y: number): string => {
  if ((x === 0 || x === 39) && (y === 0 || y === 24)) return "Corner";
  if (x === 0 || x === 39 || y === 0 || y === 24) return "Border";
  if (x >= 18 && x <= 22 && y >= 11 && y <= 14) return "Center";
  return "Inner";
};

const getTerrainDistribution = (plots: LandPlotNFTMetadata[]) => {
  const distribution: Record<string, number> = {};
  plots.forEach(plot => {
    const terrain = plot.properties.terrain_type;
    distribution[terrain] = (distribution[terrain] || 0) + 1;
  });
  return distribution;
};

const getRarityDistribution = (plots: LandPlotNFTMetadata[]) => {
  const rare = plots.filter(p => p.properties.rarity_score >= 50).length;
  const epic = plots.filter(p => p.properties.rarity_score >= 40).length;
  const uncommon = plots.filter(p => p.properties.rarity_score >= 30).length;
  const common = plots.length - uncommon;
  
  return { common, uncommon, epic, rare };
};

const getPriceRange = (plots: LandPlotNFTMetadata[]) => {
  const prices = plots.map(p => p.properties.xrp_price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  };
};

// Update land plot metadata (make it mutable)
export const updateLandPlotMetadata = (plotId: number, updates: Partial<LandPlotNFTMetadata>, foundingWallets?: string[]) => {
  const metadataDir = path.join(process.cwd(), 'public', 'nft-metadata', 'land-plots');
  const fileName = `${plotId}.json`;
  const filePath = path.join(metadataDir, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Metadata file for plot ${plotId} not found`);
  }

  // Read existing metadata
  const existingMetadata = JSON.parse(fs.readFileSync(filePath, 'utf8')) as LandPlotNFTMetadata;

  // Add founding riddle wallets to properties
  if (foundingWallets && foundingWallets.length > 0) {
    existingMetadata.properties = {
      ...existingMetadata.properties,
      founding_riddle_wallets: foundingWallets
    };

    // Also add as attributes
    existingMetadata.attributes.push({
      trait_type: "Founding Riddle Wallets",
      value: foundingWallets.length
    });
  }

  // Merge updates
  const updatedMetadata = {
    ...existingMetadata,
    ...updates,
    attributes: updates.attributes || existingMetadata.attributes,
    properties: {
      ...existingMetadata.properties,
      ...updates.properties
    }
  };

  // Write updated metadata
  fs.writeFileSync(filePath, JSON.stringify(updatedMetadata, null, 2));

  console.log(`✅ Updated metadata for land plot ${plotId}`);
  return updatedMetadata;
};

// Add NFT metadata update endpoint
export const addFoundingRiddleWallets = (plotId: number, ownerWallet: string) => {
  // Get current founding wallets from environment or default
  const foundingWallets = process.env.RIDDLE_FOUNDING_WALLETS?.split(',') || [
    'rGDJxq11nj6gstTrUKND3NtAaLtSUGqvDY', // RiddleNFTBroker
    'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', // Example founding wallet
    'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'  // Example founding wallet
  ];

  // Add owner wallet to the list
  const allWallets = [...foundingWallets, ownerWallet];

  return updateLandPlotMetadata(plotId, {}, allWallets);
};

// Run generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllLandPlotMetadata();
}