import { CollectionShowcase } from '@/components/collection-showcase';

export default function TheInquisitionCollection() {
  return (
    <CollectionShowcase
      collectionName="The Inquisition"
      collectionSlug="the-inquisition"
      description="Find peace in having nothing. Find strength in having something. Find drive in wanting it all. Welcome, to the Inquisition. Abstract, and from the World of RDL explore conflict excitement and enchantment as a community. Be a collector. Be riddle. Build your Sanctum. With over 1,000 unique NFTs, each warrior brings their own power and story to the battlefield."
      issuerAddress="rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
      taxon={2}
      xrpCafeUrl="https://xrp.cafe/collection/theinquisition"
      heroImage="https://cdn.xrp.cafe/1444e060f8b9-4717-98fc-dbd88a46cc3f.webp"
      themeColors={{
        primary: 'from-orange-500 to-red-600',
        secondary: 'orange'
      }}
      additionalInfo={{
        supply: 1007,
        basePower: 500,
        role: 'Army Division',
        mintingStatus: 'MINTING NOW',
        features: [
          '1,007 unique warriors minted',
          'The flagship army collection',
          'Base power level: 500',
          'Medieval combat specialists',
          'Dynamic trait system',
          'Epic battle scenarios'
        ]
      }}
    />
  );
}
