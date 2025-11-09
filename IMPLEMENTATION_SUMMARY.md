# NFT Marketplace & RiddleCity Comprehensive Upgrade
## Implementation Summary - January 2025

---

## ✅ COMPLETED WORK

### 1. NFT Marketplace Data Parsing Fixed

**File Modified:** `server/nft-marketplace-endpoints.ts`

**Problem:** `parseCollectionFromAPI()` could return `null` when name extraction failed, causing frontend crashes.

**Solution Implemented:**
```typescript
// BEFORE (could return null):
if (!name) {
  console.log(`⚠️ Final fallback failed`);
  return null; // ❌ CRASH RISK
}

// AFTER (guaranteed valid return):
if (!name || name.trim() === '') {
  const collectionId = collection.collection || 'unknown';
  const parts = collectionId.split(':');
  if (parts.length === 2) {
    name = `Collection ${parts[1]}`; // Use taxon
  } else {
    name = `NFT Collection ${collectionId.slice(-8)}`; // Last 8 chars
  }
}

// Validate description is a string
if (description && typeof description !== 'string') {
  description = '';
}

return {
  name: name.trim(), // ✅ GUARANTEED value
  description: description || '', // ✅ GUARANTEED string
  // ... rest of data
};
```

**Benefits:**
- ✅ Zero "null collection" errors
- ✅ All NFT collections display with at least basic info
- ✅ Better error logging for debugging
- ✅ Description validation prevents object/array display bugs

---

## 📋 MASTER PLAN CREATED

**File:** `RIDDLECITY_MASTER_PLAN.md`

### Comprehensive 6-Phase Plan:

1. **Phase 1:** NFT Marketplace Data Parsing ✅ **DONE**
2. **Phase 2:** XRP Private Key Session Management ⏳ **PLANNED**
3. **Phase 3:** RiddleCity Database Schema 📊 **DESIGNED**
4. **Phase 4:** RiddleCity Material UI Conversion 🎨 **READY TO BUILD**
5. **Phase 5:** RiddleCity Gameplay Systems 🎮 **DOCUMENTED**
6. **Phase 6:** Advanced Features (Combat, Trading, Quests) 🚀 **ROADMAP**

---

## 🔑 XRP PRIVATE KEY SESSION MANAGEMENT

### Current State Analysis:

**Where Keys Are Stored:**
```typescript
// Server session (server/riddle-wallet-auth.ts)
req.session.cachedKeys = {
  xrpPrivateKey: string,  // XRP seed
  ethPrivateKey: string,  // ETH key
  solPrivateKey: string,  // SOL key
  btcPrivateKey: string   // BTC key (hex)
};
```

**How Keys Are Used:**
```typescript
// NFT marketplace, XRPL transactions
const wallet = Wallet.fromSeed(cachedKeys.xrpPrivateKey);
const signed = wallet.sign(tx);
```

**Session Flow:**
1. User logs in with password
2. Server decrypts `encryptedPrivateKeys` from database
3. Keys cached in session (memory)
4. **Session expires after 30 minutes** ⏰
5. Keys removed from memory for security
6. User needs to re-authenticate

### Issues Identified:

❌ **Problem 1:** No clear "Session Expired" message
❌ **Problem 2:** No password re-entry modal
❌ **Problem 3:** Users confused why transactions fail
❌ **Problem 4:** Have to fully logout/login to refresh keys

### Solution Design:

**Add Session Renewal Flow:**

```typescript
// Backend checks if keys exist
if (!req.session.cachedKeys?.xrpPrivateKey) {
  return res.status(401).json({
    success: false,
    needsRenewal: true,
    message: "Session expired. Please re-enter your password to continue."
  });
}
```

**Frontend Modal:**
```typescript
// When needsRenewal: true
<Dialog open={showRenewalModal}>
  <DialogTitle>Session Renewal Required</DialogTitle>
  <DialogContent>
    <Typography>
      For security, your session has expired. 
      Please enter your password to continue.
    </Typography>
    <TextField
      type="password"
      label="Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={handleRenewSession}>
      Renew Session
    </Button>
  </DialogActions>
</Dialog>
```

**Renewal Endpoint:**
```typescript
// POST /api/riddle-wallet/renew-session
router.post('/renew-session', async (req, res) => {
  const { password } = req.body;
  const handle = req.session.handle;
  
  // Re-decrypt private keys
  const keys = await decryptPrivateKeys(handle, password);
  
  // Store in session again
  req.session.cachedKeys = keys;
  req.session.lastRenewal = new Date();
  
  res.json({ success: true, message: "Session renewed" });
});
```

---

## 🏗️ RIDDLECITY DATABASE SCHEMA

### New Tables Designed (8 Total):

