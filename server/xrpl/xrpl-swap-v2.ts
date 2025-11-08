import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { z } from 'zod';

// Audited input schema
export const SwapInputSchema = z.object({
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.number().positive(),
  slippagePercent: z.number().min(0.1).max(50).default(10),
  fromIssuer: z.string().optional().nullable(),
  toIssuer: z.string().optional().nullable()
});

export type SwapInput = z.infer<typeof SwapInputSchema>;

const XRPL_ENDPOINT = process.env.XRPL_WS_ENDPOINT || 'wss://xrplcluster.com';
const BANK_WALLET_XRP = process.env.RIDDLESWAP_BANK_XRP || 'rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3';
const PLATFORM_FEE_PCT = Number(process.env.RIDDLESWAP_PLATFORM_FEE_PCT || '0.25'); // percent

// Helper: normalize issuer form, allow token.issuer or plain r... address
function normalizeIssuer(issuer?: string | null): string | undefined {
  if (!issuer) return undefined;
  if (issuer.includes('.')) {
    const parts = issuer.split('.');
    return parts[parts.length - 1];
  }
  return issuer;
}

// Helper: conservative sig-fig trimming for issued currencies (max 15)
function toIssuedValue(amount: number): string {
  // cap precision conservatively
  let value = amount;
  // choose decimals based on magnitude to keep <= 15 sig figs
  if (value >= 1_000_000_000) return Math.round(value).toString();
  if (value >= 1_000_000) return value.toFixed(3);
  if (value >= 1_000) return value.toFixed(6);
  if (value >= 1) return value.toFixed(9);
  return value.toFixed(12);
}

