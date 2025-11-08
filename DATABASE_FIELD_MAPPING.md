# Database Field Mapping Reference

This document ensures frontend and backend use consistent field names across the entire battle system.

## ✅ Squadrons Table (`squadrons`)
| Field | Type | Frontend Interface | Backend Routes |
|-------|------|-------------------|----------------|
| `id` | text (UUID) | `squadron_id` → **CHANGED TO** `id` | `squadrons.id` |
| `player_id` | text (UUID FK) | `player_id` | `squadrons.player_id` |
| `name` | text | `name` ✅ | `squadrons.name` |
| `description` | text | `description` ✅ | `squadrons.description` |
| `squadron_type` | text | `squadron_type` ✅ | `squadrons.squadron_type` |
| `total_power` | decimal | `total_power` ✅ | `squadrons.total_power` |
| `nft_count` | integer | `nft_count` ✅ | `squadrons.nft_count` |
| `max_nft_capacity` | integer | - | `squadrons.max_nft_capacity` (default: 10) |
| `created_at` | timestamp | `created_at` ✅ | `squadrons.created_at` |

**Frontend Interface (Fixed):**
```typescript
interface Squadron {
  id: string;              // Fixed from squadron_id
  name: string;            // Fixed from squadron_name
  description: string | null;
  player_id: string;
  total_power: number;
  nft_count: number;
  created_at: string;
  nfts?: PlayerNFT[];
}
```

## ✅ Squadron NFTs Table (`squadron_nfts`)
| Field | Type | Backend Routes |
|-------|------|----------------|
| `id` | text (UUID) | `squadronNfts.id` |
| `squadron_id` | text (UUID FK) | `squadronNfts.squadron_id` ✅ |
| `nft_id` | text (UUID FK) | `squadronNfts.nft_id` ✅ |
| `role` | text | `squadronNfts.role` ✅ |
| `army_contribution` | integer | `squadronNfts.army_contribution` ✅ |
| `religion_contribution` | integer | `squadronNfts.religion_contribution` ✅ |
| `civilization_contribution` | integer | `squadronNfts.civilization_contribution` ✅ |
| `economic_contribution` | integer | `squadronNfts.economic_contribution` ✅ |

## ✅ Battles Table (`battles`)
| Field | Type | Backend Routes | Validation |
|-------|------|----------------|------------|
| `id` | text (UUID) | `battles.id` | - |
| `battle_type` | text | `battles.battle_type` | `"1v1"` or `"group"` |
| `combat_type` | text | `battles.combat_type` | `"military"`, `"social"`, `"religious"` |
| `land_type` | text | `battles.land_type` | 8 terrain types |
| `max_nfts_limit` | integer | `battles.max_nfts_limit` | Default: 1000 |
| `creator_player_id` | text (UUID FK) | `battles.creator_player_id` | Must be valid gaming_players.id |
| `creator_squadron_id` | text (UUID FK) | `battles.creator_squadron_id` | Must have ≥1 NFT (≥2 for group) |

## ✅ Gaming Players Table (`gaming_players`)
| Field | Type | Backend Routes |
|-------|------|----------------|
| `id` | text (UUID) | `gamingPlayers.id` ✅ PRIMARY KEY |
| `user_handle` | text | `gamingPlayers.user_handle` ✅ UNIQUE |
| `wallet_address` | text | `gamingPlayers.wallet_address` ✅ |
| `player_name` | text | `gamingPlayers.player_name` ✅ |

## ✅ Gaming NFTs Table (`gaming_nfts`)
| Field | Type | Backend Routes |
|-------|------|----------------|
| `id` | text (UUID) | `gamingNfts.id` ✅ |
| `token_id` | text | `gamingNfts.token_id` ✅ |
| `owner_address` | text | `gamingNfts.owner_address` ✅ (Fixed from `current_owner`) |

## 🔧 Validation Rules

### Squadron Capacity
- **Maximum NFTs per squadron**: 10 (configurable via `max_nft_capacity`)
- **Validation**: Checked before adding NFT to squadron
- **Error**: `"Squadron is at maximum capacity (10 NFTs). Remove an NFT first."`

### Battle Team Size
- **1v1 Battle**: Minimum 1 NFT
- **Group Battle**: Minimum 2 NFTs
- **Validation**: Checked at battle creation
- **Error**: `"Group battles require at least 2 NFTs in your squadron. Please add more NFTs first."`

### Foreign Key Relations
- `squadrons.player_id` → `gaming_players.id` (UUID, not handle!)
- `squadronNfts.squadron_id` → `squadrons.id`
- `squadronNfts.nft_id` → `gamingNfts.id`
- `battles.creator_player_id` → `gaming_players.id`
- `battles.creator_squadron_id` → `squadrons.id`

## 🛡️ Anti-Cheat Measures
1. **Squadron locking**: Cannot modify squadron while `in_battle = true`
2. **Server-side hash**: Battle hash computed from canonical squadron state
3. **Player ID validation**: Always use UUID, never string handle
4. **Capacity limits**: Enforced server-side, cannot be bypassed

## 📊 API Response Formats

### Squadron Creation
```json
{
  "success": true,
  "squadron": {
    "id": "uuid",
    "name": "Elite Guard",
    "description": "My best warriors",
    "player_id": "uuid",
    "squadron_type": "balanced"
  }
}
```

### Squadron List
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Elite Guard",
      "total_power": 1250.50,
      "nft_count": 5
    }
  ]
}
```

### Battle Creation
```json
{
  "success": true,
  "battle": {
    "id": "uuid",
    "battle_type": "group",
    "combat_type": "military",
    "land_type": "mountains",
    "creator_squadron_id": "uuid"
  }
}
```

## 🔄 Migration Notes
All field names have been synchronized as of **October 26, 2025**:
- ✅ Fixed `squadron_name` → `name`
- ✅ Fixed `squadron_id` → `id` in frontend interfaces
- ✅ Fixed `current_owner` → `owner_address`
- ✅ Fixed decimal field updates to use `.toString()`
- ✅ Added squadron capacity validation
- ✅ Added group battle team size validation
