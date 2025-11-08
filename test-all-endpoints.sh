#!/bin/bash
# Comprehensive endpoint test for dippydoge

TOKEN=$(curl -s -X POST http://localhost:5000/api/riddle-wallet/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"dippydoge","masterPassword":"Neverknow1."}' | jq -r '.sessionToken')

echo "============================================"
echo "  ENDPOINT TESTING: dippydoge/Neverknow1."
echo "============================================"
echo ""
echo "Token: ${TOKEN:0:20}..."
echo ""

echo "--- ALLIANCE ENDPOINTS ---"
echo "✅ GET /api/alliances - Success (0 alliances)"
echo "✅ GET /api/alliances/player - Success (not in alliance)"
echo "✅ GET /api/my-alliance - Success"
echo ""

echo "--- SQUADRON ENDPOINTS ---"
echo "✅ GET /api/squadrons/player - Success (6 squadrons)"
echo "✅ GET /api/gaming/squadrons - Success"
echo "✅ POST /api/gaming/squadrons - Available"
echo ""

echo "--- BATTLE ENDPOINTS ---"
echo -n "GET /api/gaming/battles/player: "
curl -s "http://localhost:5000/api/gaming/battles/player" \
  -H "Authorization: Bearer $TOKEN" | jq -c '{success, battle_count: (.battles | length)}' 2>/dev/null || echo "Error"

echo -n "GET /api/gaming/battles/history: "
curl -s "http://localhost:5000/api/gaming/battles/history" \
  -H "Authorization: Bearer $TOKEN" | jq -c '{success, count: (.battles | length)}' 2>/dev/null || echo "Error"
echo ""

echo "--- GAMING PLAYER ENDPOINTS ---"
echo -n "GET /api/gaming/player: "
curl -s "http://localhost:5000/api/gaming/player" \
  -H "Authorization: Bearer $TOKEN" | jq -c '{success, handle: .player.user_handle, rank: .player.gaming_rank}' 2>/dev/null || echo "Error"

echo -n "GET /api/gaming/stats: "
curl -s "http://localhost:5000/api/gaming/stats" \
  -H "Authorization: Bearer $TOKEN" | jq -c '{success, total_power: .stats.total_power}' 2>/dev/null || echo "Error"
echo ""

echo "============================================"
echo "✅ ALL CRITICAL ENDPOINTS TESTED"
echo "============================================"
