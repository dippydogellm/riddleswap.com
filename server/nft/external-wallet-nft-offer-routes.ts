// External Wallet NFT Offer Routes - Unsigned Transaction Preparation for XRPL
// Supports Xaman, Joey Wallet, and Riddle wallet unsigned transactions
// Works with broker wallet for marketplace transactions

import { Express } from 'express';
import { Client, xrpToDrops } from 'xrpl';
import { dualWalletAuth } from '../middleware/dual-wallet-auth';

export function registerExternalWalletNFTOfferRoutes(app: Express) {
  console.log('🎨 Registering External Wallet NFT Offer routes...');

  // ==========================================================================
  // PREPARE CREATE BUY OFFER (Make Offer) - Unsigned transaction for Xaman/Riddle
  // ==========================================================================
  app.post('/api/nft/external/prepare-buy-offer', dualWalletAuth, async (req, res) => {
    try {
      const { 
        nftokenID, 
        amount, 
        ownerAddress,
        buyerAddress
      } = req.body;

      if (!nftokenID || !amount || !ownerAddress || !buyerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: nftokenID, amount, ownerAddress, buyerAddress'
        });
      }

      // Validate NFToken ID format
      if (!/^[A-F0-9]{64}$/i.test(nftokenID)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid NFToken ID format'
        });
      }

      // Validate addresses
      if (!/^r[a-zA-Z0-9]{24,34}$/.test(ownerAddress) || !/^r[a-zA-Z0-9]{24,34}$/.test(buyerAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid XRP address format'
        });
      }

      console.log(`📝 [PREPARE BUY OFFER] Creating unsigned buy offer for NFT: ${nftokenID}`);
      console.log(`   Buyer: ${buyerAddress}`);
      console.log(`   Owner: ${ownerAddress}`);
      console.log(`   Amount: ${amount} XRP`);

      // Connect to XRPL to get account info for auto-fill
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      try {
        // Get account info for Fee, Sequence, and LastLedgerSequence
        // Get account info and prepare base transaction
        const accountInfo = await client.request({
          command: 'account_info',
          account: buyerAddress,
          ledger_index: 'current'
        });

        const currentLedger = await client.request({
          command: 'ledger',
          ledger_index: 'validated'
        });

        // Get network fee from XRPL
        const feeResponse = await client.request({
          command: 'fee'
        });

        const networkFee = feeResponse.result.drops?.open_ledger_fee || '12';
        const sequence = accountInfo.result.account_data.Sequence;
        const lastLedgerSequence = currentLedger.result.ledger_index + 10;

        // Build unsigned NFTokenCreateOffer transaction
        // Note: Buyer pays total amount (NFT price + broker fee)
        // The broker will later accept and distribute the payment
        const unsignedTx: any = {
          TransactionType: 'NFTokenCreateOffer',
          Account: buyerAddress,
          NFTokenID: nftokenID,
          Amount: xrpToDrops(amount), // Total amount buyer is willing to pay
          Owner: ownerAddress,
          Flags: 0, // 0 = Buy Offer
          Fee: networkFee, // Network fee from XRPL
          Sequence: sequence,
          LastLedgerSequence: lastLedgerSequence
        };

        await client.disconnect();

        console.log(`✅ [PREPARE BUY OFFER] Unsigned buy offer prepared`);
        console.log(`   💡 Buyer pays total: ${amount} XRP (includes any broker fee)`);
        console.log(`   💡 Broker will accept and distribute payment when both offers exist`);

        return res.json({
          success: true,
          transaction: unsignedTx,
          operation: 'create_buy_offer',
          nftokenID,
          amount: `${amount} XRP`,
          message: `Buy offer prepared - sign with ${buyerAddress.slice(0, 8)}...`,
          note: 'Broker will accept and distribute payment after seller creates sell offer'
        });

      } catch (clientError) {
        await client.disconnect();
        throw clientError;
      }

    } catch (error) {
      console.error('❌ [PREPARE BUY OFFER] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare buy offer'
      });
    }
  });

  // ==========================================================================
  // PREPARE ACCEPT SELL OFFER (Instant Buy) - Unsigned transaction for Xaman/Riddle
  // Note: Buyer directly accepts seller's offer, paying the full amount
  // ==========================================================================
  app.post('/api/nft/external/prepare-accept-sell-offer', dualWalletAuth, async (req, res) => {
    try {
      const { 
        sellOfferID,
        buyerAddress
      } = req.body;

      if (!sellOfferID || !buyerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sellOfferID, buyerAddress'
        });
      }

      // Validate offer ID format
      if (!/^[A-F0-9]{64}$/i.test(sellOfferID)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid sell offer ID format'
        });
      }

      // Validate buyer address
      if (!/^r[a-zA-Z0-9]{24,34}$/.test(buyerAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid buyer XRP address format'
        });
      }

      console.log(`🛒 [PREPARE ACCEPT SELL] Creating unsigned accept sell offer for: ${sellOfferID}`);
      console.log(`   Buyer: ${buyerAddress}`);

      // Connect to XRPL to get account info and offer details
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      try {
        // Get sell offer details from ledger
        const offerResponse = await client.request({
          command: 'ledger_entry',
          index: sellOfferID,
          ledger_index: 'validated'
        });

        const offerNode = offerResponse.result.node as any;
        if (offerNode?.LedgerEntryType !== 'NFTokenOffer') {
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: 'Invalid offer - not an NFTokenOffer'
          });
        }

        // Use bitwise flag check for sell offers (Flags & 1 = sell offer)
        const isSellOffer = (offerNode?.Flags & 1) === 1;
        if (!isSellOffer) {
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: 'Not a sell offer - cannot accept'
          });
        }

        const amount = offerNode?.Amount;
        const nftokenID = offerNode?.NFTokenID;

        console.log(`   NFToken ID: ${nftokenID}`);
        console.log(`   Sell Price: ${amount} drops`);

        // Get buyer account info and network fee
        const accountInfo = await client.request({
          command: 'account_info',
          account: buyerAddress,
          ledger_index: 'current'
        });

        const currentLedger = await client.request({
          command: 'ledger',
          ledger_index: 'validated'
        });

        // Get network fee from XRPL
        const feeResponse = await client.request({
          command: 'fee'
        });

        const networkFee = feeResponse.result.drops?.open_ledger_fee || '12';
        const sequence = accountInfo.result.account_data.Sequence;
        const lastLedgerSequence = currentLedger.result.ledger_index + 10;

        // Build unsigned NFTokenAcceptOffer transaction
        // Buyer directly accepts the sell offer - pays the full sell price
        const unsignedTx: any = {
          TransactionType: 'NFTokenAcceptOffer',
          Account: buyerAddress,
          NFTokenSellOffer: sellOfferID,
          Fee: networkFee, // Network fee from XRPL
          Sequence: sequence,
          LastLedgerSequence: lastLedgerSequence
        };

        await client.disconnect();

        console.log(`✅ [PREPARE ACCEPT SELL] Unsigned accept sell offer prepared`);
        console.log(`   💡 Buyer pays: ${parseInt(amount) / 1000000} XRP directly to seller`);

        return res.json({
          success: true,
          transaction: unsignedTx,
          operation: 'accept_sell_offer',
          sellOfferID,
          nftokenID,
          amount: `${parseInt(amount) / 1000000} XRP`,
          message: `Accept sell offer prepared - sign with ${buyerAddress.slice(0, 8)}...`,
          note: 'Payment goes directly to seller'
        });

      } catch (clientError) {
        await client.disconnect();
        throw clientError;
      }

    } catch (error) {
      console.error('❌ [PREPARE ACCEPT SELL] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare accept sell offer'
      });
    }
  });

  // ==========================================================================
  // PREPARE CANCEL OFFER - Unsigned transaction for Xaman/Riddle
  // ==========================================================================
  app.post('/api/nft/external/prepare-cancel-offer', dualWalletAuth, async (req, res) => {
    try {
      const { 
        offerID,
        accountAddress
      } = req.body;

      if (!offerID || !accountAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: offerID, accountAddress'
        });
      }

      // Validate offer ID format
      if (!/^[A-F0-9]{64}$/i.test(offerID)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid offer ID format'
        });
      }

      // Validate account address
      if (!/^r[a-zA-Z0-9]{24,34}$/.test(accountAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid XRP address format'
        });
      }

      console.log(`❌ [PREPARE CANCEL OFFER] Creating unsigned cancel offer for: ${offerID}`);
      console.log(`   Account: ${accountAddress}`);

      // Connect to XRPL to get account info for auto-fill
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      try {
        // Get account info and network fee
        const accountInfo = await client.request({
          command: 'account_info',
          account: accountAddress,
          ledger_index: 'current'
        });

        const currentLedger = await client.request({
          command: 'ledger',
          ledger_index: 'validated'
        });

        // Get network fee from XRPL
        const feeResponse = await client.request({
          command: 'fee'
        });

        const networkFee = feeResponse.result.drops?.open_ledger_fee || '12';
        const sequence = accountInfo.result.account_data.Sequence;
        const lastLedgerSequence = currentLedger.result.ledger_index + 10;

        // Build unsigned NFTokenCancelOffer transaction
        const unsignedTx = {
          TransactionType: 'NFTokenCancelOffer',
          Account: accountAddress,
          NFTokenOffers: [offerID],
          Fee: networkFee, // Network fee from XRPL
          Sequence: sequence,
          LastLedgerSequence: lastLedgerSequence
        };

        await client.disconnect();

        console.log(`✅ [PREPARE CANCEL OFFER] Unsigned cancel offer prepared`);

        return res.json({
          success: true,
          transaction: unsignedTx,
          operation: 'cancel_offer',
          offerID,
          message: `Cancel offer prepared - sign with ${accountAddress.slice(0, 8)}...`
        });

      } catch (clientError) {
        await client.disconnect();
        throw clientError;
      }

    } catch (error) {
      console.error('❌ [PREPARE CANCEL OFFER] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare cancel offer'
      });
    }
  });

  console.log('✅ External Wallet NFT Offer routes registered successfully');
  console.log('   📝 Operations: prepare-buy-offer, prepare-accept-sell-offer, prepare-cancel-offer');
  console.log('   ⟠ Supports: Xaman, Joey Wallet, Riddle wallet unsigned transactions');
  console.log('   🏦 Broker fee support included for marketplace transactions');
}