#### 1. **building_types** (Metadata)
- Defines all available building types (houses, farms, mines, etc.)
- Stores costs, production rates, requirements
- 20+ building types ready to seed

#### 2. **city_buildings** (Instances)
- Each building a user constructs
- Tracks construction status, level, health, position
- Links to building_types for stats

#### 3. **resource_production_log**
- Logs all resource gains (credits, materials, food, energy)
- Tracks which building produced what
- Enables production history and analytics

#### 4. **city_surveys** (Police/Voting System)
- Create surveys/polls for citizens
- Types: happiness_poll, resource_allocation, building_priority, policy_vote
- Time-limited with results calculation

#### 5. **survey_votes**
- One vote per citizen per survey
- Vote weighting based on citizenship level or NFT holdings
- Prevents duplicate voting

#### 6. **city_policies** (Enhanced)
- Economic, social, military, environmental policies
- Effects: production boosts, happiness modifiers, cost reductions
- Can be enacted via survey approval

#### 7. **city_defenses** (Enhanced)
- Walls, towers, gates, guards, traps
- Coverage area, position, strength tracking
- Maintenance costs

#### 8. **city_citizens** (Enhanced)
- Individual citizen tracking
- Professions: farmer, miner, guard, trader, builder, scholar
- Skill levels, happiness, productivity, health status
- Assign citizens to buildings for bonuses

### Example Building Types:

**Residential:**
- Small House (5 capacity, 500 credits, 30 min)
- Apartment (20 capacity, 2000 credits, 1 hr)
- Mansion (50 capacity, 10000 credits, 3 hrs)

**Economic:**
- Farm (produces 50 food/hr, costs 800 credits)
- Mine (produces 30 materials/hr, costs 1200 credits)
- Marketplace (produces 100 credits/hr, costs 3000 credits)
- Bank (produces 200 credits/hr, costs 5000 credits)

**Military:**
- Watchtower (20 defense, costs 1500 credits)
- Barracks (50 defense + train soldiers, costs 2500 credits)
- Walls (100 defense, costs 5000 credits)

**Infrastructure:**
- Power Plant (produces 100 energy/hr, costs 3000 credits)
- Water Treatment (required for large cities, costs 2000 credits)
- Road Network (speeds up construction, costs 1500 credits)

---

## 🎨 RIDDLECITY MATERIAL UI CONVERSION

### Current State:
- **File:** `client/src/pages/riddlecity-public-city.tsx`
- **UI Library:** shadcn/ui (Card, Button, Badge)
- **Lines:** 606 lines
- **Sections:** Overview, Buildings, Economy, Defense

### Conversion Strategy:

**Component Mapping:**
```
shadcn/ui          →  Material UI
-----------------------------------
Card               →  Card
CardHeader         →  CardHeader
CardContent        →  CardContent
CardTitle          →  Typography variant="h6"
Button             →  Button
Badge              →  Chip
Separator          →  Divider
lucide-react icons →  @mui/icons-material
```

**New File:** `client/src/pages/riddlecity-material.tsx`

**Key Enhancements:**
1. ✅ Full Material UI components
2. ✅ Responsive Grid layout
3. ✅ "Start Playing" button on EVERY section
4. ✅ Progress bars for construction timers
5. ✅ Resource displays with icons
6. ✅ Building cards with images
7. ✅ Survey/voting interface
8. ✅ Citizen management panel

**"Start Playing" Button Locations:**
- Overview Section: "Start Building Your City"
- Buildings Section: "Construct New Building"
- Economy Section: "Open Trade Routes" 
- Defense Section: "Fortify Your City"
- Citizens Section: "Recruit Citizens"
- Policies Section: "Create New Policy"
- Surveys Section: "Create New Survey"

---

## 🎮 RIDDLECITY GAMEPLAY SYSTEMS

### API Endpoints to Build:

#### Building Management:
```
POST   /api/riddlecity/building/construct
POST   /api/riddlecity/building/upgrade/:buildingId
POST   /api/riddlecity/building/collect/:buildingId
POST   /api/riddlecity/building/demolish/:buildingId
GET    /api/riddlecity/building/types
GET    /api/riddlecity/building/queue/:cityId
```

#### Resource Management:
```
GET    /api/riddlecity/resources/:cityId
POST   /api/riddlecity/resources/collect-all
POST   /api/riddlecity/resources/transfer
GET    /api/riddlecity/resources/production-log/:cityId
```

#### Survey/Police System:
```
POST   /api/riddlecity/survey/create
POST   /api/riddlecity/survey/vote/:surveyId
GET    /api/riddlecity/survey/active/:cityId
GET    /api/riddlecity/survey/results/:surveyId
POST   /api/riddlecity/survey/close/:surveyId
```

