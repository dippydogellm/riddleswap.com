# Enhanced NFT Search System ✅

## Overview
Advanced NFT search functionality with multiple filter options for gaming NFTs including owner, collection, rarity, and power levels.

## Backend API

### New Endpoint: `GET /api/gaming/nfts/search`
**File**: `server/routes/gaming.ts`

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | string | Wallet address (rXXX...) or player handle (@username) |
| `collection` | string | Collection ID or collection name (partial match supported) |
| `minRarity` | number | Minimum rarity rank |
| `maxRarity` | number | Maximum rarity rank |
| `minPower` | number | Minimum power multiplier (e.g., 0.5) |
| `maxPower` | number | Maximum power multiplier (e.g., 5.0) |
| `rarityTier` | string | Rarity tier: `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `sortBy` | string | Sort field: `rarity`, `power`, `name` |
| `order` | string | Sort order: `asc`, `desc` |
| `limit` | number | Results per page (default: 50) |
| `offset` | number | Pagination offset (default: 0) |

#### Response Format
```json
{
  "success": true,
  "filters": {
    "owner": "rXXXXX",
    "collection": "The Trolls Inquisition",
    "minRarity": 1,
    "maxRarity": 100,
    "rarityTier": "epic",
    "sortBy": "rarity",
    "order": "asc"
  },
  "total": 250,
  "limit": 50,
  "offset": 0,
  "nfts": [
    {
      "id": "uuid",
      "nft_id": "issuer:taxon:sequence",
      "token_id": "123",
      "name": "Troll Warrior #123",
      "description": "A fierce warrior...",
      "image_url": "https://...",
      "owner_address": "rXXXXX",
      "collection_id": "collection-uuid",
      "collection_name": "The Trolls Inquisition",
      "rarity_rank": 42,
      "rarity_score": "985.75",
      "rarity_tier": "epic",
      "power_multiplier": "2.50",
      "power_percentile": "95.5",
      "is_genesis": true,
      "traits": { "class": "warrior", "strength": 95 },
      "game_stats": { "battles_won": 10 },
      "overall_rarity_rank": 42,
      "collection_rarity_rank": 15,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Features
- **Owner Lookup**: Supports both wallet addresses and player handles
- **Collection Search**: Exact match or partial name matching
- **Rarity Filtering**: By rank range or tier
- **Power Filtering**: By power multiplier range
- **Pagination**: Full support with total count
- **Multiple Sort Options**: By rarity, power, or name
- **Join Collections**: Returns collection name with each NFT

## Frontend Component

### New Page: Gaming NFT Browse
**File**: `client/src/pages/gaming-nft-browse.tsx`

#### Features
- **Material UI Design**: Modern, responsive interface
- **Collapsible Filters Panel**: Show/hide advanced filters
- **Real-time Search**: Apply filters with button or clear all
- **Visual Rarity Tiers**: Color-coded chips for rarity levels
- **Pagination**: Navigate large result sets
- **NFT Cards**: Image, name, collection, rarity rank, power level
- **Click-through**: Navigate to NFT detail pages
- **Empty States**: Helpful messages when no results found
- **Loading States**: Progress indicators during search

#### Rarity Tier Colors
- **Common**: Gray (#9e9e9e)
- **Uncommon**: Green (#4caf50)
- **Rare**: Blue (#2196f3)
- **Epic**: Purple (#9c27b0)
- **Legendary**: Orange (#ff9800)

#### Filter UI Components
1. **Owner Search Field**: Text input with person icon
2. **Collection Search Field**: Text input with collection icon
3. **Rarity Tier Dropdown**: Select with color-coded options
4. **Sort By Dropdown**: Rarity, Power, Name
5. **Sort Order Dropdown**: Ascending, Descending
6. **Rarity Rank Slider**: 1-1000 range slider
7. **Power Multiplier Slider**: 0.5x-5.0x range slider
8. **Clear Filters Button**: Reset all filters
9. **Apply Filters Button**: Execute search

## Navigation Integration

### Gaming Navigation Menu
**File**: `client/src/components/GamingNavigation.tsx`

Added new menu item:
```tsx
{
  name: 'NFT Browser',
  href: '/gaming/nfts/browse',
  icon: <Package />,
  description: 'Advanced NFT search'
}
```

### Gaming Dashboard Hub
**File**: `client/src/pages/gaming-dashboard-hub.tsx`

Added "Advanced Search" button next to "Browse Marketplace" in empty NFT state.

### Routing
**File**: `client/src/App.tsx`

Added route:
```tsx
{ path: '/gaming/nfts/browse', component: GamingNFTBrowse }
```

## Database Schema Reference

### Gaming NFTs Table
Key fields used for search:
```typescript
{
  id: string (UUID)
  collection_id: string (FK)
  token_id: string
  nft_id: string (unique identifier)
  owner_address: string (wallet)
  name: string
  description: string
  image_url: string
  rarity_rank: integer (1-N per collection)
  rarity_score: decimal (calculated score)
  rarity_tier: string (common/uncommon/rare/epic/legendary)
  power_multiplier: decimal (0.5-5.0+)
  power_percentile: decimal (0-100)
  is_genesis: boolean
  traits: jsonb (NFT attributes)
  game_stats: jsonb (battle stats)
  overall_rarity_rank: integer (global rank)
  collection_rarity_rank: integer (within collection)
}
```

### Indexes Used
- `idx_gaming_nfts_collection` (collection_id)
- `idx_gaming_nfts_owner` (owner_address)
- `idx_gaming_nfts_rarity` (rarity_rank)

## Usage Examples

### Search by Owner
```
GET /api/gaming/nfts/browse?owner=riddleswap123
GET /api/gaming/nfts/browse?owner=rXXXXXXXXXXXXX
```

### Search by Collection
```
GET /api/gaming/nfts/browse?collection=The%20Trolls%20Inquisition
GET /api/gaming/nfts/browse?collection=Troll
```

### Search by Rarity Tier
```
GET /api/gaming/nfts/browse?rarityTier=legendary
GET /api/gaming/nfts/browse?rarityTier=epic&sortBy=power&order=desc
```

### Search by Rarity Rank Range
```
GET /api/gaming/nfts/browse?minRarity=1&maxRarity=100
```

### Search by Power Level
```
GET /api/gaming/nfts/browse?minPower=2.0&maxPower=5.0&sortBy=power&order=desc
```

### Combined Filters
```
GET /api/gaming/nfts/browse?collection=Troll&rarityTier=epic&minPower=2.0&sortBy=rarity&order=asc&limit=24
```

### Pagination
```
GET /api/gaming/nfts/browse?collection=Troll&limit=24&offset=0    (Page 1)
GET /api/gaming/nfts/browse?collection=Troll&limit=24&offset=24   (Page 2)
GET /api/gaming/nfts/browse?collection=Troll&limit=24&offset=48   (Page 3)
```

## Testing Checklist

### Backend Tests
- [ ] Search by wallet address returns correct NFTs
- [ ] Search by player handle converts to wallet and returns NFTs
- [ ] Collection ID exact match works
- [ ] Collection name partial match works
- [ ] Rarity rank range filters correctly
- [ ] Power multiplier range filters correctly
- [ ] Rarity tier filter works for all tiers
- [ ] Sort by rarity (asc/desc) works
- [ ] Sort by power (asc/desc) works
- [ ] Sort by name (asc/desc) works
- [ ] Pagination returns correct offsets
- [ ] Total count is accurate
- [ ] Combined filters work together
- [ ] Empty results return gracefully

### Frontend Tests
- [ ] Page loads without errors
- [ ] Filter panel can collapse/expand
- [ ] Owner search accepts wallet addresses
- [ ] Owner search accepts player handles
- [ ] Collection search suggests matches
- [ ] Rarity tier dropdown shows all tiers with colors
- [ ] Sort options change results order
- [ ] Rarity slider updates range display
- [ ] Power slider updates range display
- [ ] Clear filters resets all inputs
- [ ] Apply filters triggers search
- [ ] NFT cards display correctly
- [ ] Images load with fallback
- [ ] Rarity chips show correct colors
- [ ] Click on NFT navigates to detail page
- [ ] Pagination works forward/backward
- [ ] Loading state shows spinner
- [ ] Error state shows message
- [ ] Empty state shows helpful text

## Performance Considerations

### Database Optimization
- Uses indexed fields (collection_id, owner_address, rarity_rank)
- Limits results to prevent large queries
- Uses offset pagination for efficient page navigation
- Joins are left joins to avoid missing data

### Frontend Optimization
- React Query caching reduces redundant API calls
- Lazy loading of images
- Debounced search inputs (can be added)
- Pagination prevents rendering thousands of cards

## Future Enhancements

### Phase 2
- [ ] Search by trait attributes (e.g., "strength > 90")
- [ ] Search by battle stats (e.g., "battles_won > 5")
- [ ] Price range filter (if NFTs are listed for sale)
- [ ] Date range filters (created_at, last_transferred)
- [ ] Saved search profiles
- [ ] Bulk actions (select multiple NFTs)

### Phase 3
- [ ] Auto-complete suggestions for collection names
- [ ] Popular searches shortcuts
- [ ] Advanced trait filtering UI
- [ ] Export search results to CSV
- [ ] Share search URL with filters
- [ ] Watchlist/favorites integration

## API Rate Limiting

Current: None
Recommended:
- 100 requests per minute per IP
- 1000 requests per hour per authenticated user

## Security

- No authentication required for basic search
- Owner search validates player handle exists
- SQL injection prevented by parameterized queries
- XSS prevented by React's built-in escaping

## Related Files

### Backend
- `server/routes/gaming.ts` - Search endpoint
- `shared/schema.ts` - Gaming NFT schema

### Frontend
- `client/src/pages/gaming-nft-browse.tsx` - Browse page
- `client/src/pages/gaming-dashboard-hub.tsx` - Dashboard link
- `client/src/components/GamingNavigation.tsx` - Nav menu
- `client/src/App.tsx` - Route configuration
- `client/src/utils/imageNormalizer.ts` - Image handling

## Success Metrics

- Search response time < 500ms
- User engagement with filters > 60%
- Zero downtime during deployment
- Mobile responsive on all screen sizes
- Accessibility score > 90

## Status: ✅ COMPLETE

All features implemented and ready for testing:
- ✅ Backend API endpoint
- ✅ Frontend search page
- ✅ Navigation integration
- ✅ Routing configuration
- ✅ Filter UI components
- ✅ Pagination support
- ✅ Error handling
- ✅ Loading states
- ✅ Empty states