// Price sources: use DexScreener, fallback to CoinGecko for XRP, throw otherwise
async function getUsdPrice(token: string, issuer?: string): Promise<number> {
  if (token === 'XRP') {
    try {
      const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const j = await resp.json();
      const p = Number(j?.ripple?.usd);
      if (p > 0) return p;
    } catch {}
    throw new Error('Failed to fetch XRP price');
  }
  try {
    const query = issuer ? `${token}.${normalizeIssuer(issuer)}` : token;
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${query}`);
    const j = await resp.json();
    const price = Number(j?.pairs?.[0]?.priceUsd);
    if (price > 0) return price;
  } catch {}
  throw new Error(`No USD price for ${token}`);
}

async function getOrderbookRate(
  fromToken: string,
  toToken: string,
  amount: number,
  fromIssuer?: string,
  toIssuer?: string
): Promise<number | null> {
  const client = new Client(XRPL_ENDPOINT);
  try {
    await client.connect();
    const cleanFrom = normalizeIssuer(fromIssuer);
    const cleanTo = normalizeIssuer(toIssuer);

    // Helper to parse amount objects from offers
    const getNum = (x: any): number => {
      if (typeof x === 'string') return parseFloat(String(x)) / 1_000_000; // drops -> XRP
      if (x && typeof x === 'object' && 'value' in x) return parseFloat(String(x.value));
      return 0;
    };

    if (fromToken === 'XRP' && toToken !== 'XRP' && cleanTo) {
      // Book: taker_gets = IOU (what taker receives), taker_pays = XRP
      const book = await client.request({
        command: 'book_offers',
        taker_gets: { currency: toToken, issuer: cleanTo },
        taker_pays: { currency: 'XRP' },
        limit: 10
      });
      const offers = book.result.offers || [];
      if (offers.length === 0) return null;
      // Approx rate: tokens received per 1 XRP
      const first = offers[0];
      const pays = getNum(first.TakerPays); // XRP
      const gets = getNum(first.TakerGets); // token amount
      if (pays > 0 && gets > 0) return gets / pays;
      return null;
    }
    if (fromToken !== 'XRP' && toToken === 'XRP' && cleanFrom) {
      // Book: taker_gets = XRP, taker_pays = IOU
      const book = await client.request({
        command: 'book_offers',
        taker_gets: { currency: 'XRP' },
        taker_pays: { currency: fromToken, issuer: cleanFrom },
        limit: 10
      });
      const offers = book.result.offers || [];
      if (offers.length === 0) return null;
      const first = offers[0];
      const pays = getNum(first.TakerPays); // IOU amount
      const gets = getNum(first.TakerGets); // XRP
      if (pays > 0 && gets > 0) return gets / pays; // XRP per token
      return null;
    }
    if (fromToken !== 'XRP' && toToken !== 'XRP' && cleanFrom && cleanTo) {
      // Approx through XRP by chaining both books
      const aToXrp = await getOrderbookRate(fromToken, 'XRP', amount, cleanFrom, undefined);
      const xrpToB = await getOrderbookRate('XRP', toToken, amount, undefined, cleanTo);
      if (aToXrp && xrpToB) return aToXrp * xrpToB;
      return null;
    }
    // XRP -> XRP shouldn't happen
    return null;
  } catch {
    return null;
  } finally {
    try { await client.disconnect(); } catch {}
  }
}

export async function getQuoteV2(input: SwapInput) {
  const { fromToken, toToken, amount, slippagePercent, fromIssuer, toIssuer } = SwapInputSchema.parse(input);

  // Try orderbook-based rate first for on-ledger accuracy; fall back to USD pricing
  let rate: number | null = await getOrderbookRate(fromToken, toToken, amount, fromIssuer || undefined, toIssuer || undefined);
  if (!rate) {
    const fromUsd = await getUsdPrice(fromToken, fromIssuer || undefined);
    const toUsd = await getUsdPrice(toToken, toIssuer || undefined);
    rate = fromUsd / toUsd;
  }
  const expectedOutput = amount * rate;
  const minOutput = expectedOutput * (1 - slippagePercent / 100);
  const feeXrp = await estimateXrpFee(fromToken, amount, fromIssuer || undefined);

  return {
    success: true,
    fromToken, toToken, amount, slippagePercent,
    expectedOutput, minOutput, rate,
    platformFeeXrp: feeXrp,
  };
}

async function estimateXrpFee(fromToken: string, amount: number, fromIssuer?: string) {
  // 0.25% of notional value converted to XRP
  const usd = (await getUsdPrice(fromToken, fromIssuer)) * amount;
  const xrpUsd = await getUsdPrice('XRP');
  return +(usd * (PLATFORM_FEE_PCT / 100) / xrpUsd).toFixed(6);
}

// Ensure account has trustline for non-XRP currencies
export async function ensureTrustline(client: Client, address: string, currency: string, issuer: string) {
  const lines = await client.request({ command: 'account_lines', account: address });
  const exists = (lines.result.lines || []).some((l: any) => l.currency === currency && l.account === issuer);
  if (exists) return { created: false };
  return { created: true, txjson: {
    TransactionType: 'TrustSet',
    Account: address,
    LimitAmount: { currency, issuer, value: '1000000000' },
    Flags: 131072
  }};
}

export type PreparedSwapTx = {
  payment: any;
  minOutput: number;
  expectedOutput: number;
  rate: number;
  feeXrp: number;
};

export async function prepareSwapTxV2(
  account: string,
  input: SwapInput
): Promise<PreparedSwapTx> {
  const { fromToken, toToken, amount, slippagePercent, fromIssuer, toIssuer } = SwapInputSchema.parse(input);
  const cleanFromIssuer = normalizeIssuer(fromIssuer);
  const cleanToIssuer = normalizeIssuer(toIssuer);

  const rate = (await getUsdPrice(fromToken, cleanFromIssuer)) / (await getUsdPrice(toToken, cleanToIssuer));
  const expectedOutput = amount * rate;
  const minOutput = expectedOutput * (1 - slippagePercent / 100);
  const feeXrp = await estimateXrpFee(fromToken, amount, cleanFromIssuer);

  // Build Payment with DeliverMin and SendMax
  let payment: any;
  if (fromToken === 'XRP' && toToken !== 'XRP') {
    payment = {
      TransactionType: 'Payment',
      Account: account,
      Destination: account,
      Amount: { currency: toToken, issuer: cleanToIssuer!, value: toIssuedValue(expectedOutput) },
      SendMax: xrpToDrops(amount * 1.05),
      DeliverMin: { currency: toToken, issuer: cleanToIssuer!, value: toIssuedValue(minOutput) },
      Flags: 131072
    };
  } else if (fromToken !== 'XRP' && toToken === 'XRP') {
    payment = {
      TransactionType: 'Payment',
      Account: account,
      Destination: account,
      Amount: xrpToDrops(+minOutput.toFixed(6)),
      SendMax: { currency: fromToken, issuer: cleanFromIssuer!, value: toIssuedValue(amount * 1.05) },
      DeliverMin: xrpToDrops(+minOutput.toFixed(6)),
      Flags: 131072
    };
  } else if (fromToken !== 'XRP' && toToken !== 'XRP') {
    payment = {
      TransactionType: 'Payment',
      Account: account,
      Destination: account,
      Amount: { currency: toToken, issuer: cleanToIssuer!, value: toIssuedValue(expectedOutput) },
      SendMax: { currency: fromToken, issuer: cleanFromIssuer!, value: toIssuedValue(amount * 1.05) },
      DeliverMin: { currency: toToken, issuer: cleanToIssuer!, value: toIssuedValue(minOutput) },
      Paths: [[{ currency: 'XRP' }]],
      Flags: 131072
    };
  } else {
    throw new Error('Invalid swap configuration');
  }

  return { payment, minOutput, expectedOutput, rate, feeXrp };
}

export async function executeSwapV2(
  privateKey: string,
  input: SwapInput
) {
  const { fromToken, toToken, amount, slippagePercent, fromIssuer, toIssuer } = SwapInputSchema.parse(input);
  const client = new Client(XRPL_ENDPOINT);
  try {
    await client.connect();
    const wallet = Wallet.fromSecret(privateKey);

    const cleanFromIssuer = normalizeIssuer(fromIssuer);
    const cleanToIssuer = normalizeIssuer(toIssuer);

    if (fromToken !== 'XRP' && !cleanFromIssuer) throw new Error('fromIssuer required for issued currency');
    if (toToken !== 'XRP' && !cleanToIssuer) throw new Error('toIssuer required for issued currency');

    // Ensure trustlines as needed
    if (fromToken !== 'XRP' && cleanFromIssuer) {
      const tl = await ensureTrustline(client, wallet.address, fromToken, cleanFromIssuer);
      if (tl.created) {
  const prepared = await client.autofill(tl.txjson as any);
        const signed = wallet.sign(prepared);
        const resp = await client.submitAndWait(signed.tx_blob);
        const ok = (resp.result as any).meta?.TransactionResult === 'tesSUCCESS';
        if (!ok) throw new Error('Trustline creation failed');
      }
    }
    if (toToken !== 'XRP' && cleanToIssuer) {
      const tl = await ensureTrustline(client, wallet.address, toToken, cleanToIssuer);
      if (tl.created) {
  const prepared = await client.autofill(tl.txjson as any);
        const signed = wallet.sign(prepared);
        const resp = await client.submitAndWait(signed.tx_blob);
        const ok = (resp.result as any).meta?.TransactionResult === 'tesSUCCESS';
        if (!ok) throw new Error('Trustline creation failed');
      }
    }

    // Prepare payment
    const preparedSwap = await prepareSwapTxV2(wallet.address, { fromToken, toToken, amount, slippagePercent, fromIssuer: cleanFromIssuer, toIssuer: cleanToIssuer });

    const prepared = await client.autofill(preparedSwap.payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = (result.result as any).meta;
    if (meta?.TransactionResult !== 'tesSUCCESS') {
      if (meta?.TransactionResult === 'tecPATH_PARTIAL') {
        throw new Error('Swap failed: Minimum delivery not met (tecPATH_PARTIAL)');
      }
      throw new Error(`Swap failed: ${meta?.TransactionResult || 'unknown'}`);
    }

    // Determine delivered amount
    let delivered = 0;
    const del = meta?.delivered_amount;
  if (typeof del === 'string') delivered = parseFloat(String(del)) / 1_000_000;
    else if (del && typeof del === 'object' && 'value' in del) delivered = parseFloat(String(del.value));

    // Post-swap fee (only after success)
    const feeXrp = preparedSwap.feeXrp;
    let feeTxHash: string | null = null;
    if (feeXrp > 0) {
      const feePayment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: BANK_WALLET_XRP,
        Amount: xrpToDrops(feeXrp),
      };
      const p2 = await client.autofill(feePayment as any);
      const s2 = wallet.sign(p2);
      const r2 = await client.submitAndWait(s2.tx_blob);
      feeTxHash = (r2.result as any).hash || null;
    }

    return {
      success: true,
      txHash: (result.result as any).hash,
      deliveredAmount: delivered,
      expectedOutput: preparedSwap.expectedOutput,
      minOutput: preparedSwap.minOutput,
      platformFeeXrp: feeXrp,
      feeTxHash
    };
  } finally {
    try { await client.disconnect(); } catch {}
  }
}
