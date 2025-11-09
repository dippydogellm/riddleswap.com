import { CollectionShowcaseV3 } from '@/components/collection-showcase-v3';

export default function DantesAurumCollection() {
  return (
    <CollectionShowcaseV3
      collectionName="Dantes Aurum"
      collectionSlug="dantes-aurum"
      description="Dante's Aurum - A collection of 42 golden NFTs inspired by epic journeys and legendary tales. Each piece captures the essence of adventure, wisdom, and the eternal quest for knowledge. The rarest and most powerful collection in the RiddleSwap universe, these golden treasures represent the pinnacle of achievement and the ultimate reward for the brave."
      issuerAddress="rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
      taxon={4}
      xrpCafeUrl="https://xrp.cafe/collection/dantesaurum"
      themeColors={{
        primary: 'from-yellow-500 to-amber-600',
        secondary: 'yellow'
      }}
      additionalInfo={{
        supply: 42,
        basePower: 1000,
        role: 'Elite Special Forces',
        mintingStatus: 'LIVE',
        features: [
          'Only 42 ultra-rare pieces',
          'Highest power level: 1,000',
          'Golden legendary status',
          'Epic journey narratives',
          'Supreme combat abilities',
          'Most exclusive collection'
        ]
      }}
    />
  );
}
