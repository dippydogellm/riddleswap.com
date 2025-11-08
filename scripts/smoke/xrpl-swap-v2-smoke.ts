/*
  XRPL Swap v2 smoke test
  - QUOTE and PREPARE always
  - EXECUTE only if credentials provided via env:
      XRPL_SMOKE_PRIVATE_KEY (preferred)
      or XRPL_SMOKE_HANDLE + XRPL_SMOKE_PASSWORD

  ENV:
    BASE_URL=http://localhost:5000
    XRPL_FROM_TOKEN=XRP
    XRPL_TO_TOKEN=RDL
    XRPL_FROM_ISSUER=
    XRPL_TO_ISSUER=
    XRPL_AMOUNT=10
    XRPL_SLIPPAGE=10
    XRPL_ACCOUNT=rXXXXXXXXXXXX (for prepare)
*/

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const FROM_TOKEN = process.env.XRPL_FROM_TOKEN || 'XRP';
const TO_TOKEN = process.env.XRPL_TO_TOKEN || 'RDL';
const FROM_ISSUER = process.env.XRPL_FROM_ISSUER || '';
const TO_ISSUER = process.env.XRPL_TO_ISSUER || '';
const AMOUNT = parseFloat(process.env.XRPL_AMOUNT || '10');
const SLIPPAGE = parseFloat(process.env.XRPL_SLIPPAGE || '10');
const ACCOUNT = process.env.XRPL_ACCOUNT || '';

const HANDLE = process.env.XRPL_SMOKE_HANDLE;
const PASSWORD = process.env.XRPL_SMOKE_PASSWORD;
const PRIVATE_KEY = process.env.XRPL_SMOKE_PRIVATE_KEY;

async function run() {
  console.log('🔎 Smoke: quote');
  const quoteResp = await fetch(`${BASE_URL}/api/xrpl/swap/v2/quote`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromToken: FROM_TOKEN,
      toToken: TO_TOKEN,
      fromIssuer: FROM_ISSUER || undefined,
      toIssuer: TO_ISSUER || undefined,
      amount: AMOUNT,
      slippagePercent: SLIPPAGE
    })
  });
  const quote = await quoteResp.json();
  console.log('QUOTE:', quote);

  if (ACCOUNT) {
    console.log('🔎 Smoke: prepare');
    const prepResp = await fetch(`${BASE_URL}/api/xrpl/swap/v2/prepare`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: ACCOUNT,
        fromToken: FROM_TOKEN,
        toToken: TO_TOKEN,
        fromIssuer: FROM_ISSUER || undefined,
        toIssuer: TO_ISSUER || undefined,
        amount: AMOUNT,
        slippagePercent: SLIPPAGE
      })
    });
    const prepared = await prepResp.json();
    console.log('PREPARE:', prepared);
  } else {
    console.log('ℹ️  Skip prepare: XRPL_ACCOUNT not provided');
  }

  if (PRIVATE_KEY || (HANDLE && PASSWORD)) {
    console.log('🚀 Smoke: execute');
    const execBody: any = {
      fromToken: FROM_TOKEN,
      toToken: TO_TOKEN,
      fromIssuer: FROM_ISSUER || undefined,
      toIssuer: TO_ISSUER || undefined,
      amount: AMOUNT,
      slippagePercent: SLIPPAGE
    };
    if (!(PRIVATE_KEY)) {
      // handle+password path; private key path assumed to be picked up by server via session in real flows
      execBody.riddleWalletHandle = HANDLE;
      execBody.password = PASSWORD;
    }
    const execResp = await fetch(`${BASE_URL}/api/xrpl/swap/v2/execute`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(execBody)
    });
    const result = await execResp.json();
    console.log('EXECUTE:', result);
  } else {
    console.log('ℹ️  Skip execute: no credentials provided');
  }
}

run().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
