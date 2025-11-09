# RiddleCity Material UI Upgrade & NFT Marketplace Fix - Master Plan

## Date: January 2025

---

## PHASE 1: NFT MARKETPLACE DATA PARSING REVIEW ✅

### Current State Analysis:
**parseCollectionFromAPI Function** (server/nft-marketplace-endpoints.ts)
- ✅ Properly extracts `name` from collection data
- ✅ Properly extracts `description` from collection data  
- ✅ Has fallback for known Riddle gaming collections (Inquiry, Inquisition, Dantes Aurum, Under the Bridge, etc.)
- ✅ Handles image URLs correctly (assets.image || assets.preview)
- ✅ Parses floor prices, owners, trading stats
- ⚠️ **Issue Found:** Returns `null` if final name extraction fails

### Improvements Needed:
1. **Never Return Null** - Always return a collection object with at least basic data
2. **Better Error Logging** - Track which parsing steps fail
3. **Metadata Validation** - Ensure name/description are strings and not objects

---

## PHASE 2: XRP PRIVATE KEY ACCESS IN NFT MARKETPLACE ⚠️

### Current Private Key Flow:

**Session Management** (server/riddle-wallet-auth.ts):
```typescript
// Keys stored in session.cachedKeys
{
  xrpPrivateKey: string,  // XRP seed/private key
  ethPrivateKey: string,  // Ethereum private key
  solPrivateKey: string,  // Solana private key
  btcPrivateKey: string   // Bitcoin private key (hex format)
}
```

**Key Access Pattern:**
```typescript
// Routes check: req.user.cachedKeys.xrpPrivateKey
// Then use: Wallet.fromSeed(cachedKeys.xrpPrivateKey)
```

### Issues Found:
1. **Session Expiry:** Private keys removed from cache after 30 minutes
2. **No Session Renewal:** No mechanism to re-request password for key decryption
3. **Error Messages:** Users not clearly told "Session expired - please re-authenticate"

### Fix Required:
✅ Add session renewal flow when `needsRenewal: true`
✅ Show password modal to decrypt keys on-demand
✅ Store keys in memory for transaction window (5-10 minutes)
✅ Clear instructions: "Enter password to sign transaction"

---

## PHASE 3: RIDDLECITY DATABASE SCHEMA 📊

### Current Tables (Need Enhancement):

#### **cities** (exists)
```sql
- id (serial primary key)
- user_handle (varchar, unique)
- city_name (varchar)
- city_description (text)
- city_image (text)
- land_plot_id (integer, nullable) -- Link to land NFTs
- plot_size (integer, default 1)
- credits (numeric, default 10000)
- materials (numeric, default 500)
- energy (numeric, default 1000)
- food (numeric, default 800)
- population (integer, default 0)
- population_capacity (integer, default 100)
- happiness (integer, default 75)
- total_buildings (integer, default 0)
- economic_value (numeric, default 0)
- defense_rating (integer, default 0)
- city_level (integer, default 1)
- experience_points (integer, default 0)
- linked_project_id (varchar, nullable) -- Link to partner projects
- contribute_to_project (boolean, default false)
- economy_share_percent (numeric, default 0.00)
- founded_at (timestamp)
- last_active (timestamp)
```

### NEW TABLES TO CREATE:

