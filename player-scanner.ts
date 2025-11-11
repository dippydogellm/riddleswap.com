/**
 * COMPREHENSIVE PLAYER SCANNER
 * 
 * Scans all NFT ownership and populates:
 * 1. Gaming Players - with civilization scores
 * 2. Player Civilizations - power metrics
 * 3. Squadrons - team formations
 * 4. Land ownership - territory control
 * 5. Battle readiness - combat scores
 * 
 * Scoring System:
 * - NFT Collection Power (rarity + quantity)
 * - Land Ownership (size + strategic value)
 * - Civilization Size (total assets)
 * - Material Output (resource production)
 * - Battle Readiness (squad power + formations)
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

console.log('🎮 COMPREHENSIVE PLAYER SCANNER\n');
console.log('='.repeat(70));

async function scanPlayers() {
  try {
    console.log('\n1️⃣  PHASE 1: Scanning NFT Ownership\n');
    
    // Get all unique wallet addresses that own gaming NFTs
    const ownersResult = await db.execute(sql`
      SELECT DISTINCT 
        owner_address,
        COUNT(DISTINCT id) as nft_count,
        COUNT(DISTINCT collection_id) as collection_count
      FROM gaming_nfts
      WHERE owner_address IS NOT NULL
      GROUP BY owner_address
      ORDER BY nft_count DESC
    `);
    
    console.log(`✅ Found ${ownersResult.rows.length} unique players\n`);
    
    let processedPlayers = 0;
    let totalCivilizations = 0;
    
    for (const owner of ownersResult.rows) {
      const walletAddress = String(owner.owner_address);
      const nftCount = Number(owner.nft_count);
      const collectionCount = Number(owner.collection_count);
      
      console.log(`\n📍 Processing: ${walletAddress.substring(0, 12)}...`);
      console.log(`   NFTs: ${nftCount} | Collections: ${collectionCount}`);
      
      // ============ STEP 1: Get Player's NFT Portfolio ============
      const nftsResult = await db.execute(sql`
        SELECT 
          n.id,
          n.collection_id,
          n.name,
          n.rarity_rank,
          n.rarity_score,
          n.game_role,
          c.collection_name,
          c.game_role as collection_role
        FROM gaming_nfts n
        LEFT JOIN gaming_nft_collections c ON c.id = n.collection_id
        WHERE n.owner_address = ${walletAddress}
        ORDER BY n.rarity_score DESC
      `);
      
      const nfts = nftsResult.rows;
      
      // ============ STEP 2: Calculate Role Distribution ============
      const roles = {
        army: 0, religion: 0, bank: 0, merchant: 0, 
        special: 0, land: 0, ships: 0
      };
      
      let totalRarityScore = 0;
      let bestRarityRank = 999999;
      
      for (const nft of nfts) {
        const role = String(nft.game_role || nft.collection_role || 'special').toLowerCase();
        if (role in roles) roles[role as keyof typeof roles]++;
        
        totalRarityScore += Number(nft.rarity_score || 0);
        const rank = Number(nft.rarity_rank || 999999);
        if (rank < bestRarityRank) bestRarityRank = rank;
      }
      
      // ============ STEP 3: Check Land Ownership ============
      const landResult = await db.execute(sql`
        SELECT COUNT(*) as land_count
        FROM medieval_land_plots
        WHERE owner = ${walletAddress}
      `);
      
      const landCount = Number(landResult.rows[0]?.land_count || 0);
      roles.land = landCount;
      
      // ============ STEP 4: Calculate Civilization Score ============
      const civilizationScore = 
        (roles.army * 10) +           // Military power
        (roles.religion * 8) +        // Cultural influence
        (roles.bank * 12) +           // Economic power
        (roles.merchant * 6) +        // Trade capacity
        (roles.special * 15) +        // Unique assets
        (roles.land * 20) +           // Territory control
        (roles.ships * 5) +           // Naval power
        (totalRarityScore / 10);      // Rarity bonus
      
      const avgRarity = nfts.length > 0 ? totalRarityScore / nfts.length : 0;
      
      // ============ STEP 5: Material Output Score ============
      const materialScore = 
        (roles.bank * 100) +          // Gold production
        (roles.merchant * 50) +       // Trade goods
        (roles.land * 200) +          // Resources
        (roles.army * 30);            // Military supplies
      
      // ============ STEP 6: Battle Readiness Score ============
      const battleScore = 
        (roles.army * 50) +           // Combat units
        (roles.special * 100) +       // Special abilities
        (roles.ships * 40) +          // Naval support
        (totalRarityScore / 5);       // Rarity combat bonus
      
      // ============ STEP 7: Overall Player Rank ============
      const overallScore = civilizationScore + materialScore + battleScore;
      
      console.log(`\n   📊 Scores:`);
      console.log(`      Civilization: ${Math.round(civilizationScore).toLocaleString()}`);
      console.log(`      Material Output: ${Math.round(materialScore).toLocaleString()}`);
      console.log(`      Battle Ready: ${Math.round(battleScore).toLocaleString()}`);
      console.log(`      OVERALL: ${Math.round(overallScore).toLocaleString()}`);
      
      // ============ STEP 8: Upsert Gaming Player ============
      await db.execute(sql`
        INSERT INTO gaming_players (
          wallet_address,
          username,
          total_nfts,
          total_power,
          rank,
          level,
          xp,
          created_at,
          updated_at
        ) VALUES (
          ${walletAddress},
          ${walletAddress.substring(0, 12) + '...'},
          ${nftCount},
          ${Math.round(civilizationScore)},
          1,
          ${Math.min(100, Math.floor(nftCount / 10))},
          ${Math.round(overallScore)},
          NOW(),
          NOW()
        )
        ON CONFLICT (wallet_address) 
        DO UPDATE SET
          total_nfts = ${nftCount},
          total_power = ${Math.round(civilizationScore)},
          level = ${Math.min(100, Math.floor(nftCount / 10))},
          xp = ${Math.round(overallScore)},
          updated_at = NOW()
      `);
      
      // ============ STEP 9: Upsert Player Civilization ============
      await db.execute(sql`
        INSERT INTO player_civilizations (
          wallet_address,
          civilization_name,
          army_power,
          religion_power,
          bank_power,
          merchant_power,
          special_power,
          total_power,
          army_count,
          religion_count,
          bank_count,
          merchant_count,
          special_count,
          land_count,
          ship_count,
          material_output,
          battle_readiness,
          overall_rank,
          created_at,
          updated_at
        ) VALUES (
          ${walletAddress},
          ${'Civilization of ' + walletAddress.substring(0, 8)},
          ${roles.army * 10},
          ${roles.religion * 8},
          ${roles.bank * 12},
          ${roles.merchant * 6},
          ${roles.special * 15},
          ${Math.round(civilizationScore)},
          ${roles.army},
          ${roles.religion},
          ${roles.bank},
          ${roles.merchant},
          ${roles.special},
          ${roles.land},
          ${roles.ships},
          ${Math.round(materialScore)},
          ${Math.round(battleScore)},
          ${Math.round(overallScore)},
          NOW(),
          NOW()
        )
        ON CONFLICT (wallet_address)
        DO UPDATE SET
          army_power = ${roles.army * 10},
          religion_power = ${roles.religion * 8},
          bank_power = ${roles.bank * 12},
          merchant_power = ${roles.merchant * 6},
          special_power = ${roles.special * 15},
          total_power = ${Math.round(civilizationScore)},
          army_count = ${roles.army},
          religion_count = ${roles.religion},
          bank_count = ${roles.bank},
          merchant_count = ${roles.merchant},
          special_count = ${roles.special},
          land_count = ${roles.land},
          ship_count = ${roles.ships},
          material_output = ${Math.round(materialScore)},
          battle_readiness = ${Math.round(battleScore)},
          overall_rank = ${Math.round(overallScore)},
          updated_at = NOW()
      `);
      
      totalCivilizations++;
      processedPlayers++;
      
      console.log(`   ✅ Player & Civilization saved`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\n2️⃣  PHASE 2: Calculating Global Rankings\n');
    
    // Update all player ranks based on overall score
    await db.execute(sql`
      UPDATE player_civilizations
      SET overall_rank = subquery.rank
      FROM (
        SELECT 
          wallet_address,
          ROW_NUMBER() OVER (ORDER BY overall_rank DESC) as rank
        FROM player_civilizations
      ) AS subquery
      WHERE player_civilizations.wallet_address = subquery.wallet_address
    `);
    
    await db.execute(sql`
      UPDATE gaming_players
      SET rank = subquery.rank
      FROM (
        SELECT 
          wallet_address,
          ROW_NUMBER() OVER (ORDER BY xp DESC) as rank
        FROM gaming_players
      ) AS subquery
      WHERE gaming_players.wallet_address = subquery.wallet_address
    `);
    
    console.log('✅ Global rankings updated\n');
    
    // Get top 10 civilizations
    const topCivs = await db.execute(sql`
      SELECT 
        wallet_address,
        civilization_name,
        total_power,
        overall_rank,
        army_count,
        religion_count,
        bank_count,
        merchant_count,
        land_count
      FROM player_civilizations
      ORDER BY overall_rank ASC
      LIMIT 10
    `);
    
    console.log('🏆 TOP 10 CIVILIZATIONS:\n');
    topCivs.rows.forEach((civ, idx) => {
      console.log(`   ${idx + 1}. ${String(civ.wallet_address).substring(0, 12)}... - Score: ${Number(civ.overall_rank).toLocaleString()}`);
      console.log(`      Army: ${civ.army_count} | Religion: ${civ.religion_count} | Bank: ${civ.bank_count} | Land: ${civ.land_count}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('\n🎉 PLAYER SCANNER COMPLETE!\n');
    console.log(`✅ Players processed: ${processedPlayers}`);
    console.log(`✅ Civilizations created: ${totalCivilizations}`);
    console.log(`✅ Rankings calculated: ${topCivs.rows.length}`);
    console.log('='.repeat(70));
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Scanner failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

scanPlayers();
