#!/bin/bash
# Gaming V3 Frontend Navigation Test Script

echo "=========================================="
echo "Gaming V3 Frontend Navigation Tests"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5000"
COOKIE_FILE="cookies.txt"

# Function to test route
test_route() {
    local route=$1
    local description=$2
    
    echo -n "Testing: $description ($route)... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL$route")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
        return 1
    fi
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL" > /dev/null; then
    echo -e "${RED}ERROR: Server not running at $BASE_URL${NC}"
    echo "Please start the server first: npx tsx server/index.ts"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test Gaming Routes
echo "=== Gaming Route Tests ==="
test_route "/gaming" "Gaming Dashboard"
test_route "/gaming/dashboard" "Gaming Dashboard (explicit)"
test_route "/gaming/battles" "Battles List"
test_route "/gaming/battles/create" "Battle Create"
test_route "/gaming/scorecards" "Leaderboards"
test_route "/gaming/leaderboards" "Leaderboards (alt)"
echo ""

# Test External Routes Referenced
echo "=== External Route Tests ==="
test_route "/nft-collections" "NFT Collections (from My NFTs button)"
echo ""

# Summary
echo "=========================================="
echo "Navigation Test Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Open browser to $BASE_URL/gaming"
echo "2. Manually test button clicks"
echo "3. Check browser console for errors"
echo "4. Test API integration with authenticated session"
