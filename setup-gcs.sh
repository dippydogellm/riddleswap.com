#!/bin/bash

# GCS Quick Setup Script
# This script helps you configure Google Cloud Storage credentials

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Google Cloud Storage Setup for RiddleSwap           ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if env file exists
if [ ! -f "env" ]; then
    echo "❌ Error: 'env' file not found!"
    echo "Please create it from env.example or contact your team."
    exit 1
fi

echo "📋 Current GCS Configuration:"
echo ""
source ./env 2>/dev/null
echo "   Bucket Name: ${GCS_BUCKET_NAME:-'Not set'}"
echo "   Project ID: ${GCS_PROJECT_ID:-'Not set'}"
echo "   Key File: ${GCS_KEY_FILE:-'Not set'}"
echo "   Key JSON: ${GCS_KEY_JSON:+'Set (hidden)'}"
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo "1) Set up with JSON key file path"
echo "2) Set up with inline JSON credentials"
echo "3) Test current configuration"
echo "4) View setup instructions"
echo "5) Exit"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "📁 Setting up with JSON key file..."
        read -p "Enter the full path to your service account JSON file: " keyfile
        
        if [ ! -f "$keyfile" ]; then
            echo "❌ File not found: $keyfile"
            exit 1
        fi
        
        # Extract project ID from JSON file
        project_id=$(grep -o '"project_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$keyfile" | cut -d'"' -f4)
        
        # Update env file
        if grep -q "export GCS_KEY_FILE=" env; then
            sed -i.bak "s|# export GCS_KEY_FILE=.*|export GCS_KEY_FILE=\"$keyfile\"|" env
        else
            echo "export GCS_KEY_FILE=\"$keyfile\"" >> env
        fi
        
        if [ -n "$project_id" ]; then
            if grep -q "export GCS_PROJECT_ID=" env; then
                sed -i.bak "s|# export GCS_PROJECT_ID=.*|export GCS_PROJECT_ID=\"$project_id\"|" env
            else
                echo "export GCS_PROJECT_ID=\"$project_id\"" >> env
            fi
            echo "✅ Project ID set to: $project_id"
        fi
        
        echo "✅ GCS_KEY_FILE configured!"
        echo ""
        echo "Run 'source ./env' to load the new configuration."
        ;;
        
    2)
        echo ""
        echo "📝 Setting up with inline JSON..."
        echo "Paste your service account JSON content (press Enter, then Ctrl+D when done):"
        json_content=$(cat)
        
        # Validate JSON
        if ! echo "$json_content" | python3 -m json.tool > /dev/null 2>&1; then
            echo "❌ Invalid JSON format!"
            exit 1
        fi
        
        # Extract project ID
        project_id=$(echo "$json_content" | grep -o '"project_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        
        # Update env file
        if grep -q "export GCS_KEY_JSON=" env; then
            # Escape special characters
            escaped_json=$(echo "$json_content" | sed "s/'/'\\\\''/g")
            sed -i.bak "s|# export GCS_KEY_JSON=.*|export GCS_KEY_JSON='$escaped_json'|" env
        else
            echo "export GCS_KEY_JSON='$json_content'" >> env
        fi
        
        if [ -n "$project_id" ]; then
            if grep -q "export GCS_PROJECT_ID=" env; then
                sed -i.bak "s|# export GCS_PROJECT_ID=.*|export GCS_PROJECT_ID=\"$project_id\"|" env
            else
                echo "export GCS_PROJECT_ID=\"$project_id\"" >> env
            fi
            echo "✅ Project ID set to: $project_id"
        fi
        
        echo "✅ GCS_KEY_JSON configured!"
        echo ""
        echo "Run 'source ./env' to load the new configuration."
        ;;
        
    3)
        echo ""
        echo "🧪 Testing GCS connection..."
        source ./env
        node test-gcs-connection.js
        ;;
        
    4)
        echo ""
        cat GCS_SETUP_GUIDE.md
        ;;
        
    5)
        echo "Goodbye!"
        exit 0
        ;;
        
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "Next steps:"
echo "1. Run: source ./env"
echo "2. Test: node test-gcs-connection.js"
echo "3. Start using GCS in your application!"