#### Citizens:
```
POST   /api/riddlecity/citizens/recruit
POST   /api/riddlecity/citizens/assign/:citizenId
GET    /api/riddlecity/citizens/list/:cityId
POST   /api/riddlecity/citizens/train/:citizenId
```

#### Policies:
```
POST   /api/riddlecity/policy/activate
POST   /api/riddlecity/policy/deactivate/:policyId
GET    /api/riddlecity/policy/available/:cityId
GET    /api/riddlecity/policy/active/:cityId
```

### Game Logic Examples:

**Building Construction:**
```typescript
async function constructBuilding(cityId, buildingTypeCode, positionX, positionY) {
  // 1. Get building type from database
  const buildingType = await getBuildingType(buildingTypeCode);
  
  // 2. Check city has enough resources
  const city = await getCity(cityId);
  if (city.credits < buildingType.baseCostCredits) {
    throw new Error("Not enough credits");
  }
  if (city.materials < buildingType.baseCostMaterials) {
    throw new Error("Not enough materials");
  }
  
  // 3. Check requirements (city level, other buildings)
  if (city.cityLevel < buildingType.cityLevelRequirement) {
    throw new Error("City level too low");
  }
  
  // 4. Deduct resources
  await updateCityResources(cityId, {
    credits: -buildingType.baseCostCredits,
    materials: -buildingType.baseCostMaterials
  });
  
  // 5. Create building record
  const completionTime = new Date(Date.now() + buildingType.constructionTimeSeconds * 1000);
  
  const building = await insertBuilding({
    cityId,
    buildingTypeId: buildingType.id,
    constructionStatus: 'building',
    constructionStartedAt: new Date(),
    constructionCompletedAt: completionTime,
    positionX,
    positionY
  });
  
  // 6. Return building with timer
  return {
    success: true,
    building,
    completesIn: buildingType.constructionTimeSeconds
  };
}
```

**Resource Collection:**
```typescript
async function collectProduction(buildingId) {
  // 1. Get building and type
  const building = await getBuilding(buildingId);
  const buildingType = await getBuildingType(building.buildingTypeId);
  
  // 2. Check building is active
  if (building.constructionStatus !== 'active') {
    throw new Error("Building not yet active");
  }
  
  // 3. Calculate time since last collection
  const lastCollected = building.lastCollectedAt || building.constructionCompletedAt;
  const hoursSince = (Date.now() - lastCollected.getTime()) / (1000 * 60 * 60);
  
  // 4. Calculate production
  const productionRate = buildingType.productionRate; // {credits: 100, materials: 50}
  const produced = {};
  for (const [resource, rate] of Object.entries(productionRate)) {
    produced[resource] = Math.floor(rate * hoursSince);
  }
  
  // 5. Add resources to city
  await updateCityResources(building.cityId, produced);
  
  // 6. Update last collected timestamp
  await updateBuilding(buildingId, {
    lastCollectedAt: new Date()
  });
  
  // 7. Log production
  for (const [resource, amount] of Object.entries(produced)) {
    await logProduction({
      cityId: building.cityId,
      buildingId,
      resourceType: resource,
      amount,
      productionType: 'building_production'
    });
  }
  
  return {
    success: true,
    collected: produced
  };
}
```

---

## 📊 DATABASE MIGRATION SCRIPT

**File to Create:** `server/db/migrations/005_riddlecity_full_system.sql`

