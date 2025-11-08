# 🎮 Gaming System - Next Steps Checklist

## ✅ COMPLETED (Tasks 1-5)

### Scanner System ✅
- [x] Scanner 1: Collection Initial Scanner (one-time, issuer+taxon, up to 100k NFTs)
- [x] Scanner 2: OpenAI Metadata Scorer (AI-powered power levels)
- [x] Scanner 3: Rarity & Scoring Scanner (3-hour cron job)
- [x] Scanner 4: Battle & Civilization Scanner (comprehensive metrics)
- [x] Enhanced civilization schema with all fields
- [x] Migration SQL for new civilization fields
- [x] Scanner routes registered in server
- [x] 3-hour cron job auto-initialization
- [x] Complete documentation

### Files Created ✅
- server/scanners/collection-initial-scanner.ts
- server/scanners/openai-metadata-scorer.ts
- server/scanners/rarity-scoring-scanner.ts
- server/scanners/battle-civilization-scanner.ts
- server/routes/scanner-routes.ts
- migrations/add-enhanced-civilization-fields.sql
- GAMING_SCANNER_SYSTEM_COMPLETE.md
- SCANNER_SYSTEM_SUMMARY.md
- SCANNER_ARCHITECTURE_DIAGRAM.md

---

## ⏳ TODO: Task 6 - RiddleCity Save Verification

### Objective
Verify RiddleCity is saving correctly with all data. Check database writes and data integrity.

### Sub-Tasks

#### 6.1 City Creation Verification
- [ ] Test city creation endpoint
- [ ] Verify `cities` table gets record
- [ ] Check all fields populated:
  - [ ] userHandle
  - [ ] cityName
  - [ ] landPlotId (link to land plot)
  - [ ] terrainType
  - [ ] Resources (credits, materials, energy, food)
  - [ ] Population fields
  - [ ] Stats (totalBuildings, economicValue, defenseRating)
  - [ ] City level & XP
  - [ ] Timestamps

#### 6.2 Building Creation/Updates
- [ ] Test building construction endpoint
- [ ] Verify `city_buildings` table gets records
- [ ] Check building stats:
  - [ ] cityId foreign key
  - [ ] buildingType
  - [ ] Building stats (producesCredits, consumesEnergy, etc.)
  - [ ] Completion status
  - [ ] Timestamps

#### 6.3 Resource Calculations
- [ ] Test resource production/consumption
- [ ] Verify tick system updates resources
- [ ] Check resource formulas:
  - [ ] Credits production from buildings
  - [ ] Energy consumption
  - [ ] Food production/consumption
  - [ ] Material production

#### 6.4 Population Mechanics
- [ ] Test population growth
- [ ] Verify happiness affects growth
- [ ] Check population capacity limits
- [ ] Test happiness calculation from buildings

#### 6.5 City Stats Updates
- [ ] Test economicValue recalculation
- [ ] Verify defenseRating updates
- [ ] Check totalBuildings counter
- [ ] Test cityLevel advancement

#### 6.6 Project Economy Integration
- [ ] Test `linkedProjectId` linking
- [ ] Verify `contributeToProject` flag
- [ ] Check `economySharePercent` calculations
- [ ] Test revenue sharing

### Testing Checklist

```typescript
// Test 1: Create City
POST /api/riddlecity/create
{
  "userHandle": "testuser",
  "cityName": "Test City",
  "landPlotId": "plot-123"
}
// ✓ Verify: City record in database
// ✓ Check: All default values set
// ✓ Validate: Timestamps created

// Test 2: Build Structure
POST /api/riddlecity/:cityId/build
{
  "buildingType": "house"
}
// ✓ Verify: Building record created
// ✓ Check: City.totalBuildings incremented
// ✓ Validate: Resources deducted

// Test 3: Resource Tick
POST /api/riddlecity/:cityId/tick
// ✓ Verify: Resources updated
// ✓ Check: Production formulas correct
// ✓ Validate: Consumption calculated

// Test 4: Population Growth
// ✓ Verify: Population increases over time
// ✓ Check: Happiness affects growth rate
// ✓ Validate: Capacity limits enforced
```

### Debug Tools Needed
- [ ] Create `/api/riddlecity/:cityId/debug` endpoint
  - Returns full city state
  - Shows all buildings
  - Lists resource flows
  - Displays calculations
- [ ] Add logging to all RiddleCity write operations
- [ ] Create data integrity check script

