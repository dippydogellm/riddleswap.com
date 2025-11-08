import { Router } from 'express';
import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { sessionAuth } from './middleware/session-auth';

const router = Router();

// Generic payment sending endpoint for all chains
router.post('/api/payment/send', sessionAuth, async (req, res) => {
  const { 
    toAddress, 
    amount, 
    chain, 
    asset, 
    tokenCurrency, 
    tokenIssuer,
    destinationTag,
    memo 
  } = req.body;
  
  // The sessionAuth middleware populates req.session with cached keys directly
  const cachedKeys = (req as any).session;
  
  if (!cachedKeys || typeof cachedKeys !== 'object') {
    console.error('❌ [PAYMENT] No cached keys available - session not populated');
    return res.status(401).json({ success: false, error: 'Authentication keys not available' });
  }
  
  console.log('✅ [PAYMENT] Cached keys found for chains:', Object.keys(cachedKeys));
  
  try {
    // Handle XRP payments
    if (chain === 'xrp') {
      const privateKey = cachedKeys.xrpPrivateKey;
      if (!privateKey) {
        return res.status(401).json({ success: false, error: 'XRP wallet not available' });
      }
      
      const client = new Client('wss://s1.ripple.com');
      await client.connect();
      
      try {
        const wallet = Wallet.fromSeed(privateKey);
        console.log(`💸 [PAYMENT] Sending from ${wallet.address} to ${toAddress}`);
        
        // BALANCE VALIDATION: Check available balance before proceeding
        console.log('💰 [BALANCE CHECK] Validating available balance before payment...');
        
        try {
          const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address
          });
          
          const serverInfo = await client.request({ command: 'server_info' });
          
          const accountData = accountInfo.result.account_data;
          const totalBalance = parseFloat(accountData.Balance) / 1000000; // Convert drops to XRP
          const ownerCount = accountData.OwnerCount || 0;
          
          const validatedLedger = serverInfo.result?.info?.validated_ledger;
          const baseReserve = parseFloat(String(validatedLedger?.reserve_base_xrp || '10'));
          const ownerReserve = parseFloat(String(validatedLedger?.reserve_inc_xrp || '2'));
          
          const totalReserved = baseReserve + (ownerReserve * ownerCount);
          const availableBalance = Math.max(0, totalBalance - totalReserved);
          
          // Check balance based on asset type
          if (asset === 'native') {
            // XRP payment - check available XRP balance
            const requestedAmount = parseFloat(amount);
            const estimatedNetworkFee = 0.000012; // Standard network fee
            const totalRequired = requestedAmount + estimatedNetworkFee;
            
            console.log(`💰 [BALANCE CHECK] XRP Payment: Available=${availableBalance.toFixed(6)}, Required=${totalRequired.toFixed(6)} (${requestedAmount} + ${estimatedNetworkFee} fee)`);
            
            if (availableBalance < totalRequired) {
              await client.disconnect();
              return res.status(400).json({
                success: false,
                error: `Insufficient available balance. You have ${availableBalance.toFixed(6)} XRP available (${totalBalance.toFixed(6)} total - ${totalReserved.toFixed(2)} reserved), but need ${totalRequired.toFixed(6)} XRP for this payment (${requestedAmount} + ${estimatedNetworkFee} network fee).`
              });
            }
          } else {
            // Token payment - check if we have enough XRP for network fees
            const estimatedNetworkFee = 0.000012;
            
            console.log(`💰 [BALANCE CHECK] Token Payment: Available XRP=${availableBalance.toFixed(6)}, Network Fee=${estimatedNetworkFee}`);
            
            if (availableBalance < estimatedNetworkFee) {
              await client.disconnect();
              return res.status(400).json({
                success: false,
                error: `Insufficient XRP for network fees. You need at least ${estimatedNetworkFee} XRP available for transaction fees, but only have ${availableBalance.toFixed(6)} XRP available.`
              });
            }
            
            // TODO: For token payments, we should also validate token balance
            console.log(`⚠️ [BALANCE CHECK] Token balance validation not implemented yet for ${tokenCurrency}`);
          }
          
          console.log('✅ [BALANCE CHECK] Sufficient balance confirmed');
          
        } catch (balanceError) {
          console.error('⚠️ [BALANCE CHECK] Balance validation failed:', balanceError);
          await client.disconnect();
          return res.status(500).json({
            success: false,
            error: 'Unable to verify wallet balance. Please try again.'
          });
        }
        
        // Build transaction based on asset type
        let transaction: any;
        
        if (asset === 'native') {
          // Native XRP payment - NEVER use tfPartialPayment for safety
          transaction = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: toAddress,
            Amount: xrpToDrops(amount)
            // NO FLAGS: tfPartialPayment is dangerous for native XRP payments
          };
        } else {
          // Token payment - only use tfPartialPayment when explicitly needed
          transaction = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: toAddress,
            Amount: {
              currency: tokenCurrency,
              value: amount,
              issuer: tokenIssuer
            }
            // NO FLAGS: tfPartialPayment only when DeliverMin/SendMax are provided
          };
        }
        
        // Add optional fields
        if (destinationTag) {
          transaction.DestinationTag = destinationTag;
        }
        
        if (memo) {
          transaction.Memos = [{
            Memo: {
              MemoType: Buffer.from('text', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
            }
          }];
        }
        
        // Prepare and submit transaction
        const prepared = await client.autofill(transaction);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        const meta = result.result.meta as any;
        const success = meta?.TransactionResult === 'tesSUCCESS';
        
        if (success) {
          console.log(`✅ [PAYMENT] Transaction successful: ${result.result.hash}`);
          
          res.json({
            success: true,
            hash: result.result.hash,
            message: `Successfully sent ${amount} ${asset === 'native' ? 'XRP' : tokenCurrency}`,
            explorerUrl: `https://livenet.xrpl.org/transactions/${result.result.hash}`
          });
        } else {
          throw new Error(`Transaction failed: ${meta?.TransactionResult || 'Unknown error'}`);
        }
        
      } finally {
        await client.disconnect();
      }
      
    } else if (chain === 'eth' || chain === 'polygon' || chain === 'base' || chain === 'arbitrum' || chain === 'optimism' || chain === 'bnb') {
      // Handle EVM chain payments
      const privateKey = cachedKeys.ethPrivateKey;
      if (!privateKey) {
        return res.status(401).json({ success: false, error: 'Ethereum wallet not available' });
      }
      
      // TODO: Implement EVM payment logic
      return res.status(501).json({ 
        success: false, 
        error: 'EVM payments not yet implemented' 
      });
      
    } else if (chain === 'sol') {
      // Handle Solana payments
      const privateKey = cachedKeys.solPrivateKey;
      if (!privateKey) {
        return res.status(401).json({ success: false, error: 'Solana wallet not available' });
      }
      
      // TODO: Implement Solana payment logic
      return res.status(501).json({ 
        success: false, 
        error: 'Solana payments not yet implemented' 
      });
      
    } else if (chain === 'btc') {
      // Handle Bitcoin payments
      const privateKey = cachedKeys.btcPrivateKey;
      if (!privateKey) {
        return res.status(401).json({ success: false, error: 'Bitcoin wallet not available' });
      }
      
      console.log('💸 [BTC PAYMENT] Processing Bitcoin payment...');
      
      // Import Bitcoin libraries
      const bitcoin = await import('bitcoinjs-lib');
      const ECPair = await import('ecpair');
      const tinysecp = await import('tiny-secp256k1');
      
      // Initialize ECPair factory
      const ECPairFactory = ECPair.ECPairFactory(tinysecp);
      
      try {
        // Create key pair from private key (assuming hex format)
        const keyPair = ECPairFactory.fromPrivateKey(Buffer.from(privateKey, 'hex'));
        const pubkey = Buffer.from(keyPair.publicKey);
        const { address } = bitcoin.payments.p2pkh({ pubkey, network: bitcoin.networks.bitcoin });
        
        console.log(`💸 [BTC PAYMENT] Sending from ${address} to ${toAddress}`);
        
        // Get UTXOs from blockchain API
        const getUTXOs = async (btcAddress: string): Promise<any[]> => {
          try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`https://blockstream.info/api/address/${btcAddress}/utxo`);
            if (!response.ok) {
              throw new Error('Failed to fetch UTXOs');
            }
            const utxos = await response.json() as any[];
            return utxos.map((utxo: any) => ({
              txid: utxo.txid,
              vout: utxo.vout,
              value: utxo.value,
              status: utxo.status
            }));
          } catch (error) {
            console.error('❌ [BTC PAYMENT] Failed to get UTXOs:', error);
            return [];
          }
        };
        
        const utxos = await getUTXOs(address!);
        console.log(`💰 [BTC PAYMENT] Found ${utxos.length} UTXOs`);
        
        if (utxos.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No UTXOs available for spending'
          });
        }
        
        // SIMPLE FEE CALCULATION: $7.50 + 1%
        const satoshiAmount = Math.floor(parseFloat(amount) * 100000000);
        
        // Get current BTC price (simple fetch)
        const getBTCPrice = async (): Promise<number> => {
          try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const data = await response.json() as any;
            return data.bitcoin.usd;
          } catch {
            return 115000; // Fallback price ~$115k
          }
        };
        
        const btcPriceUSD = await getBTCPrice();
        const feeUSD = 7.50; // Fixed $7.50 fee
        const feeBTC = feeUSD / btcPriceUSD;
        const fee = Math.floor(feeBTC * 100000000); // Convert to satoshis
        
        // Add 1% to transaction amount
        const onePercentFee = Math.floor(satoshiAmount * 0.01);
        const totalFee = fee + onePercentFee;
        
        console.log(`💰 [BTC FEE] BTC Price: $${btcPriceUSD.toLocaleString()}`);
        console.log(`💰 [BTC FEE] Base fee: $${feeUSD} (${fee} sats)`);
        console.log(`💰 [BTC FEE] 1% amount fee: ${onePercentFee} sats`);
        console.log(`💰 [BTC FEE] Total fee: ${totalFee} sats`);
        
        let totalInput = 0;
        const selectedUtxos: any[] = [];
        
        // Select UTXOs
        for (const utxo of utxos) {
          if (utxo.status.confirmed) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            if (totalInput >= satoshiAmount + totalFee) {
              break;
            }
          }
        }
        
        console.log(`💰 [BTC PAYMENT] Selected ${selectedUtxos.length} UTXOs, Total: ${totalInput} satoshis`);
        console.log(`💸 [BTC PAYMENT] Amount: ${satoshiAmount}, Total Fee: ${totalFee}, Total needed: ${satoshiAmount + totalFee}`);
        
        if (totalInput < satoshiAmount + totalFee) {
          return res.status(400).json({
            success: false,
            error: `Insufficient funds. Available: ${(totalInput / 100000000).toFixed(8)} BTC, Required: ${((satoshiAmount + totalFee) / 100000000).toFixed(8)} BTC (includes $7.50 + 1% fee)`
          });
        }
        
        // Build transaction
        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
        
        // Add inputs
        for (const utxo of selectedUtxos) {
          // Get transaction hex for each UTXO
          const fetch = (await import('node-fetch')).default;
          const txResponse = await fetch(`https://blockstream.info/api/tx/${utxo.txid}/hex`);
          const txHex = await txResponse.text();
          
          psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            nonWitnessUtxo: Buffer.from(txHex, 'hex')
          });
        }
        
        // Add output to recipient
        psbt.addOutput({
          address: toAddress,
          value: satoshiAmount
        });
        
        // Add change output if needed
        const change = totalInput - satoshiAmount - totalFee;
        if (change > 546) { // Dust limit
          psbt.addOutput({
            address: address!,
            value: change
          });
          console.log(`💰 [BTC PAYMENT] Change output: ${(change / 100000000).toFixed(8)} BTC`);
        }
        
        // Create a proper Signer for PSBT
        const signer = {
          publicKey: pubkey,
          sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash))
        };
        
        // Sign all inputs
        psbt.signAllInputs(signer);
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        const txId = tx.getId();
        
        console.log(`💸 [BTC PAYMENT] Transaction built, ID: ${txId}`);
        
        // Broadcast transaction
        const broadcastTransaction = async (hex: string): Promise<string> => {
          try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch('https://blockstream.info/api/tx', {
              method: 'POST',
              body: hex,
              headers: {
                'Content-Type': 'text/plain'
              }
            });
            
            if (!response.ok) {
              const error = await response.text();
              throw new Error(`Broadcast failed: ${error}`);
            }
            
            return await response.text(); // Returns transaction ID
          } catch (error) {
            console.error('❌ [BTC PAYMENT] Broadcast failed:', error);
            throw error;
          }
        };
        
        const broadcastedTxId = await broadcastTransaction(txHex);
        
        console.log(`✅ [BTC PAYMENT] Transaction broadcasted: ${broadcastedTxId}`);
        
        res.json({
          success: true,
          hash: broadcastedTxId,
          message: `Successfully sent ${amount} BTC`,
          explorerUrl: `https://mempool.space/tx/${broadcastedTxId}`
        });
        
      } catch (error) {
        console.error('❌ [BTC PAYMENT] Payment failed:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Bitcoin payment failed'
        });
      }
      
    } else {
      return res.status(400).json({ 
        success: false, 
        error: `Unsupported chain: ${chain}` 
      });
    }
    
  } catch (error) {
    console.error('❌ [PAYMENT] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    });
  }
});

export default router;