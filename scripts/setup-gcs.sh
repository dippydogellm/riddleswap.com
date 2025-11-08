#!/bin/bash

# GCS Storage Setup Script
# This script helps you configure Google Cloud Storage for the Riddle app

echo "🗄️  Google Cloud Storage Setup for Riddle"
echo "=========================================="
echo ""

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI (gcloud) is not installed"
    echo "📥 Install from: https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "Or run: curl https://sdk.cloud.google.com | bash"
    exit 1
fi

echo "✅ Google Cloud CLI found"
echo ""

# Get project ID
read -p "Enter your GCP Project ID (or press Enter to use current): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$PROJECT_ID" ]; then
        echo "❌ No project ID found. Please specify one."
        exit 1
    fi
fi

echo "📋 Using project: $PROJECT_ID"
echo ""

# Get bucket name
read -p "Enter bucket name [riddle-storage]: " BUCKET_NAME
BUCKET_NAME=${BUCKET_NAME:-riddle-storage}

echo "🪣 Bucket name: $BUCKET_NAME"
echo ""

# Check if bucket exists
if gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
    echo "✅ Bucket already exists: gs://$BUCKET_NAME"
else
    echo "Creating bucket..."
    
    # Get region
    read -p "Enter region [us-central1]: " REGION
    REGION=${REGION:-us-central1}
    
    # Create bucket
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME
    
    if [ $? -eq 0 ]; then
        echo "✅ Bucket created successfully"
    else
        echo "❌ Failed to create bucket"
        exit 1
    fi
fi

echo ""

# Enable public access (optional)
read -p "Make bucket publicly readable? (y/n) [n]: " MAKE_PUBLIC
MAKE_PUBLIC=${MAKE_PUBLIC:-n}

if [ "$MAKE_PUBLIC" = "y" ] || [ "$MAKE_PUBLIC" = "Y" ]; then
    echo "Setting public access..."
    gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
    echo "✅ Bucket is now publicly readable"
fi

echo ""

# Create service account
SERVICE_ACCOUNT_NAME="riddle-storage"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "Creating service account: $SERVICE_ACCOUNT_EMAIL"

# Check if service account exists
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID &> /dev/null; then
    echo "✅ Service account already exists"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Riddle Storage Service Account" \
        --project=$PROJECT_ID
    
    if [ $? -eq 0 ]; then
        echo "✅ Service account created"
    else
        echo "❌ Failed to create service account"
        exit 1
    fi
fi

echo ""

# Grant permissions
echo "Granting Storage Admin role..."
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT_EMAIL:objectAdmin gs://$BUCKET_NAME

echo "✅ Permissions granted"
echo ""

# Create key
KEY_FILE="gcs-service-account-key.json"
echo "Creating service account key..."

gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo "✅ Service account key created: $KEY_FILE"
    echo "⚠️  IMPORTANT: Keep this file secure and never commit it to git!"
else
    echo "❌ Failed to create service account key"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Add these to your .env file:"
echo ""
echo "USE_GCS=true"
echo "STORAGE_BACKEND=gcs"
echo "GCS_PROJECT_ID=$PROJECT_ID"
echo "GCS_BUCKET_NAME=$BUCKET_NAME"
echo "GCS_KEY_FILE=$(pwd)/$KEY_FILE"
echo ""
echo "Or for GitHub Codespaces, add these as repository secrets:"
echo "- GCS_PROJECT_ID"
echo "- GCS_BUCKET_NAME"
echo "- GCS_SERVICE_ACCOUNT_KEY (paste the contents of $KEY_FILE)"
echo ""
echo "📚 Documentation: https://cloud.google.com/storage/docs"
echo ""
