/**
 * Script to populate land plots database
 * Run with: tsx server/populate-land.ts
 */

import { landPlotGenerator } from './land-plot-generator';

async function main() {
  try {
    console.log('🚀 Starting land plot population...');
    await landPlotGenerator.populateDatabase();
    console.log('✅ Land plot population complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating land plots:', error);
    process.exit(1);
  }
}

main();
