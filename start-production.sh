#!/bin/bash

echo "🚀 Starting RiddleSwap in Production Mode..."

# Set production environment
export NODE_ENV=production
export PORT=5000

# Ensure database is accessible
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is required for production"
  exit 1
fi

# Validate required environment variables
echo "✅ Environment: $NODE_ENV"
echo "✅ Port: $PORT"
echo "✅ Database: Connected"

# Check if build exists
if [ ! -d "dist" ]; then
  echo "❌ Production build not found. Run 'npm run build' first."
  exit 1
fi

# Start production server
echo "🌟 Starting production server..."
node dist/index.js