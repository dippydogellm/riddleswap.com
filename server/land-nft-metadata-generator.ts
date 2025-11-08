/**
 * Land NFT Metadata Generator
 * Creates JSON metadata files for land plot NFTs following NFT standards
 */

interface LandPlot {
  plotNumber: number;
  mapX: number;
  mapY: number;
  gridSection: string;
  latitude: number;
  longitude: number;
  terrainType: string;
  terrainSubtype: string;
  basePrice: number;
  plotSize: string;
  sizeMultiplier: number;
  yieldRate: number;
  specialFeatures: string[];
  resourceNodes: Record<string, any>;
  description: string;
  lore: string;
}

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  properties: {
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
}

class LandNFTMetadataGenerator {
  private readonly ISSUER_ADDRESS = 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH';
  private readonly TAXON = 4; // Land plots taxon
  
  /**
   * Generate NFT metadata for a land plot
   */
  generateMetadata(plot: LandPlot, imageUrl: string): NFTMetadata {
    const { 
      plotNumber, mapX, mapY, gridSection, 
      latitude, longitude, terrainType, terrainSubtype,
      plotSize, sizeMultiplier, yieldRate, 
      specialFeatures, resourceNodes, description, lore 
    } = plot;
    
    // Build attributes array following OpenSea/Rarible standards
    const attributes = [
      // Geographic attributes
      {
        trait_type: 'Grid Section',
        value: gridSection
      },
      {
        trait_type: 'Map X',
        value: mapX,
        display_type: 'number'
      },
      {
        trait_type: 'Map Y',
        value: mapY,
        display_type: 'number'
      },
      {
        trait_type: 'Latitude',
        value: latitude.toFixed(4)
      },
      {
        trait_type: 'Longitude',
        value: longitude.toFixed(4)
      },
      
      // Terrain attributes
      {
        trait_type: 'Terrain Type',
        value: this.capitalizeWords(terrainType)
      },
      {
        trait_type: 'Terrain Subtype',
        value: this.capitalizeWords(terrainSubtype.replace(/_/g, ' '))
      },
      
      // Size and value attributes
      {
        trait_type: 'Plot Size',
        value: this.capitalizeWords(plotSize)
      },
      {
        trait_type: 'Size Multiplier',
        value: sizeMultiplier,
        display_type: 'number'
      },
      {
        trait_type: 'Yield Rate',
        value: `${yieldRate.toFixed(2)}%`,
        display_type: 'boost_percentage'
      },
      
      // Resources
      {
        trait_type: 'Resource Count',
        value: Object.keys(resourceNodes).length,
        display_type: 'number'
      }
    ];
    
    // Add resource types
    Object.keys(resourceNodes).forEach((resource, index) => {
      if (index < 5) { // Limit to 5 resources to avoid too many traits
        attributes.push({
          trait_type: `Resource ${index + 1}`,
          value: this.capitalizeWords(resource.replace(/_/g, ' '))
        });
      }
    });
    
    // Add special features
    specialFeatures.forEach((feature, index) => {
      attributes.push({
        trait_type: `Special Feature ${index + 1}`,
        value: this.capitalizeWords(feature.replace(/_/g, ' '))
      });
    });
    
    // Build metadata object
    const metadata: NFTMetadata = {
      name: `The Trolls Inquisition - Land Plot #${plotNumber}`,
      description: `${description}\n\n📜 Lore: ${lore}\n\n🗺️ Location: ${gridSection} (${latitude.toFixed(2)}°N, ${Math.abs(longitude).toFixed(2)}°W)\n\n⚔️ Part of The Trolls Inquisition medieval gaming ecosystem.`,
      image: imageUrl,
      external_url: `https://riddleswap.com/gaming/land/${plotNumber}`,
      attributes,
      properties: {
        category: 'land',
        creators: [
          {
            address: this.ISSUER_ADDRESS,
            share: 100
          }
        ]
      }
    };
    
    return metadata;
  }

  /**
   * Generate metadata for multiple plots
   */
  generateBatchMetadata(plots: LandPlot[], imageUrls: Map<number, string>): Map<number, NFTMetadata> {
    const metadataMap = new Map<number, NFTMetadata>();
    
    console.log(`📝 [LAND-META] Generating metadata for ${plots.length} plots...`);
    
    for (const plot of plots) {
      const imageUrl = imageUrls.get(plot.plotNumber);
      
      if (!imageUrl) {
        console.warn(`⚠️ [LAND-META] No image URL for Plot #${plot.plotNumber}, using placeholder`);
        const placeholderImage = `https://via.placeholder.com/1024x1024.png?text=Land+Plot+${plot.plotNumber}`;
        const metadata = this.generateMetadata(plot, placeholderImage);
        metadataMap.set(plot.plotNumber, metadata);
      } else {
        const metadata = this.generateMetadata(plot, imageUrl);
        metadataMap.set(plot.plotNumber, metadata);
      }
    }
    
    console.log(`✅ [LAND-META] Generated metadata for ${metadataMap.size} plots`);
    return metadataMap;
  }

  /**
   * Convert metadata to IPFS-ready JSON string
   */
  toJSON(metadata: NFTMetadata): string {
    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Helper: Capitalize words
   */
  private capitalizeWords(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
}

export const landNFTMetadataGenerator = new LandNFTMetadataGenerator();
