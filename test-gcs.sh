#!/bin/bash

# Quick GCS Test - Run this after configuring credentials

echo "🧪 Quick GCS Connection Test"
echo "=============================="
echo ""

# Load environment
source ./env 2>/dev/null

# Check if credentials are set
if [ -z "$GCS_KEY_FILE" ] && [ -z "$GCS_KEY_JSON" ]; then
    echo "❌ No GCS credentials configured!"
    echo ""
    echo "Please run one of these commands first:"
    echo "  1. Interactive setup: ./setup-gcs.sh"
    echo "  2. Manual setup: Edit 'env' file and add GCS_KEY_FILE or GCS_KEY_JSON"
    echo ""
    echo "See GCS_SETUP_GUIDE.md for detailed instructions."
    exit 1
fi

echo "✅ Credentials found"
echo "📦 Bucket: ${GCS_BUCKET_NAME:-riddleswap}"
echo ""
echo "Running connection test..."
echo ""

node test-gcs-connection.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "✅ SUCCESS! GCS is ready to use"
    echo "═══════════════════════════════════════════════════"
else
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "❌ Test failed - see errors above"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "Need help? Check GCS_SETUP_GUIDE.md"
fi

exit $exit_code
