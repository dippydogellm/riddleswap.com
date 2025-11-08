#!/bin/bash

# Test Alliance Endpoints with dippydoge / Neverknow1.
echo "🤝 Testing Alliance System Endpoints"
echo "===================================="
echo ""

BASE_URL="http://localhost:5000"

# 1. Test public endpoint - List all alliances
echo "1️⃣ GET /api/gaming/alliances (Public - No Auth)"
curl -s "$BASE_URL/api/gaming/alliances" | jq -c '{success, count, first_alliance: .alliances[0].name}'
echo ""
echo ""

# 2. Login to get session token
echo "2️⃣ Login as dippydoge"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/riddle-wallet/login" \
  -H "Content-Type: application/json" \
  -d '{"handle":"dippydoge","password":"Neverknow1."}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.sessionToken // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed or no session token returned"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful - Token: ${TOKEN:0:20}..."
echo ""
echo ""

# 3. Test GET /api/gaming/alliances/player - Get current user's alliance
echo "3️⃣ GET /api/gaming/alliances/player (Authenticated)"
curl -s "$BASE_URL/api/gaming/alliances/player" \
  -H "Authorization: Bearer $TOKEN" | jq -c '{success, has_alliance: (.alliance != null)}'
echo ""
echo ""

# 4. Test GET /api/gaming/my-alliance - Same as above
echo "4️⃣ GET /api/gaming/my-alliance (Authenticated)"
curl -s "$BASE_URL/api/gaming/my-alliance" \
  -H "Authorization: Bearer $TOKEN" | jq -c '{success, alliance_name: .alliance.name}'
echo ""
echo ""

# 5. Test GET CSRF token
echo "5️⃣ GET /api/gaming/csrf-token (Authenticated)"
CSRF_RESPONSE=$(curl -s "$BASE_URL/api/gaming/csrf-token" \
  -H "Authorization: Bearer $TOKEN")
CSRF_TOKEN=$(echo $CSRF_RESPONSE | jq -r '.csrfToken // empty')
echo "CSRF Token: ${CSRF_TOKEN:0:20}..."
echo ""
echo ""

# 6. Test POST /api/gaming/alliances - Create alliance
echo "6️⃣ POST /api/gaming/alliances - Create Test Alliance (Authenticated + CSRF)"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/gaming/alliances" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Alliance",
    "tag": "TEST",
    "description": "Testing alliance system",
    "motto": "Test or die",
    "alliance_type": "general"
  }')

echo "$CREATE_RESPONSE" | jq -c '{success, message, alliance_name: .alliance.name, alliance_tag: .alliance.tag}'

# Extract alliance ID if created
ALLIANCE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.alliance.id // empty')
echo "Alliance ID: $ALLIANCE_ID"
echo ""
echo ""

if [ ! -z "$ALLIANCE_ID" ]; then
  # 7. Test GET /api/gaming/alliances/:id - Get alliance details
  echo "7️⃣ GET /api/gaming/alliances/$ALLIANCE_ID (Public)"
  curl -s "$BASE_URL/api/gaming/alliances/$ALLIANCE_ID" | jq -c '{success, name: .alliance.name, members: .alliance.members | length}'
  echo ""
  echo ""

  # 8. Test PUT /api/gaming/alliances/:id - Update alliance
  echo "8️⃣ PUT /api/gaming/alliances/$ALLIANCE_ID - Update settings (Leader only)"
  curl -s -X PUT "$BASE_URL/api/gaming/alliances/$ALLIANCE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"motto": "Updated motto", "is_recruiting": true}' | jq -c '{success, message}'
  echo ""
  echo ""

  # 9. Test GET /api/gaming/alliances/:id/requests - Get join requests
  echo "9️⃣ GET /api/gaming/alliances/$ALLIANCE_ID/requests (Leader/Officer only)"
  curl -s "$BASE_URL/api/gaming/alliances/$ALLIANCE_ID/requests" \
    -H "Authorization: Bearer $TOKEN" | jq -c '{success, count}'
  echo ""
  echo ""
fi

echo ""
echo "✅ Alliance endpoint testing complete!"
echo "===================================="