#### **building_types** (metadata)
```sql
CREATE TABLE building_types (
  id SERIAL PRIMARY KEY,
  building_code VARCHAR(50) UNIQUE NOT NULL,
  building_name VARCHAR(100) NOT NULL,
  building_category VARCHAR(50) NOT NULL, -- 'residential', 'economic', 'military', 'infrastructure', 'special'
  description TEXT,
  base_cost_credits NUMERIC DEFAULT 0,
  base_cost_materials NUMERIC DEFAULT 0,
  base_cost_energy NUMERIC DEFAULT 0,
  construction_time_seconds INTEGER DEFAULT 3600, -- 1 hour default
  population_capacity INTEGER DEFAULT 0,
  population_requirement INTEGER DEFAULT 0,
  happiness_impact INTEGER DEFAULT 0,
  defense_value INTEGER DEFAULT 0,
  production_rate JSONB, -- {'credits': 100, 'materials': 50, 'food': 25}
  maintenance_cost JSONB, -- {'credits': 10, 'energy': 5}
  upgrade_chain JSONB, -- ['small_house', 'large_house', 'mansion']
  required_buildings TEXT[], -- ['town_hall', 'market']
  city_level_requirement INTEGER DEFAULT 1,
  max_per_city INTEGER DEFAULT NULL, -- NULL = unlimited
  special_effects JSONB, -- {'boost_production': 1.1, 'reduce_costs': 0.9}
  image_url TEXT,
  icon_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **city_buildings** (instances)
```sql
CREATE TABLE city_buildings (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  building_type_id INTEGER NOT NULL REFERENCES building_types(id),
  building_level INTEGER DEFAULT 1,
  construction_status VARCHAR(20) DEFAULT 'building', -- 'building', 'active', 'damaged', 'destroyed'
  construction_started_at TIMESTAMP,
  construction_completed_at TIMESTAMP,
  last_collected_at TIMESTAMP, -- For production buildings
  health_points INTEGER DEFAULT 100,
  position_x INTEGER DEFAULT 0, -- Grid position for visual layout
  position_y INTEGER DEFAULT 0,
  custom_name VARCHAR(100),
  metadata JSONB, -- Extensible data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_city_buildings_city ON city_buildings(city_id);
CREATE INDEX idx_city_buildings_status ON city_buildings(construction_status);
```

#### **resource_production_log**
```sql
CREATE TABLE resource_production_log (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  building_id INTEGER REFERENCES city_buildings(id) ON DELETE SET NULL,
  resource_type VARCHAR(50) NOT NULL, -- 'credits', 'materials', 'energy', 'food'
  amount NUMERIC NOT NULL,
  production_type VARCHAR(50), -- 'building_production', 'quest_reward', 'trade', 'purchase'
  collected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_production_city ON resource_production_log(city_id);
CREATE INDEX idx_production_date ON resource_production_log(collected_at);
```

#### **city_surveys** (police system)
```sql
CREATE TABLE city_surveys (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  survey_type VARCHAR(50) NOT NULL, -- 'happiness_poll', 'resource_allocation', 'building_priority', 'policy_vote'
  survey_title VARCHAR(200) NOT NULL,
  survey_description TEXT,
  options JSONB NOT NULL, -- [{'id': 1, 'text': 'Build more houses', 'votes': 0}]
  results JSONB, -- Computed results
  created_by_handle VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  total_participants INTEGER DEFAULT 0,
  metadata JSONB
);

CREATE INDEX idx_surveys_city ON city_surveys(city_id);
CREATE INDEX idx_surveys_active ON city_surveys(is_active);
```

#### **survey_votes**
```sql
CREATE TABLE survey_votes (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES city_surveys(id) ON DELETE CASCADE,
  voter_handle VARCHAR(100) NOT NULL,
  selected_option_id INTEGER NOT NULL,
  vote_weight NUMERIC DEFAULT 1.0, -- Based on citizenship level or NFT holdings
  voted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(survey_id, voter_handle) -- One vote per person per survey
);

CREATE INDEX idx_votes_survey ON survey_votes(survey_id);
```

#### **city_policies** (enhanced)
```sql
CREATE TABLE city_policies (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  policy_code VARCHAR(50) NOT NULL,
  policy_name VARCHAR(100) NOT NULL,
  policy_category VARCHAR(50), -- 'economic', 'social', 'military', 'environmental'
  description TEXT,
  effects JSONB, -- {'production_boost': 1.2, 'happiness_penalty': -5}
  activation_cost JSONB, -- {'credits': 1000}
  maintenance_cost_per_day JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  enacted_at TIMESTAMP,
  expires_at TIMESTAMP,
  approved_by_survey_id INTEGER REFERENCES city_surveys(id),
  popularity_rating INTEGER DEFAULT 50, -- 0-100
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_policies_city ON city_policies(city_id);
CREATE INDEX idx_policies_active ON city_policies(is_active);
```

#### **city_defenses** (enhanced)
```sql
CREATE TABLE city_defenses (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  defense_type VARCHAR(50) NOT NULL, -- 'wall', 'tower', 'gate', 'guard', 'trap'
  defense_level INTEGER DEFAULT 1,
  defense_strength INTEGER DEFAULT 100,
  coverage_area INTEGER DEFAULT 10, -- Tiles covered
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  built_at TIMESTAMP DEFAULT NOW(),
  last_repaired_at TIMESTAMP,
  maintenance_cost_per_day JSONB
);

CREATE INDEX idx_defenses_city ON city_defenses(city_id);
```

#### **city_citizens** (enhanced population tracking)
```sql
CREATE TABLE city_citizens (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  citizen_name VARCHAR(100) NOT NULL,
  citizen_type VARCHAR(50) DEFAULT 'settler', -- 'settler', 'worker', 'soldier', 'merchant', 'scholar'
  profession VARCHAR(50), -- 'farmer', 'miner', 'guard', 'trader', 'builder'
  skill_level INTEGER DEFAULT 1,
  happiness INTEGER DEFAULT 75,
  productivity INTEGER DEFAULT 100,
  assigned_building_id INTEGER REFERENCES city_buildings(id),
  health_status VARCHAR(20) DEFAULT 'healthy', -- 'healthy', 'sick', 'injured'
  joined_city_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_citizens_city ON city_citizens(city_id);
CREATE INDEX idx_citizens_building ON city_citizens(assigned_building_id);
```

---

## PHASE 4: RIDDLECITY MATERIAL UI CONVERSION 🎨

### Current State:
- **File:** `client/src/pages/riddlecity-public-city.tsx`
- **Components Used:** shadcn/ui (Card, Button, Badge, etc.)
- **Sections:** Overview, Buildings, Economy, Defense

### Conversion Plan:

#### **1. Component Mapping:**
```
shadcn/ui → Material UI
-----------------------
Card → Card
CardHeader → CardHeader
CardContent → CardContent
CardTitle → Typography variant="h6"
Button → Button
Badge → Chip
Separator → Divider
```

#### **2. New Material UI Page Structure:**

**File:** `client/src/pages/riddlecity-material.tsx`

```typescript
import { 
  Box, Container, Grid, Card, CardContent, Typography, Button,
  Chip, Divider, Tabs, Tab, Paper, Avatar, LinearProgress,
  IconButton, Badge, Alert, Stack
} from '@mui/material';
```

#### **3. Key Features to Maintain:**
- City overview with resources (Credits, Materials, Energy, Food)
- Building list with construction status
- Shop/Economy section
- Defense structures
- Policy management
- Citizens display
- "Start Playing" buttons on EVERY section

#### **4. New "Start Playing" Buttons:**
Add prominent CTAs:
- **Overview Section:** "Start Building Your City"
- **Buildings Section:** "Construct New Building"
- **Economy Section:** "Open Trade Routes"
- **Defense Section:** "Fortify Your City"
- **Citizens Section:** "Recruit Citizens"
- **Policies Section:** "Create New Policy"

---

## PHASE 5: RIDDLECITY GAMEPLAY SYSTEMS 🎮

### Building System:
```typescript
// POST /api/riddlecity/building/construct
{
  cityId: number,
  buildingTypeCode: string,
  positionX: number,
  positionY: number
}

// POST /api/riddlecity/building/upgrade/:buildingId
{
  targetLevel: number
}

// POST /api/riddlecity/building/collect/:buildingId
// Collect production (credits, materials, etc.)

// POST /api/riddlecity/building/demolish/:buildingId
```

### Resource Management:
```typescript
// GET /api/riddlecity/resources/:cityId
// Returns current resource levels

// POST /api/riddlecity/resources/collect
// Collect from all production buildings

// POST /api/riddlecity/resources/transfer
{
  fromCityId: number,
  toCityId: number,
  resourceType: string,
  amount: number
}
```

### Survey/Police System:
```typescript
// POST /api/riddlecity/survey/create
{
  cityId: number,
  surveyType: string,
  title: string,
  description: string,
  options: [
    { id: 1, text: "Option 1" },
    { id: 2, text: "Option 2" }
  ],
  durationHours: number
}

// POST /api/riddlecity/survey/vote/:surveyId
{
  selectedOptionId: number
}

// GET /api/riddlecity/survey/results/:surveyId
```

### Building Type Seeding:
```typescript
// Residential Buildings
const residentialBuildings = [
  {
    code: 'small_house',
    name: 'Small House',
    category: 'residential',
    costCredits: 500,
    costMaterials: 100,
    constructionTime: 1800, // 30 minutes
    populationCapacity: 5,
    happinessImpact: 10
  },
  {
    code: 'apartment',
    name: 'Apartment Complex',
    category: 'residential',
    costCredits: 2000,
    costMaterials: 400,
    constructionTime: 3600, // 1 hour
    populationCapacity: 20,
    happinessImpact: 5
  },
  // ... more buildings
];

// Economic Buildings
const economicBuildings = [
  {
    code: 'farm',
    name: 'Farm',
    category: 'economic',
    costCredits: 800,
    costMaterials: 150,
    constructionTime: 2400, // 40 minutes
    productionRate: { food: 50 }, // Per hour
    maintenanceCost: { energy: 5 }
  },
  {
    code: 'mine',
    name: 'Mine',
    category: 'economic',
    costCredits: 1200,
    costMaterials: 200,
    constructionTime: 3600,
    productionRate: { materials: 30 },
    maintenanceCost: { energy: 10, food: 5 }
  },
  {
    code: 'marketplace',
    name: 'Marketplace',
    category: 'economic',
    costCredits: 3000,
    costMaterials: 500,
    constructionTime: 5400,
    productionRate: { credits: 100 },
    maintenanceCost: { energy: 15 }
  }
];

// Military Buildings
const militaryBuildings = [
  {
    code: 'watchtower',
    name: 'Watchtower',
    category: 'military',
    costCredits: 1500,
    costMaterials: 300,
    constructionTime: 3000,
    defenseValue: 20,
    maintenanceCost: { credits: 50, food: 10 }
  },
  {
    code: 'barracks',
    name: 'Barracks',
    category: 'military',
    costCredits: 2500,
    costMaterials: 400,
    constructionTime: 4200,
    defenseValue: 50,
    populationCapacity: 10, // Soldiers
    maintenanceCost: { credits: 100, food: 20 }
  }
];
```

---

## IMPLEMENTATION PRIORITY ORDER:

### ✅ **IMMEDIATE (Today)**
1. Fix NFT marketplace parseCollectionFromAPI to never return null
2. Add clear session renewal modal for XRP private key access
3. Create RiddleCity Material UI conversion (base structure)

### 🔧 **SHORT TERM (Next 2-3 Days)**
4. Create database migration for all new RiddleCity tables
5. Seed building_types table with 20+ building types
6. Build RiddleCity API endpoints (construct, upgrade, collect, demolish)
7. Add "Start Playing" buttons to all RiddleCity sections

### 🏗️ **MEDIUM TERM (Next Week)**
8. Implement Survey/Police system (create, vote, results)
9. Build Resource production and collection system
10. Add Citizens management system
11. Create Policy activation/deactivation system

### 🚀 **LONG TERM (Next 2 Weeks)**
12. Add defense combat system
13. Add trading system (city-to-city)
14. Add quest/mission system
15. Add leaderboards
16. Add city alliances

---

## SUCCESS METRICS:

### NFT Marketplace:
- ✅ 100% of collections display with name/description
- ✅ Zero "null collection" errors
- ✅ XRP private key access working with session renewal
- ✅ Clear error messages for authentication failures

### RiddleCity:
- ✅ All UI converted to Material UI
- ✅ "Start Playing" button on every section
- ✅ All database tables created with proper indexes
- ✅ Building construction working end-to-end
- ✅ Resource production and collection working
- ✅ Survey system allowing citizen voting
- ✅ Citizens can be recruited and assigned to buildings

---

## TESTING CHECKLIST:

### NFT Marketplace:
- [ ] Test parseCollectionFromAPI with various input formats
- [ ] Test session renewal flow when keys expire
- [ ] Test buy/sell with XRP key signing
- [ ] Test error messages for missing authentication

### RiddleCity:
- [ ] Create new city
- [ ] Construct building (verify timer, resource deduction)
- [ ] Upgrade building
- [ ] Collect production from building
- [ ] Create survey and vote
- [ ] Recruit citizens
- [ ] Activate policy
- [ ] Build defense structure
- [ ] Transfer resources between cities

---

**Status:** Plan Created - Ready for Implementation
**Estimated Total Time:** 2-3 weeks for full completion
**Risk Level:** Medium (database changes, complex game logic)
**Dependencies:** PostgreSQL, Material UI, Session management

