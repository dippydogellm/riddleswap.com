import { CollectionShowcase } from '@/components/collection-showcase';

export default function TheLostEmporiumCollection() {
  return (
    <CollectionShowcase
      collectionName="The Lost Emporium"
      collectionSlug="the-lost-emporium"
      description="Step into The Lost Emporium, a mystical marketplace where forgotten treasures and ancient artifacts await discovery. Each of the 123 unique NFTs represents a piece of history from the World of RDL - rare items, legendary relics, and magical curiosities that merchants once traded across realms. Uncover the secrets of commerce and magic intertwined."
      issuerAddress="rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
      taxon={3}
      xrpCafeUrl="https://xrp.cafe/collection/the-lost-emporium"
      themeColors={{
        primary: 'from-emerald-500 to-teal-600',
        secondary: 'emerald'
      }}
      additionalInfo={{
        supply: 123,
        basePower: 400,
        role: 'Merchant Guild',
        mintingStatus: 'LIVE',
        features: [
          '123 mystical artifacts',
          'Ancient marketplace theme',
          'Base power level: 400',
          'Trading and commerce focus',
          'Legendary relic collection',
          'Magical item properties'
        ]
      }}
    />
  );
}