---

## ⏳ TODO: Task 7 - Frontend Components Rebuild

### Objective
Complete frontend rebuild with all new fields. Create separate, reusable components for civilizations display.

### Component Structure

#### 7.1 Civilization Dashboard Component
**File**: `client/src/components/civilization/CivilizationDashboard.tsx`

Features:
- [ ] Display total civilization score
- [ ] Show 4 score breakdowns (Battle, City, Economic, Culture)
- [ ] Visual progress bars for each category
- [ ] Global rank indicator
- [ ] Regional rank indicator
- [ ] Player stats summary
- [ ] Material UI design
- [ ] Responsive layout

Props:
```typescript
interface CivilizationDashboardProps {
  playerId: string;
  civilizationData: CivilizationScore;
  isCurrentUser: boolean;
}
```

#### 7.2 Battle Stats Component
**File**: `client/src/components/civilization/BattleStats.tsx`

Features:
- [ ] Total battles participated
- [ ] Wins vs losses visualization
- [ ] Win rate percentage
- [ ] Total battle power used
- [ ] Battle contribution score
- [ ] Recent battle history timeline
- [ ] Battle type breakdown (if applicable)

#### 7.3 City Metrics Component
**File**: `client/src/components/civilization/CityMetrics.tsx`

Features:
- [ ] Total cities owned
- [ ] Total buildings count
- [ ] Total population
- [ ] Average happiness meter
- [ ] Infrastructure score
- [ ] City list with stats
- [ ] Building breakdown by type

#### 7.4 Economic Overview Component
**File**: `client/src/components/civilization/EconomicOverview.tsx`

Features:
- [ ] Total wealth display
- [ ] Daily income breakdown
- [ ] Trade routes count
- [ ] Economic output graph
- [ ] Resource production rates
- [ ] Economic contribution score

#### 7.5 Culture & Research Component
**File**: `client/src/components/civilization/CultureResearch.tsx`

Features:
- [ ] Culture level progress bar
- [ ] Research level progress bar
- [ ] Religious influence meter
- [ ] Cultural development score
- [ ] Wonders built
- [ ] Achievements list

#### 7.6 Leaderboard Component
**File**: `client/src/components/civilization/Leaderboard.tsx`

Features:
- [ ] Global rankings table
- [ ] Regional rankings
- [ ] Filter by category (Battle, City, Economic, Culture)
- [ ] Current player highlight
- [ ] Pagination
- [ ] Search functionality
- [ ] Rank change indicators (↑↓)

#### 7.7 NFT Power Collection Component
**File**: `client/src/components/civilization/NFTPowerCollection.tsx`

Features:
- [ ] Display all owned NFTs
- [ ] Group by collection
- [ ] Total power by category
- [ ] Top NFTs by power
- [ ] Collection completion status
- [ ] Power contribution to civilization

#### 7.8 Score Breakdown Visual Component
**File**: `client/src/components/civilization/ScoreBreakdownChart.tsx`

Features:
- [ ] Pie chart or bar chart of score breakdown
- [ ] Interactive tooltips
- [ ] Color-coded categories
- [ ] Percentage display
- [ ] Compare to average/top players

### Reusable Sub-Components

#### 7.9 Power Bar Component
**File**: `client/src/components/civilization/PowerBar.tsx`
- Reusable progress bar
- Color gradients
- Current/max display
- Percentage calculation

#### 7.10 Stat Card Component
**File**: `client/src/components/civilization/StatCard.tsx`
- Reusable stat display card
- Icon support
- Number formatting
- Trend indicators

#### 7.11 Rank Badge Component
**File**: `client/src/components/civilization/RankBadge.tsx`
- Display global/regional rank
- Medal icons (🥇🥈🥉)
- Animated on rank change

### Page Integration

#### 7.12 Main Civilization Page
**File**: `client/src/pages/civilization.tsx`

Layout:
```
┌──────────────────────────────────────────────────┐
│  Header: Player Name + Total Score + Rank       │
├──────────────────────────────────────────────────┤
│  Tab 1: Overview                                 │
│  ┌──────────────┬──────────────┬──────────────┐ │
│  │ Battle Stats │ City Metrics │ Economic     │ │
│  ├──────────────┴──────────────┴──────────────┤ │
│  │ Culture & Research                          │ │
│  └─────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│  Tab 2: Detailed Breakdown                      │
│  • Score breakdown chart                        │
│  • Contribution analysis                        │
├──────────────────────────────────────────────────┤
│  Tab 3: NFT Collection                          │
│  • All owned NFTs with power                    │
│  • Collection progress                          │
├──────────────────────────────────────────────────┤
│  Tab 4: Rankings                                │
│  • Global leaderboard                           │
│  • Regional leaderboard                         │
└──────────────────────────────────────────────────┘
```

