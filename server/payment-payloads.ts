// XRPL NFT Payment Payloads for RiddleSwap NFT Marketplace
// Implements brokered transactions with fee separation following XRPL standards

export interface NFTPaymentPayload {
  transactionType: 'NFTokenSellOffer' | 'NFTokenBuyOffer' | 'NFTokenAcceptOffer';
  nftokenID: string;
  amount: string; // In drops (1 XRP = 1,000,000 drops)
  account: string; // Sender wallet address
  destination?: string; // Recipient or broker address
  destinationTag?: number; // For marketplace routing
  brokerFee?: string; // Marketplace fee in drops
  expiration?: number; // Unix timestamp
  flags?: number;
}

export interface RiddleBrokerConfig {
  brokerWallet: string;
  brokerSecret: string;
  feePercentage: number; // 1% = 0.01 (standard RiddleSwap fee)
  minimumReserve: string; // 200000 drops (0.2 XRP)
  networkFee: string; // 10 drops (0.00001 XRP)
}

// SECURITY: RiddleNFTBroker configuration from environment variables only
export const RIDDLE_BROKER_CONFIG: RiddleBrokerConfig = {
  brokerWallet: process.env.RIDDLE_BROKER_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', // RiddleSwap treasury/bank wallet
  brokerSecret: process.env.RIDDLE_BROKER_SECRET || '',
  feePercentage: 0.01, // 1% marketplace fee (like other RiddleSwap services)
  minimumReserve: '200000', // 0.2 XRP reserve for offers
  networkFee: '10' // Standard XRPL network fee
};

// Buy Now Payment Payload (Accepting a Sell Offer)
export function createBuyNowPayload(
  nftokenID: string,
  sellOfferIndex: string,
  buyerWallet: string,
  sellerPrice: string
): NFTPaymentPayload {
  const sellerPriceDrops = Math.floor(parseFloat(sellerPrice) * 1000000);
  const brokerFee = Math.floor(sellerPriceDrops * RIDDLE_BROKER_CONFIG.feePercentage);
  const totalAmount = sellerPriceDrops + brokerFee;

  return {
    transactionType: 'NFTokenAcceptOffer',
    nftokenID,
    amount: totalAmount.toString(),
    account: buyerWallet,
    destination: RIDDLE_BROKER_CONFIG.brokerWallet,
    brokerFee: brokerFee.toString(),
    flags: 0
  };
}

// Make Offer Payment Payload (Creating a Buy Offer)
export function createMakeOfferPayload(
  nftokenID: string,
  buyerWallet: string,
  offerAmount: string,
  expiration?: number
): NFTPaymentPayload {
  const offerAmountDrops = Math.floor(parseFloat(offerAmount) * 1000000);
  const brokerFee = Math.floor(offerAmountDrops * RIDDLE_BROKER_CONFIG.feePercentage);
  const totalAmount = offerAmountDrops + brokerFee;

  return {
    transactionType: 'NFTokenBuyOffer',
    nftokenID,
    amount: totalAmount.toString(),
    account: buyerWallet,
    destination: RIDDLE_BROKER_CONFIG.brokerWallet,
    brokerFee: brokerFee.toString(),
    expiration,
    flags: 0
  };
}

// List NFT Payment Payload (Creating a Sell Offer)
export function createListNFTPayload(
  nftokenID: string,
  sellerWallet: string,
  listPrice: string,
  expiration?: number
): NFTPaymentPayload {
  const listPriceDrops = Math.floor(parseFloat(listPrice) * 1000000);

  return {
    transactionType: 'NFTokenSellOffer',
    nftokenID,
    amount: listPriceDrops.toString(),
    account: sellerWallet,
    destination: RIDDLE_BROKER_CONFIG.brokerWallet, // Restrict to broker
    expiration,
    flags: 1 // tfSellNFToken flag
  };
}

// Accept Offer Payment Payload (Seller accepts buy offer)
export function createAcceptOfferPayload(
  nftokenID: string,
  buyOfferIndex: string,
  sellerWallet: string,
  offerAmount: string
): NFTPaymentPayload {
  const offerAmountDrops = Math.floor(parseFloat(offerAmount) * 1000000);
  const brokerFee = Math.floor(offerAmountDrops * RIDDLE_BROKER_CONFIG.feePercentage);

  return {
    transactionType: 'NFTokenAcceptOffer',
    nftokenID,
    amount: offerAmountDrops.toString(),
    account: sellerWallet,
    destination: RIDDLE_BROKER_CONFIG.brokerWallet,
    brokerFee: brokerFee.toString(),
    flags: 0
  };
}

// Cancel Offer Payment Payload
export function createCancelOfferPayload(
  nftokenOfferIndex: string,
  walletAddress: string
): any {
  return {
    TransactionType: 'NFTokenCancelOffer',
    Account: walletAddress,
    NFTokenOfferID: nftokenOfferIndex,
    Fee: RIDDLE_BROKER_CONFIG.networkFee
  };
}

// Fee calculation utilities - implements 1% broker fee like xrp.cafe model
export function calculateTotalCost(basePrice: string): {
  basePrice: number;
  brokerFee: number;
  networkFee: number;
  totalCost: number;
} {
  const basePriceXRP = parseFloat(basePrice);
  const brokerFeeXRP = basePriceXRP * RIDDLE_BROKER_CONFIG.feePercentage; // 1% fee collected by RiddleSwap treasury
  const networkFeeXRP = parseFloat(RIDDLE_BROKER_CONFIG.networkFee) / 1000000;
  const totalCostXRP = basePriceXRP + brokerFeeXRP + networkFeeXRP;

  return {
    basePrice: basePriceXRP,
    brokerFee: brokerFeeXRP,
    networkFee: networkFeeXRP,
    totalCost: totalCostXRP
  };
}

export function formatXRPAmount(drops: string): string {
  return (parseFloat(drops) / 1000000).toFixed(6);
}

export function formatDropsAmount(xrp: string): string {
  return Math.floor(parseFloat(xrp) * 1000000).toString();
}

// Mint NFT Payment Payload with Mint Price
export function createMintNFTPayload(
  minterWallet: string,
  taxon: number,
  mintPrice: number, // Mint price in XRP
  destinationWallet: string, // Collection issuer wallet
  metadataUri?: string,
  transferFee?: number,
  flags?: number
): any {
  const mintPriceDrops = Math.floor(mintPrice * 1000000);
  
  return {
    TransactionType: 'Payment',
    Account: minterWallet,
    Destination: destinationWallet,
    Amount: mintPriceDrops.toString(),
    DestinationTag: taxon, // Use taxon as destination tag to identify collection
    Memos: [{
      Memo: {
        MemoType: Buffer.from('mint-request', 'utf8').toString('hex').toUpperCase(),
        MemoData: Buffer.from(`taxon:${taxon}`, 'utf8').toString('hex').toUpperCase()
      }
    }],
    Fee: '12' // Standard XRPL network fee
  };
}