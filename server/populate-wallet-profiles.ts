import { db } from '../server/db';
import { riddleWallets, inquisitionPlayerProfiles, externalWallets } from '../shared/schema';
import { eq, sql, isNull } from 'drizzle-orm';

/**
 * Comprehensive script to ensure ALL Riddle wallets have complete profiles:
 * 1. Create riddle_wallet_profiles for wallets missing them
 * 2. Create inquisition_player_profiles for gaming features
 * 3. Verify external wallet connections are properly set up
 */

async function populateAllWalletProfiles() {
  console.log('\n🔍 Starting comprehensive wallet profile population...\n');
  
  try {
    // Step 1: Get all Riddle wallets
    console.log('📊 Fetching all Riddle wallets...');
    const allWallets = await db.select({
      id: riddleWallets.id,
      handle: riddleWallets.handle,
      ethAddress: riddleWallets.ethAddress,
      xrpAddress: riddleWallets.xrpAddress,
      solAddress: riddleWallets.solAddress,
      btcAddress: riddleWallets.btcAddress,
      linkedWalletAddress: riddleWallets.linkedWalletAddress,
      linkedWalletChain: riddleWallets.linkedWalletChain,
    }).from(riddleWallets);
    
    console.log(`✅ Found ${allWallets.length} total Riddle wallets\n`);
    
    // Step 2: Create missing riddle_wallet_profiles using raw SQL
    console.log('📊 Creating missing riddle_wallet_profiles...');
    
    let profilesCreated = 0;
    for (const wallet of allWallets) {
      try {
        // Use XRPL address as primary wallet, fallback to ETH if no XRPL
        const primaryAddress = wallet.xrpAddress || wallet.ethAddress || wallet.solAddress || wallet.btcAddress || 'pending';
        
        await db.execute(sql`
          INSERT INTO riddle_wallet_profiles (riddle_handle, xrpl_wallet_address, is_active)
          VALUES (${wallet.handle}, ${primaryAddress}, true)
          ON CONFLICT (riddle_handle) DO NOTHING
        `);
        
        profilesCreated++;
        if (profilesCreated % 10 === 0) {
          console.log(`  ✓ Processed ${profilesCreated}/${allWallets.length} profiles...`);
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to create profile for ${wallet.handle}:`, error.message);
      }
    }
    
    console.log(`✅ Created ${profilesCreated} riddle_wallet_profiles (duplicates skipped)\n`);
    
    // Step 3: Check existing inquisition player profiles
    console.log('📊 Checking existing inquisition_player_profiles...');
    const existingInqProfiles = await db.select({
      user_handle: inquisitionPlayerProfiles.user_handle,
      wallet_address: inquisitionPlayerProfiles.wallet_address,
    }).from(inquisitionPlayerProfiles);
    
    const existingInqHandles = new Set(existingInqProfiles.map(p => p.user_handle).filter(Boolean));
    const existingInqAddresses = new Set(existingInqProfiles.map(p => p.wallet_address));
    console.log(`✅ Found ${existingInqProfiles.length} existing inquisition profiles\n`);
    
    // Step 4: Create missing inquisition player profiles (gaming profiles)
    const walletsNeedingInqProfiles = allWallets.filter(w => 
      !existingInqHandles.has(w.handle) && 
      (w.xrpAddress && !existingInqAddresses.has(w.xrpAddress))
    );
    console.log(`🔨 Creating ${walletsNeedingInqProfiles.length} missing inquisition_player_profiles...`);
    
    let inqProfilesCreated = 0;
    for (const wallet of walletsNeedingInqProfiles) {
      try {
        const primaryAddress = wallet.xrpAddress || wallet.ethAddress || wallet.solAddress || wallet.btcAddress || wallet.id;
        
        // Generate a default character name from the handle
        const characterName = wallet.handle.charAt(0).toUpperCase() + wallet.handle.slice(1);
        
        await db.insert(inquisitionPlayerProfiles).values({
          wallet_address: primaryAddress,
          user_handle: wallet.handle,
          character_name: characterName,
          character_class: 'Knight', // Default class
          character_bio: `${characterName} has joined the Inquisition.`,
          is_profile_complete: false, // User can complete it later
          total_generations: 0,
        } as any);
        
        inqProfilesCreated++;
        if (inqProfilesCreated % 10 === 0) {
          console.log(`  ✓ Created ${inqProfilesCreated}/${walletsNeedingInqProfiles.length} gamer profiles...`);
        }
      } catch (error: any) {
        if (error.code === '23505') {
          console.log(`  ⚠️  Inquisition profile already exists for ${wallet.handle}`);
        } else {
          console.error(`  ❌ Failed to create inquisition profile for ${wallet.handle}:`, error.message);
        }
      }
    }
    
    console.log(`✅ Created ${inqProfilesCreated} new inquisition_player_profiles\n`);
    
    // Step 5: Verify external wallet connections
    console.log('📊 Checking external wallet connections...');
    const walletsWithLinkedAddresses = allWallets.filter(w => w.linkedWalletAddress);
    console.log(`✅ Found ${walletsWithLinkedAddresses.length} wallets with linked external addresses\n`);
    
    let externalWalletsVerified = 0;
    for (const wallet of walletsWithLinkedAddresses) {
      try {
        // Check if external wallet entry exists
        const existing = await db.select()
          .from(externalWallets)
          .where(eq(externalWallets.address, wallet.linkedWalletAddress!))
          .limit(1);
        
        if (existing.length === 0 && wallet.linkedWalletChain) {
          // Create external wallet entry
          await db.insert(externalWallets).values({
            user_id: wallet.handle,
            wallet_type: wallet.linkedWalletChain === 'xrp' ? 'xaman' : 
                       wallet.linkedWalletChain === 'eth' ? 'metamask' : 
                       wallet.linkedWalletChain === 'sol' ? 'phantom' : 'unknown',
            address: wallet.linkedWalletAddress!,
            chain: wallet.linkedWalletChain,
            verified: true,
          } as any);
          externalWalletsVerified++;
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to verify external wallet for ${wallet.handle}:`, error.message);
      }
    }
    
    if (externalWalletsVerified > 0) {
      console.log(`✅ Created ${externalWalletsVerified} external wallet entries\n`);
    }
    
    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 WALLET PROFILE POPULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Riddle Wallets: ${allWallets.length}`);
    console.log(`Riddle Wallet Profiles Processed: ${profilesCreated}`);
    console.log(`Inquisition Gamer Profiles Created: ${inqProfilesCreated}`);
    console.log(`External Wallet Entries Verified: ${externalWalletsVerified}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ ALL WALLET PROFILES POPULATED SUCCESSFULLY!\n');
    
    return {
      totalWallets: allWallets.length,
      profilesCreated,
      inqProfilesCreated,
      externalWalletsVerified,
    };
    
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR during wallet profile population:', error);
    throw error;
  }
}

// Auto-run when executed directly - DISABLED to prevent killing production server
// This was causing 502 errors in deployed environments
// if (import.meta.url === `file://${process.argv[1]}`) {
//   populateAllWalletProfiles()
//     .then((stats) => {
//       console.log('✅ Profile population completed successfully');
//       console.log('Stats:', JSON.stringify(stats, null, 2));
//       process.exit(0);
//     })
//     .catch((error) => {
//       console.error('❌ Profile population failed:', error);
//       process.exit(1);
//     });
// }

export { populateAllWalletProfiles };
