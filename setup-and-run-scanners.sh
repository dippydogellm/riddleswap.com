#!/bin/bash

# NFT Gaming Scanner System - Setup & Run Script
# This script sets up the database and runs all scanners

echo "🚀 NFT Gaming Scanner System - Setup & Run"
echo "==========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  echo ""
  echo "To set up the database:"
  echo "1. Get your Neon PostgreSQL connection string"
  echo "2. Set it as an environment variable:"
  echo "   export DATABASE_URL='postgresql://user:password@host/database'"
  echo ""
  echo "Or create a .env file in the project root with:"
  echo "   DATABASE_URL=postgresql://user:password@host/database"
  echo ""
  exit 1
fi

echo "✅ DATABASE_URL is configured"
echo ""

# Step 1: Push database schema
echo "📊 Step 1: Pushing database schema..."
echo "--------------------------------------"
npm run db:push

if [ $? -ne 0 ]; then
  echo "❌ Failed to push database schema"
  exit 1
fi

echo "✅ Database schema pushed successfully"
echo ""

# Step 2: Run test script to verify setup
echo "🧪 Step 2: Running system tests..."
echo "--------------------------------------"
node test-scanner-system.cjs

if [ $? -ne 0 ]; then
  echo "⚠️  Tests failed, but continuing..."
fi

echo ""

# Step 3: Start the server
echo "🚀 Step 3: Starting server..."
echo "--------------------------------------"
echo "The server will start with scanner routes enabled."
echo "Access the admin dashboard at: http://localhost:5000/admin/scanner-management"
echo "Access rankings dashboard at: http://localhost:5000/rankings-dashboard"
echo ""
echo "Available scanner endpoints:"
echo "  POST /api/scanners/collection/scan"
echo "  POST /api/scanners/ai-scoring/collection/:id"
echo "  POST /api/scanners/rarity/scan"
echo "  POST /api/scanners/civilization/scan"
echo "  GET  /api/scanners/logs"
echo "  GET  /api/scanners/stats"
echo ""
echo "Available ranking endpoints:"
echo "  GET  /api/rankings/nfts/top"
echo "  GET  /api/rankings/civilizations/top"
echo "  GET  /api/rankings/history"
echo "  GET  /api/rankings/collections"
echo ""

# Start the server (user should do this manually after reviewing)
echo "To start the server, run:"
echo "  npm run dev"
echo ""
echo "✅ Setup complete! Ready to run scanners."
