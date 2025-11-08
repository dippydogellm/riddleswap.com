import { CollectionShowcase } from '@/components/collection-showcase';

export default function UnderTheBridgeCollection() {
  return (
    <CollectionShowcase
      collectionName="Under The Bridge: Troll"
      collectionSlug="under-the-bridge"
      description="Venture beneath the ancient bridge where trolls guard forgotten treasures and secrets of old. This collection features 710 unique troll NFTs, each with distinct traits and mysterious lore from the depths. Guardians of the bridge, keepers of riddles, and masters of the shadows - join the troll army and discover what lies beneath."
      issuerAddress="rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
      taxon={9}
      xrpCafeUrl="https://xrp.cafe/collection/under-the-bridge-troll"
      themeColors={{
        primary: 'from-slate-600 to-stone-700',
        secondary: 'slate'
      }}
      additionalInfo={{
        supply: 710,
        basePower: 300,
        role: 'Bank Guardians',
        mintingStatus: 'LIVE',
        features: [
          '710 unique troll warriors',
          'Guardian of the ancient bridge',
          'Base power level: 300',
          'Bank management specialists',
          'Mysterious underground lore',
          'Rare shadow abilities'
        ]
      }}
    />
  );
}
