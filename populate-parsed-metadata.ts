/**
 * POPULATE DATABASE WITH PARSED METADATA
 * 
 * Parses ALL metadata fields into proper database columns instead of JSON storage:
 * - nft_name, nft_description, nft_image (individual fields)
 * - owner, issuer, sequence, transfer_fee (blockchain data)
 * - url, uri (metadata links)
 * - issued_at, owner_changed_at (timestamps)
 * - minted_by_marketplace (marketplace info)
 * - All image URLs (CDN, preview, thumbnail)
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';
const BITHOMP_BASE = 'https://bithomp.com/api/v2';

interface BithompNFT {
  nftokenID: string;
  owner: string;
  issuer: string;
  nftokenTaxon: number;
  transferFee: number;
  sequence: number;
  nftSerial: number;
  issuedAt: number;
  ownerChangedAt: number;
  mintedByMarketplace?: string;
  collection: string;
  url?: string;
  uri?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  assets?: {
    image?: string;
    preview?: string;
    thumbnail?: string;
  };
}

async function fetchBithompData(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'x-bithomp-token': BITHOMP_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Bithomp API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function populateDatabase() {
  console.log('📦 POPULATING DATABASE WITH PARSED METADATA\n');
  console.log('='.repeat(70));

  try {
    // Get all collections with NFTs from database
    const collections = await db.execute(sql.raw(`
      SELECT 
        c.id,
        c.collection_name,
        c.collection_id as issuer_with_taxon,
        c.taxon,
        c.game_role,
        COUNT(n.id) as nft_count
      FROM gaming_nft_collections c
      LEFT JOIN gaming_nfts n ON n.collection_id = c.id
      GROUP BY c.id, c.collection_name, c.collection_id, c.taxon, c.game_role
      HAVING COUNT(n.id) > 0
      ORDER BY c.collection_name;
    `));

    console.log(`✅ Found ${collections.rows.length} collections with NFTs\n`);

    let totalUpdated = 0;
    let totalApiCalls = 0;

      for (const col of collections.rows) {
      const collectionName = String(col.collection_name);
      const issuerWithTaxon = String(col.issuer_with_taxon);
      const taxon = Number(col.taxon);
      const collectionId = String(col.id);

      // Split issuer from taxon
      const issuer = issuerWithTaxon.split(':')[0];      console.log(`\n${'='.repeat(70)}`);
      console.log(`📁 ${collectionName}`);
      console.log(`   Issuer: ${issuer}`);
      console.log(`   Taxon: ${taxon}`);
      console.log(`   Expected NFTs: ${col.nft_count}`);
      console.log(`${'='.repeat(70)}\n`);

      try {
        // Fetch ALL NFTs for this collection from Bithomp
        const baseUrl = `${BITHOMP_BASE}/nfts?issuer=${issuer}&taxon=${taxon}&limit=400&metadata=true&assets=true`;
        let allNFTs: BithompNFT[] = [];
        let marker = null;
        let page = 0;
        const maxPages = 15;

        console.log('1️⃣  Fetching NFT data from Bithomp...');

        do {
          try {
            const url = marker ? `${baseUrl}&marker=${marker}` : baseUrl;
            const data = await fetchBithompData(url);
            totalApiCalls++;
            page++;

            if (data.nfts && data.nfts.length > 0) {
              allNFTs = allNFTs.concat(data.nfts);
              marker = data.marker || null;
              console.log(`   📦 Page ${page}: ${data.nfts.length} NFTs (Total: ${allNFTs.length})`);
            } else {
              break;
            }

            await new Promise(resolve => setTimeout(resolve, 200));

          } catch (error) {
            console.log(`   ⚠️  Error on page ${page + 1}: ${error}`);
            break;
          }
        } while (marker && page < maxPages);

        console.log(`   ✅ Fetched ${allNFTs.length} NFTs from Bithomp\n`);

        if (allNFTs.length === 0) {
          console.log('   ⚠️  No NFTs returned from API, skipping...\n');
          continue;
        }

        // Update each NFT in database with parsed metadata
        console.log('2️⃣  Parsing and updating database with individual fields...');

        let updated = 0;
        for (const nft of allNFTs) {
          try {
            // Extract all metadata fields
            const nftName = nft.metadata?.name || `NFT #${nft.sequence}`;
            const nftDescription = nft.metadata?.description || '';
            const nftImage = nft.metadata?.image || '';
            const cdnImage = nft.assets?.image || '';
            const cdnPreview = nft.assets?.preview || '';
            const cdnThumbnail = nft.assets?.thumbnail || '';
            const metadataUrl = nft.url || '';
            const uri = nft.uri || '';
            const marketplace = nft.mintedByMarketplace || '';

            // Escape strings for SQL
            const escapedName = nftName.replace(/'/g, "''");
            const escapedDesc = nftDescription.replace(/'/g, "''");
            const escapedImage = nftImage.replace(/'/g, "''");
            const escapedCdnImage = cdnImage.replace(/'/g, "''");
            const escapedCdnPreview = cdnPreview.replace(/'/g, "''");
            const escapedCdnThumbnail = cdnThumbnail.replace(/'/g, "''");
            const escapedUrl = metadataUrl.replace(/'/g, "''");
            const escapedUri = uri.replace(/'/g, "''");
            const escapedMarketplace = marketplace.replace(/'/g, "''");
            const escapedOwner = nft.owner.replace(/'/g, "''");

            // Convert timestamps
            const issuedDate = nft.issuedAt ? new Date(nft.issuedAt * 1000).toISOString() : null;
            const ownerChangedDate = nft.ownerChangedAt ? new Date(nft.ownerChangedAt * 1000).toISOString() : null;

            // Update NFT record with ALL parsed fields
            await db.execute(sql.raw(`
              UPDATE gaming_nfts
              SET 
                nft_name = '${escapedName}',
                nft_description = '${escapedDesc}',
                nft_image = '${escapedImage}',
                image_cdn_url = '${escapedCdnImage}',
                image_preview_url = '${escapedCdnPreview}',
                image_thumbnail_url = '${escapedCdnThumbnail}',
                metadata_url = '${escapedUrl}',
                uri = '${escapedUri}',
                owner = '${escapedOwner}',
                sequence_number = ${nft.sequence},
                transfer_fee = ${nft.transferFee || 0},
                minted_by_marketplace = '${escapedMarketplace}',
                issued_at = ${issuedDate ? `'${issuedDate}'` : 'NULL'},
                owner_changed_at = ${ownerChangedDate ? `'${ownerChangedDate}'` : 'NULL'},
                updated_at = NOW()
              WHERE token_id = '${nft.nftokenID}'
              AND collection_id = '${collectionId}';
            `));

            updated++;

            if (updated % 100 === 0) {
              console.log(`   ✅ Updated ${updated}/${allNFTs.length} NFTs...`);
            }

          } catch (error) {
            console.error(`   ❌ Error updating NFT ${nft.nftokenID}:`, error);
          }
        }

        console.log(`   ✅ Updated ${updated} NFTs with parsed metadata\n`);
        totalUpdated += updated;

      } catch (error) {
        console.error(`\n❌ Error processing ${collectionName}:`, error);
      }

      // Rate limit between collections
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 DATABASE POPULATION COMPLETE!\n');
    console.log(`✅ Collections processed: ${collections.rows.length}`);
    console.log(`✅ Total NFTs updated: ${totalUpdated}`);
    console.log(`✅ Total API calls: ${totalApiCalls}`);
    console.log('\n📊 All metadata parsed into individual database fields:');
    console.log('   ✓ nft_name, nft_description, nft_image');
    console.log('   ✓ image_cdn_url, image_preview_url, image_thumbnail_url');
    console.log('   ✓ metadata_url, uri');
    console.log('   ✓ owner, sequence_number, transfer_fee');
    console.log('   ✓ minted_by_marketplace');
    console.log('   ✓ issued_at, owner_changed_at (timestamps)');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

populateDatabase();
