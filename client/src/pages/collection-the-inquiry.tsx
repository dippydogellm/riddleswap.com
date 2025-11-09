import { CollectionShowcaseV3 } from '@/components/collection-showcase-v3';

export default function TheInquiryCollection() {
  return (
    <CollectionShowcaseV3
      collectionName="The Inquiry"
      collectionSlug="the-inquiry"
      description="What makes a riddle? What makes us ask? Explore the mystery together as we journey through a vibrantly abstract and absurdist tale of the riddle and the blockchain. 123 unique AI-rendered NFTs that question reality, challenge perception, and invite you to discover the deeper meaning behind every enigma. The origin story of RiddleSwap begins here."
      issuerAddress="rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH"
      taxon={0}
      xrpCafeUrl="https://xrp.cafe/collection/the-inquiry"
      themeColors={{
        primary: 'from-purple-500 to-pink-600',
        secondary: 'purple'
      }}
      additionalInfo={{
        supply: 123,
        basePower: 600,
        role: 'Special Forces',
        mintingStatus: 'MINTING NOW',
        features: [
          '123 AI-rendered unique pieces',
          'Origin collection of RiddleSwap',
          'Highest base power: 600',
          'Special forces designation',
          'Abstract artistic style',
          'Philosophical storytelling'
        ]
      }}
    />
  );
}
