import { useDynamicMetadata, GAMING_METADATA } from "@/hooks/use-dynamic-metadata";
import WeaponsMarketplace from "@/components/WeaponsMarketplace";

export const WeaponsArsenal = () => {
  // Set SEO metadata for weapons arsenal
  useDynamicMetadata(GAMING_METADATA.weaponsArsenal);
  
  return <WeaponsMarketplace />;
};
