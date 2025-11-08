import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, sql } from 'drizzle-orm';
import { inquisitionPlayerProfiles } from '../shared/inquisition-audit-schema.js';

const sql_client = neon(process.env.DATABASE_URL!);
const db = drizzle(sql_client);

async function fixCivilizationData() {
  console.log('🔧 Fixing civilization data for all gamer profiles...');
  
  try {
    // Get all profiles that need fixing
    const profiles = await db
      .select({
        id: inquisitionPlayerProfiles.id,
        user_handle: inquisitionPlayerProfiles.user_handle,
        character_name: inquisitionPlayerProfiles.character_name,
        character_class: inquisitionPlayerProfiles.character_class,
        profile_metadata: inquisitionPlayerProfiles.profile_metadata
      })
      .from(inquisitionPlayerProfiles);
    
    console.log(`📊 Found ${profiles.length} profiles to update`);
    
    let updatedCount = 0;
    
    for (const profile of profiles) {
      // Check if profile_metadata already has proper structure
      const metadata = profile.profile_metadata as any || {};
      
      if (!metadata.civilization || !metadata.civilization.civilization_name) {
        // Create proper civilization and player data
        const updatedMetadata = {
          player: {
            player_name: profile.character_name || profile.user_handle || 'Unknown Player',
            level: metadata.player?.level || 1,
            commander_profile_image: metadata.player?.commander_profile_image || null,
            commander_class: profile.character_class || 'Knight',
            play_type: metadata.player?.play_type || 'Balanced'
          },
          civilization: {
            civilization_name: `${profile.character_name || profile.user_handle}'s Kingdom`,
            motto: 'Forging destiny through conquest',
            crest_image: null,
            military_strength: 100, // Starting strength
            culture_level: 1,
            research_level: 1,
            total_wealth: "1000", // Starting wealth
            reputation: 50, // Starting reputation
            wonders_built: 0
          },
          // Preserve any existing data
          ...metadata
        };
        
        // Update the profile
        await db
          .update(inquisitionPlayerProfiles)
          .set({ 
            profile_metadata: updatedMetadata as any,
            updated_at: new Date()
           } as any)
          .where(eq(inquisitionPlayerProfiles.id, profile.id));
        
        updatedCount++;
        console.log(`✅ Updated profile for ${profile.user_handle || profile.character_name}`);
      } else {
        console.log(`⏭️  Profile for ${profile.user_handle} already has civilization data`);
      }
    }
    
    console.log(`\n✨ Successfully updated ${updatedCount} profiles with civilization data!`);
    console.log('🎮 Gaming dashboard should now load without crashes!');
    
  } catch (error) {
    console.error('❌ Error fixing civilization data:', error);
    throw error;
  }
}

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
  fixCivilizationData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to fix civilization data:', error);
      process.exit(1);
    });
}

export { fixCivilizationData };