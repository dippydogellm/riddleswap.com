#!/bin/bash
# Squadron endpoint test for dippydoge

# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/riddle-wallet/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"dippydoge","masterPassword":"Neverknow1."}' | jq -r '.sessionToken')

echo "🔑 Token: ${TOKEN:0:15}..."
echo ""

# Test 1: Get player's squadrons
echo "TEST 1: GET /api/squadrons/player"
curl -s "http://localhost:5000/api/squadrons/player" \
  -H "Authorization: Bearer $TOKEN" | jq '{success, squadron_count: (.squadrons | length)}' 2>/dev/null || echo "No response"
echo ""

# Test 2: List all squadrons
echo "TEST 2: GET /api/gaming/squadrons"
curl -s "http://localhost:5000/api/gaming/squadrons" \
  -H "Authorization: Bearer $TOKEN" | jq '{success, total: .total}' 2>/dev/null || echo "No response"
echo ""

# Test 3: Create squadron
echo "TEST 3: POST /api/gaming/squadrons"
curl -s -X POST "http://localhost:5000/api/gaming/squadrons" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Squadron",
    "description": "Testing squadron system",
    "squadron_type": "offensive",
    "nfts": [
      {
        "nft_id": "test-nft-1",
        "nft_name": "Test NFT",
        "nft_power": 100,
        "position": 1
      }
    ],
    "power": {
      "army": 100,
      "navy": 50,
      "airforce": 75
    }
  }' | jq '{success, message, squadron_id: .squadron.id}' 2>/dev/null || echo "No response"
echo ""

echo "✅ DONE"
