/**
 * Code Structure Validation for Squadron, Battle, and Alliance Systems
 * Validates response structures without requiring a running server
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0
};

function test(name, condition, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    log(`✅ ${name}`, 'green');
  } else {
    results.failed++;
    log(`❌ ${name}`, 'red');
    if (details) log(`   ${details}`, 'yellow');
  }
}

function warn(name, details = '') {
  results.warnings++;
  log(`⚠️  ${name}`, 'yellow');
  if (details) log(`   ${details}`, 'yellow');
}

log('\n╔═══════════════════════════════════════╗', 'cyan');
log('║  RIDDLE CODE STRUCTURE VALIDATION    ║', 'cyan');
log('║  Squadron • Battle • Alliance        ║', 'cyan');
log('╚═══════════════════════════════════════╝\n', 'cyan');

// Check file existence
log('📁 File Existence Checks', 'cyan');
log('─────────────────────────────────────', 'cyan');

const allianceFile = path.join(__dirname, 'server', 'alliance-routes.ts');
const squadronFile = path.join(__dirname, 'server', 'squadron-routes.ts');
const battleFile = path.join(__dirname, 'server', 'battle-system-routes.ts');
const indexFile = path.join(__dirname, 'server', 'index.ts');

test('alliance-routes.ts exists', fs.existsSync(allianceFile));
test('squadron-routes.ts exists', fs.existsSync(squadronFile));
test('battle-system-routes.ts exists', fs.existsSync(battleFile));
test('server/index.ts exists', fs.existsSync(indexFile));

// Check Alliance Routes
log('\n🤝 Alliance Routes Validation', 'cyan');
log('─────────────────────────────────────', 'cyan');

const allianceContent = fs.readFileSync(allianceFile, 'utf8');

test('POST /alliances endpoint exists',
  allianceContent.includes("router.post('/alliances'")
);

test('GET /alliances endpoint exists',
  allianceContent.includes("router.get('/alliances'")
);

test('GET /alliances/:id endpoint exists',
  allianceContent.includes("router.get('/alliances/:id'")
);

test('POST /alliances/:id/join endpoint exists',
  allianceContent.includes("router.post('/alliances/:id/join'")
);

test('DELETE /alliances/:id/members/:playerHandle endpoint exists',
  allianceContent.includes("router.delete('/alliances/:id/members/:playerHandle'")
);

// Check response structures
log('\n📋 Alliance Response Structure', 'cyan');
log('─────────────────────────────────────', 'cyan');

test('Create alliance returns success field',
  allianceContent.includes('success: true,') &&
  allianceContent.includes("message: 'Alliance created successfully'")
);

test('List alliances returns success and count',
  allianceContent.includes('success: true,') &&
  allianceContent.includes('count: alliances.length')
);

test('Alliance details nests members in alliance object',
  /alliance:\s*\{[^}]*\.\.\.alliance[^}]*members[^}]*\}/.test(allianceContent)
);

test('Join requests return success and count',
  allianceContent.includes('requests,') &&
  allianceContent.includes('count: requests.length')
);

// Check Squadron Routes
log('\n⚔️  Squadron Routes Validation', 'cyan');
log('─────────────────────────────────────', 'cyan');

const squadronContent = fs.readFileSync(squadronFile, 'utf8');

test('POST /api/gaming/squadrons endpoint exists',
  squadronContent.includes('router.post("/api/gaming/squadrons"')
);

test('GET /api/gaming/squadrons endpoint exists',
  squadronContent.includes('router.get("/api/gaming/squadrons"')
);

test('GET /api/squadrons/player endpoint exists',
  squadronContent.includes('router.get("/api/squadrons/player"')
);

test('DELETE /api/gaming/squadrons/:id endpoint exists',
  squadronContent.includes('router.delete("/api/gaming/squadrons/:id"')
);

// Check squadron response structures
log('\n📋 Squadron Response Structure', 'cyan');
log('─────────────────────────────────────', 'cyan');

test('Squadron list returns squadrons field (not data)',
  squadronContent.includes('squadrons: squadronsWithMembers') &&
  !squadronContent.includes('data: squadronsWithMembers')
);

test('Squadron list returns success and count',
  squadronContent.includes('success: true,') &&
  squadronContent.includes('count: squadronsWithMembers.length')
);

test('Squadron delete returns success and message',
  squadronContent.includes("message: 'Squadron deleted successfully'")
);

// Check route registrations
log('\n🔗 Route Registration Validation', 'cyan');
log('─────────────────────────────────────', 'cyan');

const indexContent = fs.readFileSync(indexFile, 'utf8');

test('Alliance routes registered',
  indexContent.includes("app.use('/api', allianceRoutes)")
);

test('Squadron routes registered',
  indexContent.includes('app.use(squadronRoutes)')
);

test('Battle system routes registered',
  indexContent.includes('app.use(battleSystemRoutes)')
);

// Check for duplicate registrations
const allianceRegistrations = (indexContent.match(/app\.use\([^)]*allianceRoutes\)/g) || []).length;
const squadronRegistrations = (indexContent.match(/app\.use\([^)]*squadronRoutes\)/g) || []).length;
const battleRegistrations = (indexContent.match(/app\.use\([^)]*battleSystemRoutes\)/g) || []).length;

test('Alliance routes registered only once',
  allianceRegistrations === 1,
  allianceRegistrations > 1 ? `Found ${allianceRegistrations} registrations` : ''
);

test('Squadron routes registered only once',
  squadronRegistrations === 1,
  squadronRegistrations > 1 ? `Found ${squadronRegistrations} registrations` : ''
);

test('Battle routes registered only once',
  battleRegistrations === 1,
  battleRegistrations > 1 ? `Found ${battleRegistrations} registrations` : ''
);

// Check authentication middleware
log('\n🔐 Authentication Validation', 'cyan');
log('─────────────────────────────────────', 'cyan');

test('Alliance routes use requireAuthentication',
  allianceContent.includes('requireAuthentication')
);

test('Squadron routes use sessionAuth',
  squadronContent.includes('sessionAuth')
);

test('CSRF protection applied to alliance routes',
  allianceContent.includes('csrfProtection')
);

// Summary
log('\n═══════════════════════════════════════', 'cyan');
log('📊 VALIDATION SUMMARY', 'cyan');
log('═══════════════════════════════════════', 'cyan');

log(`\nTotal Checks: ${results.total}`);
log(`Passed: ${results.passed}`, 'green');
log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
log(`Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'green');
log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`,
  results.failed === 0 ? 'green' : 'yellow'
);

if (results.failed === 0) {
  log('\n✅ All code structure validations passed!', 'green');
  log('   The response structures are consistent and correct.', 'green');
} else {
  log('\n❌ Some validations failed. Review the issues above.', 'red');
}

log('\n═══════════════════════════════════════\n', 'cyan');

// Instructions for live testing
log('📝 LIVE SERVER TESTING INSTRUCTIONS', 'blue');
log('─────────────────────────────────────', 'blue');
log('\n1. Start the server:', 'cyan');
log('   npm run dev');
log('\n2. In another terminal, run:', 'cyan');
log('   node test-all-systems.cjs');
log('\n3. Or test manually with curl:', 'cyan');
log('   # Login');
log('   curl -X POST http://localhost:5000/api/auth/riddle-wallet/login \\');
log('     -H "Content-Type: application/json" \\');
log('     -d \'{"handle":"dippydoge","password":"Neverknow1."}\'');
log('\n   # List alliances');
log('   curl http://localhost:5000/api/alliances');
log('\n   # Get squadrons (with auth token)');
log('   curl http://localhost:5000/api/gaming/squadrons \\');
log('     -H "Authorization: Bearer YOUR_TOKEN_HERE"');
log('\n═══════════════════════════════════════\n', 'cyan');

process.exit(results.failed > 0 ? 1 : 0);
