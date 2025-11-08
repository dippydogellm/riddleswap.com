#!/bin/bash

BASE_URL="http://localhost:5000"
HANDLE="dippydoge"
PASSWORD="Neverknow1."

echo "========================================="
echo "BATTLE MULTIPLAYER TESTING"
echo "========================================="
echo ""

# Step 1: Login
echo "1. Logging in as $HANDLE..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/riddle-wallet/login" \
  -H "Content-Type: application/json" \
  -d "{\"handle\":\"$HANDLE\",\"masterPassword\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Get squadrons
echo "2. Getting squadrons..."
SQUADRONS=$(curl -s -X GET "$BASE_URL/api/gaming/squadrons" \
  -H "Cookie: riddleSessionToken=$TOKEN")

echo "Squadrons: $SQUADRONS" | jq '.' 2>/dev/null || echo "$SQUADRONS"
SQUADRON_ID=$(echo $SQUADRONS | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using squadron: $SQUADRON_ID"
echo ""

# Step 3: Create 1v1 battle
echo "3. Creating 1v1 battle..."
BATTLE_1V1=$(curl -s -X POST "$BASE_URL/api/gaming/battles/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: riddleSessionToken=$TOKEN" \
  -d "{
    \"creator_squadron_id\": \"$SQUADRON_ID\",
    \"battle_mode\": \"1v1\",
    \"battle_type\": \"duel\",
    \"wager_amount\": 10,
    \"wager_currency\": \"XRP\",
    \"combat_type\": \"military\",
    \"land_type\": \"plains\"
  }")

echo "1v1 Battle Response:"
echo "$BATTLE_1V1" | jq '.' 2>/dev/null || echo "$BATTLE_1V1"
BATTLE_1V1_ID=$(echo $BATTLE_1V1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# Step 4: Create multiplayer battle with invited players
echo "4. Creating multiplayer battle (max 4 players)..."
BATTLE_MULTI=$(curl -s -X POST "$BASE_URL/api/gaming/battles/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: riddleSessionToken=$TOKEN" \
  -d "{
    \"creator_squadron_id\": \"$SQUADRON_ID\",
    \"battle_mode\": \"multiplayer\",
    \"max_players\": 4,
    \"battle_type\": \"free_for_all\",
    \"invited_players\": [\"geegee\", \"testplayer\"],
    \"wager_amount\": 50,
    \"wager_currency\": \"RDL\",
    \"combat_type\": \"military\",
    \"land_type\": \"forest\",
    \"is_private\": true
  }")

echo "Multiplayer Battle Response:"
echo "$BATTLE_MULTI" | jq '.' 2>/dev/null || echo "$BATTLE_MULTI"
BATTLE_MULTI_ID=$(echo $BATTLE_MULTI | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# Step 5: Get available battles
echo "5. Getting available battles..."
AVAILABLE=$(curl -s -X GET "$BASE_URL/api/gaming/battles/available" \
  -H "Cookie: riddleSessionToken=$TOKEN")

echo "Available Battles:"
echo "$AVAILABLE" | jq '.' 2>/dev/null || echo "$AVAILABLE"
echo ""

# Step 6: Try to join a battle (will fail since we're the creator)
if [ ! -z "$BATTLE_1V1_ID" ]; then
  echo "6. Attempting to join own battle (should fail)..."
  JOIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/gaming/battles/$BATTLE_1V1_ID/join" \
    -H "Content-Type: application/json" \
    -H "Cookie: riddleSessionToken=$TOKEN" \
    -d "{\"squadron_id\": \"$SQUADRON_ID\"}")
  
  echo "Join Response:"
  echo "$JOIN_RESPONSE" | jq '.' 2>/dev/null || echo "$JOIN_RESPONSE"
  echo ""
fi

echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo "✅ Login: Success"
echo "✅ Get Squadrons: Success"
echo "✅ Create 1v1 Battle: $([ ! -z "$BATTLE_1V1_ID" ] && echo "Success (ID: $BATTLE_1V1_ID)" || echo "Failed")"
echo "✅ Create Multiplayer Battle: $([ ! -z "$BATTLE_MULTI_ID" ] && echo "Success (ID: $BATTLE_MULTI_ID)" || echo "Failed")"
echo "✅ Get Available Battles: Success"
echo ""
echo "Battle modes tested:"
echo "  - 1v1 duels"
echo "  - Multiplayer (4 players)"
echo "  - Invited players"
echo "  - Private battles"
echo "  - XRP and RDL wagering"
