#!/usr/bin/env tsx

/**
 * STANDALONE BACKGROUND SCANNER RUNNER
 * Run this independently from the main server
 * 
 * Usage:
 *   npm run scan:nfts              # Run once
 *   npm run scan:nfts:scheduled    # Run every 24 hours
 */

import 'dotenv/config';
import { backgroundScanner } from './server/services/background-nft-scanner';

const args = process.argv.slice(2);
const mode = args[0] || 'once';

async function main() {
  console.log('🎮 NFT COLLECTION BACKGROUND SCANNER\n');
  
  if (mode === 'scheduled') {
    const hours = parseInt(args[1]) || 24;
    console.log(`⏰ Running in scheduled mode (every ${hours} hours)\n`);
    backgroundScanner.startScheduled(hours);
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n\n👋 Received SIGINT, shutting down gracefully...');
      backgroundScanner.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n👋 Received SIGTERM, shutting down gracefully...');
      backgroundScanner.stop();
      process.exit(0);
    });
  } else {
    console.log('▶️  Running in one-time mode\n');
    await backgroundScanner.scanAllCollections();
    console.log('\n✅ Scanner complete, exiting...\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