### Data Fetching

#### 7.13 API Hooks
**File**: `client/src/hooks/useCivilization.ts`

Hooks needed:
- [ ] `useCivilizationData(playerId)` - Get full civ data
- [ ] `useBattleStats(playerId)` - Get battle metrics
- [ ] `useCityMetrics(playerId)` - Get city data
- [ ] `useEconomicData(playerId)` - Get economic stats
- [ ] `useLeaderboard(category?)` - Get rankings
- [ ] `usePlayerNFTs(playerAddress)` - Get NFT power

### Styling Guidelines

- **Material UI**: Use @mui/material components throughout
- **Colors**:
  - Battle: Red (#e63946)
  - Religion: Gold (#f1c40f)
  - Civilization: Blue (#3498db)
  - Economic: Green (#2ecc71)
- **Typography**: Material UI default fonts
- **Spacing**: Consistent 8px grid system
- **Animations**: Smooth transitions (0.3s)
- **Responsive**: Mobile-first design

### Testing Checklist

- [ ] All components render without errors
- [ ] Data loads correctly from API
- [ ] Responsive on mobile/tablet/desktop
- [ ] Animations smooth and performant
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Error states handled
- [ ] Loading states displayed
- [ ] Empty states displayed

---

## 📝 Additional Enhancements (Optional)

### Nice-to-Have Features

- [ ] Real-time updates (WebSocket for live scores)
- [ ] Notifications for rank changes
- [ ] Achievement system
- [ ] Civilization customization (colors, motto, crest)
- [ ] Battle replay system
- [ ] City simulation view
- [ ] Export stats as PDF/image
- [ ] Compare with other players
- [ ] Historical data charts
- [ ] Mobile app integration

---

## 🚀 Deployment Steps

### Before Going Live

1. [ ] Run database migration
   ```bash
   npm run db:push
   ```

2. [ ] Set environment variables
   - OPENAI_API_KEY
   - BITHOMP_API_KEY
   - DATABASE_URL

3. [ ] Test all scanners
   ```bash
   # Health check
   curl /api/scanners/health
   
   # Test collection scan
   curl -X POST /api/scanners/collection/scan
   
   # Test AI scoring
   curl -X POST /api/scanners/ai-scoring/collection/:id
   
   # Verify cron job
   # Check logs for "Rarity scanner cron job scheduled"
   ```

4. [ ] Verify RiddleCity saves
   - Create test city
   - Build structures
   - Check database records
   - Validate calculations

5. [ ] Deploy frontend components
   - Build production bundle
   - Test all pages
   - Verify API calls
   - Check responsive design

6. [ ] Monitor initial performance
   - Scanner execution times
   - Database query performance
   - API response times
   - Memory usage

---

## 📊 Success Metrics

- [ ] Scanners running without errors
- [ ] 3-hour cron job executing on schedule
- [ ] RiddleCity data persisting correctly
- [ ] Frontend components loading < 1s
- [ ] API responses < 500ms
- [ ] No memory leaks
- [ ] TypeScript compilation clean
- [ ] All tests passing

---

## 🎯 Priority Order

1. **HIGH PRIORITY**: Task 6 (RiddleCity Verification)
   - Critical for data integrity
   - Must verify before building frontend
   - Affects civilization scanner accuracy

2. **HIGH PRIORITY**: Task 7.1-7.6 (Core Components)
   - CivilizationDashboard
   - BattleStats
   - CityMetrics
   - EconomicOverview
   - CultureResearch
   - Leaderboard

3. **MEDIUM PRIORITY**: Task 7.7-7.8 (Additional Components)
   - NFTPowerCollection
   - ScoreBreakdownChart

4. **LOW PRIORITY**: Task 7.9-7.11 (Reusable Sub-Components)
   - PowerBar
   - StatCard
   - RankBadge

5. **OPTIONAL**: Additional Enhancements

---

**Current Status**: 5/7 tasks complete (71%)  
**Remaining**: RiddleCity verification + Frontend rebuild  
**Estimated Time**: 8-12 hours for remaining tasks
