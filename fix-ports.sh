#!/bin/bash
# Fix .replit ports for autoscale deployment

echo "🔧 Fixing .replit ports configuration..."

# Create backup
cp .replit .replit.backup

# Remove all port configurations first
sed -i '/^\[\[ports\]\]/,/^$/d' .replit

# Add back only ONE port configuration
cat >> .replit << 'EOF'

[[ports]]
localPort = 5000
externalPort = 80
EOF

echo "✅ Fixed! .replit now has only ONE port (5000 → 80)"
echo "📋 Backup saved as .replit.backup"
cat .replit | grep -A 2 "^\[\[ports\]\]"