```sql
-- Building Types Metadata
CREATE TABLE IF NOT EXISTS building_types (
  id SERIAL PRIMARY KEY,
  building_code VARCHAR(50) UNIQUE NOT NULL,
  building_name VARCHAR(100) NOT NULL,
  building_category VARCHAR(50) NOT NULL,
  description TEXT,
  base_cost_credits NUMERIC DEFAULT 0,
  base_cost_materials NUMERIC DEFAULT 0,
  base_cost_energy NUMERIC DEFAULT 0,
  construction_time_seconds INTEGER DEFAULT 3600,
  population_capacity INTEGER DEFAULT 0,
  population_requirement INTEGER DEFAULT 0,
  happiness_impact INTEGER DEFAULT 0,
  defense_value INTEGER DEFAULT 0,
  production_rate JSONB,
  maintenance_cost JSONB,
  upgrade_chain JSONB,
  required_buildings TEXT[],
  city_level_requirement INTEGER DEFAULT 1,
  max_per_city INTEGER DEFAULT NULL,
  special_effects JSONB,
  image_url TEXT,
  icon_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_building_types_code ON building_types(building_code);
CREATE INDEX idx_building_types_category ON building_types(building_category);

-- City Buildings Instances
CREATE TABLE IF NOT EXISTS city_buildings (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  building_type_id INTEGER NOT NULL REFERENCES building_types(id),
  building_level INTEGER DEFAULT 1,
  construction_status VARCHAR(20) DEFAULT 'building',
  construction_started_at TIMESTAMP,
  construction_completed_at TIMESTAMP,
  last_collected_at TIMESTAMP,
  health_points INTEGER DEFAULT 100,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  custom_name VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_city_buildings_city ON city_buildings(city_id);
CREATE INDEX idx_city_buildings_status ON city_buildings(construction_status);
CREATE INDEX idx_city_buildings_type ON city_buildings(building_type_id);

-- Resource Production Log
CREATE TABLE IF NOT EXISTS resource_production_log (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  building_id INTEGER REFERENCES city_buildings(id) ON DELETE SET NULL,
  resource_type VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  production_type VARCHAR(50),
  collected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_production_city ON resource_production_log(city_id);
CREATE INDEX idx_production_date ON resource_production_log(collected_at);
CREATE INDEX idx_production_type ON resource_production_log(resource_type);

-- City Surveys
CREATE TABLE IF NOT EXISTS city_surveys (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  survey_type VARCHAR(50) NOT NULL,
  survey_title VARCHAR(200) NOT NULL,
  survey_description TEXT,
  options JSONB NOT NULL,
  results JSONB,
  created_by_handle VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  total_participants INTEGER DEFAULT 0,
  metadata JSONB
);

CREATE INDEX idx_surveys_city ON city_surveys(city_id);
CREATE INDEX idx_surveys_active ON city_surveys(is_active);
CREATE INDEX idx_surveys_type ON city_surveys(survey_type);

-- Survey Votes
CREATE TABLE IF NOT EXISTS survey_votes (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES city_surveys(id) ON DELETE CASCADE,
  voter_handle VARCHAR(100) NOT NULL,
  selected_option_id INTEGER NOT NULL,
  vote_weight NUMERIC DEFAULT 1.0,
  voted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(survey_id, voter_handle)
);

CREATE INDEX idx_votes_survey ON survey_votes(survey_id);
CREATE INDEX idx_votes_voter ON survey_votes(voter_handle);

-- City Citizens
CREATE TABLE IF NOT EXISTS city_citizens (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  citizen_name VARCHAR(100) NOT NULL,
  citizen_type VARCHAR(50) DEFAULT 'settler',
  profession VARCHAR(50),
  skill_level INTEGER DEFAULT 1,
  happiness INTEGER DEFAULT 75,
  productivity INTEGER DEFAULT 100,
  assigned_building_id INTEGER REFERENCES city_buildings(id),
  health_status VARCHAR(20) DEFAULT 'healthy',
  joined_city_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_citizens_city ON city_citizens(city_id);
CREATE INDEX idx_citizens_building ON city_citizens(assigned_building_id);
CREATE INDEX idx_citizens_type ON city_citizens(citizen_type);
```

---

## 🚀 NEXT STEPS (IMPLEMENTATION ORDER)

### ✅ **COMPLETED**
1. Fixed NFT marketplace parseCollectionFromAPI (never returns null)
2. Created comprehensive master plan document
3. Designed complete database schema
4. Documented all API endpoints needed

### 🔧 **IMMEDIATE (Next Session)**
1. Create session renewal modal component
2. Add XRP key renewal endpoint
3. Test session expiry and renewal flow
4. Start RiddleCity Material UI conversion

### 🏗️ **SHORT TERM (Next 2 Days)**
1. Run database migration script
2. Seed building_types table with 20+ buildings
3. Build building construction API endpoint
4. Build resource collection API endpoint
5. Add "Start Playing" buttons to all sections

### 🎮 **MEDIUM TERM (Next Week)**
1. Implement survey creation and voting
2. Add citizen recruitment system
3. Add policy activation system
4. Build production timers and collection UI

---

## 📈 PROGRESS TRACKING

| Task | Status | Priority | Est. Time |
|------|--------|----------|-----------|
| NFT Parser Fix | ✅ Done | High | 30 min |
| Master Plan | ✅ Done | High | 2 hrs |
| XRP Key Renewal | ⏳ TODO | High | 2 hrs |
| Material UI Conversion | ⏳ TODO | High | 4 hrs |
| Database Migration | ⏳ TODO | High | 1 hr |
| Building System API | ⏳ TODO | High | 6 hrs |
| Survey System | ⏳ TODO | Medium | 4 hrs |
| Citizen System | ⏳ TODO | Medium | 3 hrs |
| Policy System | ⏳ TODO | Low | 2 hrs |

**Total Estimated Time:** 24-26 hours
**Completion Target:** 3-4 working days

---

**Status:** Phase 1 Complete, Plan Finalized
**Last Updated:** January 2025
**Next Review:** After Phase 2 (XRP Key Renewal) completion
