#!/usr/bin/env node

/**
 * Google Cloud Storage Connection Test
 * Tests connection to the riddleswap bucket
 */

const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'riddleswap';
const GCS_KEY_FILE = process.env.GCS_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GCS_KEY_JSON = process.env.GCS_KEY_JSON || process.env.GCS_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_JSON;

async function testGCSConnection() {
  console.log('🧪 Testing Google Cloud Storage Connection...\n');

  // Check configuration
  console.log('📋 Configuration:');
  console.log(`   Bucket Name: ${GCS_BUCKET_NAME}`);
  console.log(`   Project ID: ${GCS_PROJECT_ID || '(auto-detect)'}`);
  console.log(`   Key File: ${GCS_KEY_FILE ? '✅ Set' : '❌ Not set'}`);
  console.log(`   Key JSON: ${GCS_KEY_JSON ? '✅ Set' : '❌ Not set'}`);
  console.log('');

  if (!GCS_KEY_FILE && !GCS_KEY_JSON) {
    console.error('❌ ERROR: No credentials configured!');
    console.error('   Set either GCS_KEY_FILE or GCS_KEY_JSON in your .env file');
    console.error('   See GCS_SETUP_GUIDE.md for instructions');
    process.exit(1);
  }

  try {
    // Initialize Storage
    const storageConfig = {};

    if (GCS_KEY_JSON) {
      console.log('🔑 Using inline JSON credentials...');
      try {
        let jsonStr = GCS_KEY_JSON;
        if (!jsonStr.trim().startsWith('{')) {
          // Likely base64-encoded
          jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
        }
        const creds = JSON.parse(jsonStr);
        storageConfig.credentials = {
          client_email: creds.client_email,
          private_key: creds.private_key,
        };
        if (creds.project_id) {
          storageConfig.projectId = creds.project_id;
          console.log(`   Service Account: ${creds.client_email}`);
          console.log(`   Project ID: ${creds.project_id}`);
        }
      } catch (e) {
        console.error('❌ Failed to parse GCS_KEY_JSON:', e.message);
        process.exit(1);
      }
    } else if (GCS_KEY_FILE) {
      console.log(`🔑 Using key file: ${GCS_KEY_FILE}`);
      storageConfig.keyFilename = GCS_KEY_FILE;
    }

    if (GCS_PROJECT_ID) {
      storageConfig.projectId = GCS_PROJECT_ID;
    }

    const storage = new Storage(storageConfig);
    const bucket = storage.bucket(GCS_BUCKET_NAME);

    console.log('\n✅ Storage client initialized\n');

    // Test 1: Check bucket exists
    console.log('📦 Test 1: Checking bucket exists...');
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error(`❌ Bucket '${GCS_BUCKET_NAME}' does not exist!`);
      console.error('   Create it at: https://console.cloud.google.com/storage/browser');
      process.exit(1);
    }
    console.log(`✅ Bucket '${GCS_BUCKET_NAME}' exists\n`);

    // Test 2: Get bucket metadata
    console.log('📊 Test 2: Fetching bucket metadata...');
    const [metadata] = await bucket.getMetadata();
    console.log(`✅ Bucket metadata retrieved:`);
    console.log(`   Location: ${metadata.location}`);
    console.log(`   Storage Class: ${metadata.storageClass}`);
    console.log(`   Created: ${metadata.timeCreated}`);
    console.log('');

    // Test 3: List files (first 5)
    console.log('📄 Test 3: Listing files...');
    const [files] = await bucket.getFiles({ maxResults: 5 });
    console.log(`✅ Found ${files.length} files (showing max 5):`);
    if (files.length === 0) {
      console.log('   (No files in bucket yet)');
    } else {
      files.forEach(file => {
        console.log(`   - ${file.name} (${(file.metadata.size / 1024).toFixed(2)} KB)`);
      });
    }
    console.log('');

    // Test 4: Test write permission (create test file)
    console.log('✍️  Test 4: Testing write permissions...');
    const testFileName = `test-connection-${Date.now()}.txt`;
    const testFile = bucket.file(testFileName);
    await testFile.save('This is a test file from GCS connection test', {
      contentType: 'text/plain',
      metadata: {
        custom: 'test-file'
      }
    });
    console.log(`✅ Successfully created test file: ${testFileName}\n`);

    // Test 5: Test read permission
    console.log('📖 Test 5: Testing read permissions...');
    const [content] = await testFile.download();
    console.log(`✅ Successfully read test file content: "${content.toString()}"\n`);

    // Test 6: Test delete permission
    console.log('🗑️  Test 6: Testing delete permissions...');
    await testFile.delete();
    console.log(`✅ Successfully deleted test file\n`);

    // Success summary
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('Your Google Cloud Storage is properly configured:');
    console.log(`✓ Bucket: ${GCS_BUCKET_NAME}`);
    console.log(`✓ Location: ${metadata.location}`);
    console.log('✓ Permissions: Read, Write, Delete');
    console.log('');
    console.log('You can now use GCS in your application!');
    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('═══════════════════════════════════════════════════');
    console.error('Error:', error.message);
    console.error('');

    if (error.code === 'ENOENT') {
      console.error('💡 Solution: The key file path is invalid');
      console.error('   Check GCS_KEY_FILE in your .env file');
    } else if (error.code === 403) {
      console.error('💡 Solution: Permission denied');
      console.error('   Grant your service account "Storage Object Admin" role');
      console.error('   Visit: https://console.cloud.google.com/storage/browser/riddleswap?tab=permissions');
    } else if (error.code === 404) {
      console.error('💡 Solution: Bucket not found');
      console.error('   Verify bucket name is correct: riddleswap');
      console.error('   Visit: https://console.cloud.google.com/storage/browser');
    } else if (error.message.includes('Could not load the default credentials')) {
      console.error('💡 Solution: Invalid or missing credentials');
      console.error('   Ensure GCS_KEY_FILE or GCS_KEY_JSON is properly set');
      console.error('   See GCS_SETUP_GUIDE.md for instructions');
    }

    console.error('');
    console.error('For detailed setup instructions, see: GCS_SETUP_GUIDE.md');
    console.error('');
    process.exit(1);
  }
}

// Run the test
testGCSConnection();
