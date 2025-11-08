/*
  XRPL Liquidity & Limit Orders smoke test
  - Liquidity: check and pools
  - Offers: list; optional create/cancel with credentials

  ENV:
    BASE_URL=http://localhost:5000
    XRPL_FROM_TOKEN=XRP
    XRPL_TO_TOKEN=RDL
    XRPL_FROM_ISSUER=
    XRPL_TO_ISSUER=
    XRPL_AMOUNT=10
    XRPL_ACCOUNT=rXXXXXXXXXXXX
    XRPL_SMOKE_HANDLE=your-handle (for create/cancel)
    XRPL_SMOKE_PASSWORD=your-password (for create/cancel)
*/

const LIQUIDITY_BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const LIQUIDITY_FROM_TOKEN = process.env.XRPL_FROM_TOKEN || 'XRP';
const LIQUIDITY_TO_TOKEN = process.env.XRPL_TO_TOKEN || 'RDL';
const LIQUIDITY_FROM_ISSUER = process.env.XRPL_FROM_ISSUER || '';
const LIQUIDITY_TO_ISSUER = process.env.XRPL_TO_ISSUER || '';
const LIQUIDITY_AMOUNT = parseFloat(process.env.XRPL_AMOUNT || '10');
const LIQUIDITY_ACCOUNT = process.env.XRPL_ACCOUNT || '';
const LIQUIDITY_HANDLE = process.env.XRPL_SMOKE_HANDLE || '';
const LIQUIDITY_PASSWORD = process.env.XRPL_SMOKE_PASSWORD || '';

async function runLiquidityLimitTests() {
  console.log('🔎 Liquidity: check');
  const liqCheck = await fetch(`${LIQUIDITY_BASE_URL}/api/xrpl/liquidity/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromToken: LIQUIDITY_FROM_TOKEN,
      toToken: LIQUIDITY_TO_TOKEN,
      fromIssuer: LIQUIDITY_FROM_ISSUER || undefined,
      toIssuer: LIQUIDITY_TO_ISSUER || undefined,
      amount: LIQUIDITY_AMOUNT
    })
  });
  console.log('LIQUIDITY CHECK:', await liqCheck.json());

  if (LIQUIDITY_ACCOUNT) {
    console.log('🔎 Liquidity: pools');
    const pools = await fetch(`${LIQUIDITY_BASE_URL}/api/xrpl/liquidity/pools/${LIQUIDITY_ACCOUNT}`);
    console.log('POOLS:', await pools.json());

    console.log('🔎 Offers: list');
    const offers = await fetch(`${LIQUIDITY_BASE_URL}/api/xrpl/offers/${LIQUIDITY_ACCOUNT}`);
    const offersJson = await offers.json();
    console.log('OFFERS:', offersJson);

    if (LIQUIDITY_HANDLE && LIQUIDITY_PASSWORD) {
      try {
        console.log('📝 Offers: create (optional)');
        const takerGets = LIQUIDITY_FROM_TOKEN === 'XRP' ? (LIQUIDITY_AMOUNT * 1_000_000).toString() : { currency: LIQUIDITY_FROM_TOKEN, issuer: LIQUIDITY_FROM_ISSUER, value: String(LIQUIDITY_AMOUNT) };
        const toAmount = LIQUIDITY_AMOUNT * 2; // simple ratio for demo
        const takerPays = LIQUIDITY_TO_TOKEN === 'XRP' ? (toAmount * 1_000_000).toString() : { currency: LIQUIDITY_TO_TOKEN, issuer: LIQUIDITY_TO_ISSUER, value: String(toAmount) };
        const createResp = await fetch(`${LIQUIDITY_BASE_URL}/api/xrpl/offer/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: LIQUIDITY_ACCOUNT,
            takerGets,
            takerPays,
            flags: 0x00020000,
            riddleWalletId: LIQUIDITY_HANDLE,
            password: LIQUIDITY_PASSWORD,
            customRate: '2.0'
          })
        });
        const created = await createResp.json();
        console.log('CREATE OFFER:', created);

        if (created?.offerId) {
          console.log('🗑️ Offers: cancel (optional)');
          const cancelResp = await fetch(`${LIQUIDITY_BASE_URL}/api/xrpl/offer/cancel`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              offerId: created.offerId,
              walletAddress: LIQUIDITY_ACCOUNT,
              riddleWalletId: LIQUIDITY_HANDLE,
              password: LIQUIDITY_PASSWORD
            })
          });
          console.log('CANCEL OFFER:', await cancelResp.json());
        }
      } catch (e) {
        console.warn('Offer create/cancel skipped or failed:', e);
      }
    } else {
      console.log('ℹ️  Skip offer create/cancel: no credentials provided');
    }
  } else {
    console.log('ℹ️  Skip pools/offers: XRPL_ACCOUNT not provided');
  }
}

runLiquidityLimitTests().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
