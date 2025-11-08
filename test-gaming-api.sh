#!/bin/bash
# Gaming V3 Backend API Test Script

echo "=========================================="
echo "Gaming V3 Backend API Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:5000/api/gaming"
COOKIE_FILE="cookies.txt"

# Counters
PASS=0
FAIL=0

# Function to test API endpoint
test_api() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -n "Testing: $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL$endpoint")
    else
        response=$(curl -s -X $method -w "\n%{http_code}" \
            -H "Content-Type: application/json" \
            -b "$COOKIE_FILE" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        PASS=$((PASS + 1))
        return 0
    elif [ "$http_code" = "401" ]; then
        echo -e "${YELLOW}⚠ AUTH REQUIRED${NC} (HTTP $http_code)"
        return 2
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "Response: $body" | head -c 100
        FAIL=$((FAIL + 1))
        return 1
    fi
}

# Check server
echo "Checking if server is running..."
if ! curl -s "http://localhost:5000" > /dev/null; then
    echo -e "${RED}ERROR: Server not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test Dashboard Endpoints
echo "=== Dashboard Endpoints ==="
test_api "GET" "/player/stats" "Get Player Stats"
test_api "GET" "/battles/my-battles?limit=5" "Get My Battles"
test_api "GET" "/battles/available?limit=5" "Get Available Battles"
test_api "GET" "/player/squadrons" "Get Player Squadrons"
echo ""

# Test Battle Endpoints
echo "=== Battle Management Endpoints ==="
test_api "GET" "/battles/available?page=1&limit=10" "Get Available Battles (paginated)"
test_api "GET" "/battles/available?status=pending" "Get Pending Battles (filtered)"

# Note: These require valid IDs and auth
echo ""
echo "=== Battle Action Endpoints (require valid battle IDs) ==="
echo "Note: Following tests require authentication and valid battle IDs"
echo "- POST /battles/create - Create Battle"
echo "- POST /battles/:id/join - Join Battle"
echo "- POST /battles/:id/action - Take Battle Action"
echo "- GET /battles/:id - Get Battle Details"
echo "- GET /battles/:id/timeline - Get Battle Timeline"
echo "- POST /battles/:id/complete - Complete Battle"
echo ""

# Test Scorecard Endpoints
echo "=== Scorecard Endpoints (require valid NFT IDs) ==="
echo "Note: Following tests require valid NFT IDs"
echo "- GET /nft/:nftId/scorecard - Get NFT Scorecard"
echo "- GET /nft/:nftId/medals - Get NFT Medals"
echo "- GET /nft/:nftId/battle-history - Get NFT Battle History"
echo ""

# Test Leaderboards
echo "=== Leaderboard Endpoints ==="
test_api "GET" "/leaderboards?sort=battles&limit=10" "Get Leaderboard (by battles)"
test_api "GET" "/leaderboards?sort=kills&limit=10" "Get Leaderboard (by kills)"
test_api "GET" "/leaderboards?sort=damage&limit=10" "Get Leaderboard (by damage)"
test_api "GET" "/leaderboards?sort=medals&limit=10" "Get Leaderboard (by medals)"
echo ""

# Test Civilization Stats
echo "=== Additional Endpoints ==="
test_api "GET" "/civilization/test-civ/stats" "Get Civilization Stats"
echo ""

# Summary
echo "=========================================="
echo "API Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All basic API tests passed!${NC}"
    echo ""
    echo "To test authenticated endpoints:"
    echo "1. Login via browser at http://localhost:5000"
    echo "2. Copy session cookie"
    echo "3. Run: curl -b 'riddleSessionToken=YOUR_TOKEN' http://localhost:5000/api/gaming/player/stats"
else
    echo -e "${RED}Some tests failed. Check server logs.${NC}"
fi
echo ""

# Test Battle Creation (example - requires auth)
echo "=========================================="
echo "Example: Create Battle (requires auth)"
echo "=========================================="
echo ""
echo "curl -X POST http://localhost:5000/api/gaming/battles/create \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -b 'riddleSessionToken=YOUR_TOKEN' \\"
echo "  -d '{"
echo "    \"creator_squadron_id\": \"squadron-uuid\","
echo "    \"battle_mode\": \"1v1\","
echo "    \"battle_type\": \"free_for_all\","
echo "    \"combat_type\": \"military\","
echo "    \"entry_fee\": 10,"
echo "    \"entry_currency\": \"XRP\","
echo "    \"response_timeout_seconds\": 300,"
echo "    \"battle_length_minutes\": 30"
echo "  }'"
echo ""
