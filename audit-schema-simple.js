#!/usr/bin/env node

/**
 * Database Schema Audit
 * Compare current shared/schema.ts against all server routes
 * to identify missing columns, tables, and references
 */

import fs from 'fs';
import path from 'path';

const serverDir = './server';
const schemaFile = './shared/schema.ts';

// Read schema file
const schema = fs.readFileSync(schemaFile, 'utf-8');

// Extract table definitions from schema
const tableMatches = schema.matchAll(/export const (\w+) = pgTable\('([^']+)',/g);
const tables = new Map();

for (const match of tableMatches) {
  const [, name, pgName] = match;
  tables.set(name, pgName);
}

console.log('\n📊 SCHEMA AUDIT REPORT\n');
console.log(`Found ${tables.size} table definitions in schema:\n`);
tables.forEach((pgName, name) => {
  console.log(`  ✓ ${name} (${pgName})`);
});

// Scan server files for database references
console.log('\n\n🔍 SCANNING SERVER FILES FOR SCHEMA REFERENCES\n');

const serverFiles = fs.readdirSync(serverDir)
  .filter(f => f.endsWith('.ts') && !f.includes('test'))
  .slice(0, 50);

const missingReferences = new Set();
const usedTables = new Set();

for (const file of serverFiles) {
  const filePath = path.join(serverDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Look for database queries
  const dbQueries = content.match(/from\((\w+)\)|insert\((\w+)\)|update\((\w+)\)|delete\(\)/g) || [];
  
  for (const query of dbQueries) {
    const match = query.match(/from\((\w+)\)|insert\((\w+)\)|update\((\w+)\)/);
    if (match) {
      const tableName = match[1] || match[2] || match[3];
      usedTables.add(tableName);
      
      if (!tables.has(tableName)) {
        missingReferences.add(`${file}: references unknown table "${tableName}"`);
      }
    }
  }
}

console.log(`Scanned ${serverFiles.length} server files\n`);
console.log(`Using tables: ${Array.from(usedTables).sort().join(', ')}\n`);

if (missingReferences.size > 0) {
  console.log(`⚠️  MISSING TABLE REFERENCES (${missingReferences.size}):\n`);
  Array.from(missingReferences).forEach(ref => console.log(`  - ${ref}`));
} else {
  console.log('✅ All referenced tables are defined in schema\n');
}

// Check for common missing fields
console.log('\n📋 CHECKING FOR COMMONLY MISSING FIELDS\n');

const fieldChecks = [
  { field: 'handle', table: 'users', mention: 'User identification' },
  { field: 'displayName', table: 'users', mention: 'User display' },
  { field: 'profileImageUrl', table: 'users', mention: 'User profile' },
  { field: 'makerHandle', table: 'nftSwapOffers', mention: 'NFT swap creation' },
  { field: 'takerHandle', table: 'nftSwapOffers', mention: 'NFT swap acceptance' },
  { field: 'offeredItems', table: 'nftSwapOffers', mention: 'Swap items' },
  { field: 'wantedItems', table: 'nftSwapOffers', mention: 'Swap items' },
];

for (const check of fieldChecks) {
  const tableRegex = new RegExp(`export const ${check.table} = pgTable.*?\\{([^}]+?)\\}`, 's');
  const match = schema.match(tableRegex);
  
  if (match) {
    const tableContent = match[1];
    if (tableContent.includes(check.field)) {
      console.log(`  ✅ ${check.table}.${check.field} (${check.mention})`);
    } else {
      console.log(`  ❌ ${check.table}.${check.field} MISSING (${check.mention})`);
    }
  }
}

console.log('\n✨ Audit complete!\n');
console.log('Next steps:');
console.log('1. Review audit results above');
console.log('2. Check migrations/ folder for schema history');
console.log('3. Run: npx drizzle-kit push --config drizzle.config.ts');
console.log('4. Verify database changes applied successfully');
