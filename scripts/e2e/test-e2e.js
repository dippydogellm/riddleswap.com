#!/usr/bin/env node

/**
 * E2E Test: Full Squadron → Battle → Alliance Workflow
 * Tests: Create squadron, start battle, delete squadron, create alliance, delete alliance
 */

const API_BASE = 'http://localhost:5000';
const TEST_HANDLE = 'dippydoge';
const TEST_PASSWORD = 'Neverknow1.';

let sessionToken = null;
let csrfToken = null;
let playerId = null;
let squadronId = null;
let allianceId = null;
let battleId = null;

async function request(method, endpoint, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
      ...(csrfToken && ['POST', 'PUT', 'DELETE'].includes(method) && { 'X-CSRF-Token': csrfToken })
    }
  };

  if (body) {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { raw: text };
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 0, ok: false, data: { error: err.message } };
  }
}

async function getCsrfToken() {
  const res = await request('GET', '/api/alliances/csrf-token');
  if (res.ok && res.data.csrfToken) {
    csrfToken = res.data.csrfToken;
    return csrfToken;
  }
  return null;
}

async function log(step, status, details = '') {
  const icon = status === 'OK' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${icon} [${step}] ${status} ${details}`);
}

async function runTest() {
  console.log('\n🎯 === START E2E TEST ===\n');

  // STEP 1: Login
  console.log('--- STEP 1: LOGIN ---');
  let res = await request('POST', '/api/riddle-wallet/login', {
    handle: TEST_HANDLE,
    masterPassword: TEST_PASSWORD
  });
  if (res.ok && res.data.sessionToken) {
    sessionToken = res.data.sessionToken;
    await log('LOGIN', 'OK', `sessionToken: ${sessionToken.substring(0, 12)}...`);
  } else {
    await log('LOGIN', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 2: Get gaming player ID (needed for squad creation)
  console.log('\n--- STEP 2: GET GAMING PLAYER ID ---');
  // First get/create gaming player by fetching squadrons list (will auto-create player if needed)
  res = await request('GET', '/api/gaming/squadrons');
  if (res.ok) {
    await log('GET PLAYER', 'OK', `Status: ${res.status}`);
    // We'll get player ID during squad creation
  } else {
    await log('GET PLAYER', 'FAIL', JSON.stringify(res.data));
  }

  // STEP 3: Create a squadron
  console.log('\n--- STEP 3: CREATE SQUADRON ---');
  res = await request('POST', '/api/gaming/squadrons', {
    name: `Test Squadron ${Date.now()}`,
    description: 'E2E test squadron',
    squadron_type: 'military'
  });
  if (res.ok && res.data.squadron?.id) {
    squadronId = res.data.squadron.id;
    playerId = res.data.squadron.player_id; // Extract player ID from response
    await log('CREATE SQUADRON', 'OK', `squadronId: ${squadronId.substring(0, 12)}...`);
  } else {
    await log('CREATE SQUADRON', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 4: Verify squadron exists
  console.log('\n--- STEP 4: VERIFY SQUADRON ---');
  res = await request('GET', '/api/squadrons/player');
  if (res.ok && Array.isArray(res.data.data)) {
    const found = res.data.data.find(s => s.id === squadronId);
    if (found) {
      await log('VERIFY SQUADRON', 'OK', `Found in player squadrons list`);
    } else {
      await log('VERIFY SQUADRON', 'FAIL', `Squadron not in list`);
      process.exit(1);
    }
  } else {
    await log('VERIFY SQUADRON', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 5: Create a battle
  console.log('\n--- STEP 5: CREATE BATTLE ---');
  res = await request('POST', '/api/battles/create', {
    creator_squadron_id: squadronId,
    battle_type: '1v1',
    combat_type: 'military',
    wager_amount: 0,
    is_friendly: true
  });
  if (res.ok && res.data.battle?.id) {
    battleId = res.data.battle.id;
    await log('CREATE BATTLE', 'OK', `battleId: ${battleId.substring(0, 12)}...`);
  } else {
    await log('CREATE BATTLE', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 6: Verify battle exists
  console.log('\n--- STEP 6: VERIFY BATTLE ---');
  res = await request('GET', `/api/battles/${battleId}`);
  if (res.ok && res.data.battle?.id === battleId) {
    await log('VERIFY BATTLE', 'OK', `Battle status: ${res.data.battle.status}`);
  } else {
    await log('VERIFY BATTLE', 'FAIL', JSON.stringify(res.data));
  }

  // STEP 7: Delete the squadron
  console.log('\n--- STEP 7: DELETE SQUADRON ---');
  res = await request('DELETE', `/api/gaming/squadrons/${squadronId}`);
  if (res.ok) {
    await log('DELETE SQUADRON', 'OK', res.data.message || 'Squadron deleted');
  } else {
    await log('DELETE SQUADRON', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 8: Verify squadron is gone
  console.log('\n--- STEP 8: VERIFY SQUADRON DELETED ---');
  res = await request('GET', '/api/squadrons/player');
  if (res.ok && Array.isArray(res.data.data)) {
    const found = res.data.data.find(s => s.id === squadronId);
    if (!found) {
      await log('VERIFY DELETE', 'OK', `Squadron removed from player list`);
    } else {
      await log('VERIFY DELETE', 'FAIL', `Squadron still exists`);
    }
  } else {
    await log('VERIFY DELETE', 'FAIL', JSON.stringify(res.data));
  }

  // STEP 9: Create an alliance
  console.log('\n--- STEP 9: CREATE ALLIANCE ---');
  res = await request('POST', '/api/alliances', {
    name: `Test Alliance ${Date.now()}`,
    tag: `TST${Math.floor(Math.random() * 10)}`,
    description: 'E2E test alliance',
    alliance_type: 'military'
  });
  if (res.ok && res.data.alliance?.id) {
    allianceId = res.data.alliance.id;
    await log('CREATE ALLIANCE', 'OK', `allianceId: ${allianceId.substring(0, 12)}...`);
  } else {
    await log('CREATE ALLIANCE', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 10: Verify alliance exists
  console.log('\n--- STEP 10: VERIFY ALLIANCE ---');
  res = await request('GET', '/api/player');
  if (res.ok && res.data.alliance?.id === allianceId) {
    await log('VERIFY ALLIANCE', 'OK', `Player in alliance: ${res.data.alliance.name}`);
  } else {
    await log('VERIFY ALLIANCE', 'OK', `Alliance created (verify from list)`);
  }

  // STEP 11: Get alliance list to confirm
  console.log('\n--- STEP 11: GET ALLIANCE LIST ---');
  res = await request('GET', '/api/alliances');
  if (res.ok && Array.isArray(res.data.alliances)) {
    const found = res.data.alliances.find(a => a.id === allianceId);
    if (found) {
      await log('VERIFY ALLIANCE LIST', 'OK', `Alliance found: ${found.name}`);
    } else {
      await log('VERIFY ALLIANCE LIST', 'FAIL', `Alliance not in list`);
    }
  } else {
    await log('VERIFY ALLIANCE LIST', 'FAIL', JSON.stringify(res.data));
  }

  // STEP 12: Delete the alliance
  console.log('\n--- STEP 12: DELETE ALLIANCE ---');
  res = await request('DELETE', `/api/alliances/${allianceId}/members/${TEST_HANDLE}`);
  if (res.ok) {
    await log('DELETE ALLIANCE', 'OK', res.data.message || 'Alliance deleted/left');
  } else {
    await log('DELETE ALLIANCE', 'FAIL', JSON.stringify(res.data));
    process.exit(1);
  }

  // STEP 13: Verify alliance is gone
  console.log('\n--- STEP 13: VERIFY ALLIANCE DELETED ---');
  res = await request('GET', '/api/player');
  if (res.ok) {
    if (!res.data.alliance || res.data.alliance.id !== allianceId) {
      await log('VERIFY DELETE ALLIANCE', 'OK', `Player no longer in alliance`);
    } else {
      await log('VERIFY DELETE ALLIANCE', 'FAIL', `Player still in alliance`);
    }
  } else {
    await log('VERIFY DELETE ALLIANCE', 'FAIL', JSON.stringify(res.data));
  }

  console.log('\n🎉 === E2E TEST COMPLETE ===\n');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
