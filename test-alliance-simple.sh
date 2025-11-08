#!/bin/bash
# Simple alliance endpoint test for dippydoge

# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/riddle-wallet/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"dippydoge","masterPassword":"Neverknow1."}' | jq -r '.sessionToken')

echo "🔑 Token: ${TOKEN:0:15}..."
echo ""

# Test 1: List alliances (public)
echo "TEST 1: GET /api/alliances"
curl -s http://localhost:5000/api/alliances | jq '.success, .count, .alliances[0].name' 2>/dev/null || echo "No response"
echo ""

# Test 2: Get player's alliance
echo "TEST 2: GET /api/alliances/player"  
curl -s http://localhost:5000/api/alliances/player \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message' 2>/dev/null || echo "No response"
echo ""

# Test 3: Get my alliance
echo "TEST 3: GET /api/my-alliance"
curl -s http://localhost:5000/api/my-alliance \
  -H "Authorization: Bearer $TOKEN" | jq '.success' 2>/dev/null || echo "No response"
echo ""

echo "✅ DONE"
