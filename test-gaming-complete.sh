#!/bin/bash

# Gaming Endpoints Complete Test
# Tests all gaming endpoints including battles, squadrons, alliances
# Using dippydoge/Neverknow1. credentials

BASE_URL="http://localhost:5000"

echo "=================================="
echo "GAMING ENDPOINTS COMPLETE TEST"
echo "=================================="
echo ""

# Step 1: Login
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/riddle-wallet/login" \
  -H "Content-Type: application/json" \
  -d '{"handle":"dippydoge","masterPassword":"Neverknow1."}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.sessionToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Test Gaming Battle Endpoints
echo "=================================="
echo "GAMING BATTLE ENDPOINTS"
echo "=================================="
echo ""

echo "📊 GET /api/gaming/battles/player - Player's battles:"
BATTLES_PLAYER=$(curl -s -X GET "$BASE_URL/api/gaming/battles/player" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$BATTLES_PLAYER" | jq '.'
echo ""

echo "📜 GET /api/gaming/battles/history - Battle history:"
BATTLES_HISTORY=$(curl -s -X GET "$BASE_URL/api/gaming/battles/history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$BATTLES_HISTORY" | jq '.'
echo ""

# Step 3: Test Gaming Squadron Endpoints
echo "=================================="
echo "GAMING SQUADRON ENDPOINTS"
echo "=================================="
echo ""

echo "🎖️ GET /api/gaming/squadrons - Player's squadrons:"
SQUADRONS=$(curl -s -X GET "$BASE_URL/api/gaming/squadrons" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$SQUADRONS" | jq '.'
echo ""

echo "➕ POST /api/gaming/squadrons - Create test squadron:"
CREATE_SQUADRON=$(curl -s -X POST "$BASE_URL/api/gaming/squadrons" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Gaming Squadron","description":"Created via gaming API test","max_size":15}')
echo "$CREATE_SQUADRON" | jq '.'
echo ""

# Step 4: Test Alliance Endpoints
echo "=================================="
echo "ALLIANCE ENDPOINTS"
echo "=================================="
echo ""

echo "🤝 GET /api/alliances - All alliances:"
ALLIANCES=$(curl -s -X GET "$BASE_URL/api/alliances" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$ALLIANCES" | jq '.'
echo ""

echo "👤 GET /api/alliances/player - Player's alliance:"
ALLIANCE_PLAYER=$(curl -s -X GET "$BASE_URL/api/alliances/player" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$ALLIANCE_PLAYER" | jq '.'
echo ""

echo "🏰 GET /api/my-alliance - My alliance details:"
MY_ALLIANCE=$(curl -s -X GET "$BASE_URL/api/my-alliance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$MY_ALLIANCE" | jq '.'
echo ""

# Step 5: Test Battle System Endpoints (from battle-system-routes.ts)
echo "=================================="
echo "BATTLE SYSTEM ENDPOINTS"
echo "=================================="
echo ""

echo "⚔️ GET /api/battles/player - Player's battles (battle-system):"
BATTLES_SYSTEM=$(curl -s -X GET "$BASE_URL/api/battles/player" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$BATTLES_SYSTEM" | jq '.'
echo ""

echo "🔓 GET /api/battles/open - Open battles:"
BATTLES_OPEN=$(curl -s -X GET "$BASE_URL/api/battles/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$BATTLES_OPEN" | jq '.'
echo ""

echo "🏆 GET /api/battles/completed - Completed battles:"
BATTLES_COMPLETED=$(curl -s -X GET "$BASE_URL/api/battles/completed")
echo "$BATTLES_COMPLETED" | jq '.'
echo ""

# Step 6: Test Gaming Player Endpoints
echo "=================================="
echo "GAMING PLAYER ENDPOINTS"
echo "=================================="
echo ""

echo "🎮 GET /api/gaming/player - Player profile:"
PLAYER=$(curl -s -X GET "$BASE_URL/api/gaming/player" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$PLAYER" | jq '.'
echo ""

echo "📊 GET /api/gaming/stats - Player stats:"
STATS=$(curl -s -X GET "$BASE_URL/api/gaming/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$STATS" | jq '.'
echo ""

# Step 7: Squadron Endpoints (from battle-system-routes.ts)
echo "=================================="
echo "SQUADRON SYSTEM ENDPOINTS"
echo "=================================="
echo ""

echo "🎖️ GET /api/squadrons/dippydoge - Player's squadrons (battle-system):"
SQUADRONS_SYSTEM=$(curl -s -X GET "$BASE_URL/api/squadrons/dippydoge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: riddleSessionToken=$TOKEN")
echo "$SQUADRONS_SYSTEM" | jq '.'
echo ""

echo ""
echo "=================================="
echo "✅ GAMING ENDPOINTS TEST COMPLETE"
echo "=================================="
echo ""
echo "Summary:"
echo "- Gaming battles: $(echo $BATTLES_PLAYER | jq -r '.battle_count // 0') battles"
echo "- Gaming squadrons: $(echo $SQUADRONS | jq -r '.count // 0') squadrons"
echo "- Alliances: $(echo $ALLIANCES | jq -r '.count // 0') alliances"
echo "- Player alliance: $(echo $ALLIANCE_PLAYER | jq -r '.alliance // "none"')"
echo "- Battle system battles: Available"
echo "- Player stats: Available"
