#!/usr/bin/env node
/*
  XRPL Swap v2 Smoke Test

  This script verifies the /api/xrpl/swap/v2 endpoints work end-to-end for:
  - quote
  - prepare (network fee estimation)
  - execute (optional: requires credentials – handle+password or a session with cached key)

  Usage (env vars):
    BASE_URL=http://localhost:5000 \
    FROM_SYMBOL=XRP \
    FROM_ISSUER= \
    TO_SYMBOL=USD \
    TO_ISSUER=rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq \
    AMOUNT=10 \
    SLIPPAGE=1 \
    ACCOUNT=rwietsevLFg8XSmG3bEZzFein1g8RBqWDZ \
    DO_EXECUTE=0 \
    HANDLE=your_handle \
    PASSWORD=your_password \
    node scripts/xrpl-swap-v2-smoke.mjs
*/

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const FROM_SYMBOL = process.env.FROM_SYMBOL || 'XRP';
const FROM_ISSUER = process.env.FROM_ISSUER || undefined; // optional
const TO_SYMBOL = process.env.TO_SYMBOL || 'USD';
const TO_ISSUER = process.env.TO_ISSUER || 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq'; // Bitstamp USD issuer

const AMOUNT = Number(process.env.AMOUNT || '10');
const SLIPPAGE = Number(process.env.SLIPPAGE || '1');

const ACCOUNT = process.env.ACCOUNT; // optional, used for prepare fee estimation

const DO_EXECUTE = String(process.env.DO_EXECUTE || '0') === '1';
const HANDLE = process.env.HANDLE;
const PASSWORD = process.env.PASSWORD;

function logStep(title) {
  console.log(`\n==== ${title} ====`);
}

async function postJson(path, body) {
  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} -> ${JSON.stringify(json)}`);
  }
  return json;
}

(async () => {
  try {
    logStep('QUOTE: /xrpl/swap/v2/quote');
    const quotePayload = {
      fromToken: FROM_SYMBOL,
      fromIssuer: FROM_ISSUER || undefined,
      toToken: TO_SYMBOL,
      toIssuer: TO_ISSUER || undefined,
      amount: AMOUNT,
      slippagePercent: SLIPPAGE
    };
    console.log('Payload:', { ...quotePayload, fromIssuer: !!FROM_ISSUER, toIssuer: !!TO_ISSUER });
    const quote = await postJson('/xrpl/swap/v2/quote', quotePayload);
    console.log('Quote response keys:', Object.keys(quote));
    if (quote.error) throw new Error(`Quote error: ${quote.error}`);
    console.log('Quote summary:', {
      price: quote.price,
      expectedOutput: quote.expectedOutput,
      minimumReceived: quote.minimumReceived,
      platformFee: quote.platformFee
    });

    if (ACCOUNT) {
      logStep('PREPARE: /xrpl/swap/v2/prepare');
      const preparePayload = { account: ACCOUNT, ...quotePayload };
      const prepare = await postJson('/xrpl/swap/v2/prepare', preparePayload);
      console.log('Prepare response keys:', Object.keys(prepare));
      if (prepare.error) throw new Error(`Prepare error: ${prepare.error}`);
      console.log('Network fee (estimate):', prepare?.estimatedNetworkFee || prepare?.fee || 'n/a');
    } else {
      console.log('Skipping prepare: ACCOUNT env not set.');
    }

    // Always validate execute error contract without creds
    logStep('EXECUTE (negative test): expect missing credentials error');
    try {
      const execMissing = await postJson('/xrpl/swap/v2/execute', quotePayload);
      console.log('Unexpected execute success:', execMissing);
    } catch (e) {
      console.log('Expected error:', String(e.message || e));
    }

    if (DO_EXECUTE) {
      logStep('EXECUTE: /xrpl/swap/v2/execute');
      if (!HANDLE || !PASSWORD) {
        throw new Error('DO_EXECUTE=1 but HANDLE and PASSWORD not provided.');
      }
      const execPayload = { ...quotePayload, riddleWalletHandle: HANDLE, password: PASSWORD };
      const exec = await postJson('/xrpl/swap/v2/execute', execPayload);
      console.log('Execute response keys:', Object.keys(exec));
      if (exec.error) throw new Error(`Execute error: ${exec.error}`);
      console.log('Execute result (truncated):', {
        txId: exec?.txId || exec?.hash || 'n/a',
        status: exec?.status || 'submitted'
      });
    } else {
      console.log('Skipping execute: DO_EXECUTE!=1');
    }

    console.log('\nAll smoke steps completed.');
  } catch (err) {
    console.error('\nSmoke test failed:', err?.message || err);
    process.exit(1);
  }
})();
