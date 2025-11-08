# 🎮 The Trolls Inquisition - Complete NFT Gaming System

## 🎯 System Overview

A comprehensive NFT gaming platform featuring 4 themed XRPL collections with power-based gameplay, special badges, and AI integration.

### **Collections:**
1. **Under the Bridge** (Taxon 9) - Bankers 💰 → +50% Economic Power
2. **The Inquiry** (Taxon 1) - Gods ✨ → +80% Religion, +30% Civilization  
3. **Dantes Aurum** (Taxon 3) - Sacred Relics ⛪ → +50% Religion Power
4. **The Lost Emporium** (Taxon 2) - Weapons ⚔️ → +50% Army Power

**Issuer Address:** `rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH`

---

## 🚀 Quick Start - Complete Setup

### **Step 1: Ingest All NFT Data**

```bash
curl -X POST http://localhost:5000/api/nft-ingestion/full-setup
```

This will:
1. Fetch all NFTs from Bithomp API
2. Import into `gaming_nfts` table
3. Scan traits and calculate power levels
4. Apply thematic power boosts

**Expected Response:**
```json
{
  "success": true,
  "message": "Full NFT system setup complete!",
  "ingestion": {
    "total_collections": 4,
    "total_nfts_fetched": 200,
    "total_nfts_imported": 200
  },
  "scanning": {
    "collections_scanned": 4,
    "total_nfts_scanned": 200
  }
}
```

### **Step 2: Verify Collections**

```bash
# Check status
curl http://localhost:5000/api/nft-ingestion/status

# Get stats
curl http://localhost:5000/api/collections/themed/stats
```

---

## 📡 API Endpoints

### **NFT Ingestion**

```http
# Ingest all collections (includes scanning)
POST /api/nft-ingestion/full-setup

# Ingest specific collection
POST /api/nft-ingestion/ingest/under-the-bridge
POST /api/nft-ingestion/ingest/the-inquiry
POST /api/nft-ingestion/ingest/dantes-aurum
POST /api/nft-ingestion/ingest/the-lost-emporium

# Check ingestion status
GET /api/nft-ingestion/status

# Preview NFTs without importing
GET /api/nft-ingestion/preview/{issuer}/{taxon}
```

### **Collection Scanner**

```http
# Get themed collections
GET /api/collections/themed

# Scan all collections (apply power boosts)
POST /api/collections/themed/scan-all

# Get collection stats
GET /api/collections/themed/stats

# Verify specific collection
GET /api/collections/themed/verify/under-the-bridge-riddle
GET /api/collections/themed/verify/the-inquiry
GET /api/collections/themed/verify/dantesaurum
GET /api/collections/themed/verify/the-lost-emporium
```

### **Badge System**

```http
# Get all available badges
GET /api/badges

# Get specific badge
GET /api/badges/{badgeId}

# Get user's earned badges
GET /api/badges/user/{userHandle}
```

**Badge Examples:**
- `banker_initiate` - Own 1+ Under the Bridge NFT
- `divine_disciple` - Own 1+ Inquiry NFT
- `master_banker` - Own 5+ Under the Bridge NFTs
- `god_touched` - Own 10+ Inquiry NFTs with 2000+ Religion Power
- `grand_collector` - Own NFTs from all 4 collections
- `ultimate_collector` - Own 10+ from all 4 collections

### **Game AI Assistant**

```http
# Chat with The Oracle
POST /api/game-ai/chat
{
  "message": "What should I do first?",
  "context": {
    "playerName": "TheLegend",
    "currentPower": 500,
    "ownedCollections": ["Under the Bridge", "The Inquiry"]
  }
}

# Generate voice narration
POST /api/game-ai/narrate
{
  "text": "Welcome to The Trolls Inquisition!",
  "voice": "fable"
}

# Get game tip
GET /api/game-ai/tip/combat
GET /api/game-ai/tip/collection
GET /api/game-ai/tip/trading
GET /api/game-ai/tip/power

# Generate battle narration
POST /api/game-ai/battle-narration
{
  "attacker": "TheLegend",
  "defender": "DarkKnight",
  "outcome": "victory"
}

# Welcome new player
POST /api/game-ai/welcome
{
  "playerName": "NewPlayer123"
}
```

---

## 🎨 Power Calculation System

### **Base Power Formula**

For each NFT:
1. **Keyword Detection**: Scan traits for power keywords
2. **Material Multiplier**: wood=1x, gold=5x, diamond=10x, etc.
3. **Rarity Multiplier**: common=1x, epic=3x, legendary=5x
4. **Base Score**: 10 points per keyword × material × rarity

### **Thematic Boosts**

After base calculation, collection theme multipliers apply:

| Collection | Theme | Power Boost |
|-----------|-------|-------------|
| Under the Bridge | Bankers | Economic ×1.5 |
| The Inquiry | Gods | Religion ×1.8, Civilization ×1.3 |
| Dantes Aurum | Sacred | Religion ×1.5 |
| The Lost Emporium | Weapons | Army ×1.5 |

### **Example Calculation**

**NFT:** "Divine Golden Sword" (Epic rarity)
- **Keywords:** sword (army), divine (religion), golden (economic)
- **Material:** Gold (5x multiplier)
- **Rarity:** Epic (3x multiplier)

**Base Power:**
- Army: 10 × 5 × 3 = 150
- Religion: 10 × 5 × 3 = 150  
- Economic: 10 × 5 × 3 = 150
- Civilization: 25 (base)

**If in Lost Emporium (Weapon theme):**
- Army: 150 × 1.5 = **225** ⚔️
- Religion: 150
- Economic: 150
- Civilization: 25
- **Total: 550**

---

## 🏅 Badge System

### **Badge Tiers**

- **Common** (🏦) - Own 1+ NFTs from a collection
- **Uncommon** (✨) - Own 1+ from special collections
- **Rare** (💰/🛡️) - Own 5+ from a collection
- **Epic** (🔮/🏆) - Cross-collection achievements
- **Legendary** (👑/⚡) - 10+ NFTs with high power

### **Special Badges**

**Financial Titan** 👑
- Requirements: 10+ Under the Bridge NFTs + 1000+ Economic Power
- Rarity: Legendary
- Color: Gold (#FFD700)

**God-Touched** ⚡
- Requirements: 10+ Inquiry NFTs + 2000+ Religion Power
- Rarity: Legendary  
- Color: Purple (#9B59B6)

**Supreme Warlord** ⚡
- Requirements: 10+ Lost Emporium NFTs + 1500+ Army Power
- Rarity: Legendary
- Color: Silver (#C0C0C0)

**Ultimate Collector** 👑
- Requirements: 10+ NFTs from ALL 4 collections
- Rarity: Legendary
- Color: Gold (#FFD700)

### **Implementing Badges in Profile**

```typescript
// Fetch user badges
const response = await fetch(`/api/badges/user/${userHandle}`);
const { badges } = await response.json();

// Display badges
badges.forEach(badge => {
  console.log(`${badge.icon} ${badge.name} - ${badge.description}`);
});
```

---

## 🤖 Talking AI Integration

### **The Oracle Character**

An ancient, wise AI guide with:
- Medieval/fantasy personality
- Knowledge of all 4 collections
- References 4 power types (Army, Religion, Civilization, Economic)
- Strategic gameplay guidance
- Player achievement celebration

### **Chat Integration**

```javascript
// Player asks question
const response = await fetch('/api/game-ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "How do I increase my power?",
    context: {
      playerName: "TheLegend",
      currentPower: 500,
      ownedCollections: ["Under the Bridge"]
    }
  })
});

const { response: aiResponse } = await response.json();
console.log(aiResponse.text);
// "Greetings TheLegend! To grow your power, diversify your collection..."
```

### **Voice Narration**

```javascript
// Generate battle narration with voice
const narration = await fetch('/api/game-ai/battle-narration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    attacker: "TheLegend",
    defender: "DarkKnight",
    outcome: "victory"
  })
});

const { narration: battleText } = await narration.json();

// Convert to voice
const voice = await fetch('/api/game-ai/narrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: battleText.text,
    voice: "fable" // Epic medieval voice
  })
});

const { audio_url } = await voice.json();
// Play audio_url in game
```

---

## 📊 Character Classes

NFTs are assigned character classes based on power distribution:

| Class | Requirements | Icon |
|-------|-------------|------|
| **Warrior** | High Army power (>30%) | ⚔️ |
| **Priest** | High Religion power (>30%) | ⛪ |
| **Merchant** | High Economic power (>30%) | 💰 |
| **Lord** | High Civilization power (>30%) | 🏰 |
| **Knight** | Army + Civilization | 🛡️ |
| **Sage** | Religion + Civilization | 📿 |
| **Paladin** | Army + Religion | ✨ |
| **Templar** | Economic + Religion | 💎 |
| **Mercenary** | Army + Economic | 🗡️ |
| **Champion** | Balanced (≥70% balance score) | 👑 |

---

## 🎮 Integration Examples

### **Profile Page with Badges**

```jsx
function PlayerProfile({ userHandle }) {
  const [badges, setBadges] = useState([]);
  
  useEffect(() => {
    fetch(`/api/badges/user/${userHandle}`)
      .then(r => r.json())
      .then(data => setBadges(data.badges));
  }, [userHandle]);
  
  return (
    <div className="profile">
      <h2>{userHandle}</h2>
      <div className="badges">
        {badges.map(badge => (
          <div key={badge.id} className="badge" style={{ color: badge.color }}>
            <span className="icon">{badge.icon}</span>
            <span className="name">{badge.name}</span>
            <span className="rarity">{badge.rarity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### **AI Chat Component**

```jsx
function OracleChat({ player }) {
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState([]);
  
  async function sendMessage() {
    const res = await fetch('/api/game-ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: {
          playerName: player.name,
          currentPower: player.total_power,
          ownedCollections: player.collections
        }
      })
    });
    
    const { response } = await res.json();
    setResponses([...responses, { user: message, oracle: response.text }]);
    setMessage('');
  }
  
  return (
    <div className="oracle-chat">
      <div className="messages">
        {responses.map((r, i) => (
          <div key={i}>
            <p><strong>You:</strong> {r.user}</p>
            <p><strong>The Oracle:</strong> {r.oracle}</p>
          </div>
        ))}
      </div>
      <input value={message} onChange={e => setMessage(e.target.value)} />
      <button onClick={sendMessage}>Ask The Oracle</button>
    </div>
  );
}
```

---

## 🔧 Troubleshooting

### **No NFTs Found**

**Issue:** `nfts_fetched: 0`

**Solution:**
1. Verify issuer address: `rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH`
2. Check Bithomp API key is configured: `BITHOMP_API_KEY`
3. Preview NFTs first: `GET /api/nft-ingestion/preview/rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH/9`

### **Power Levels Seem Wrong**

**Issue:** NFTs have unexpected power values

**Solution:**
1. Check NFT traits are populated in database
2. Re-run scanner: `POST /api/collections/themed/scan-all`
3. Verify collection themes match expectations
4. Check material/rarity detection in logs

### **Badges Not Showing**

**Issue:** User has NFTs but no badges

**Solution:**
1. Verify NFTs are in `gaming_nfts` table
2. Check `nft_power_attributes` table has power data
3. Ensure `owner_address` matches player's `wallet_address`
4. Re-scan collections if needed

### **AI Not Responding**

**Issue:** AI chat returns errors

**Solution:**
1. Verify `OPENAI_API_KEY` environment variable is set
2. Check OpenAI API quota/credits
3. Review error logs for specific issues

---

## 📚 Database Schema

### **gaming_nft_collections**
- `id` - UUID
- `collection_id` - Issuer:Taxon format
- `collection_name` - Display name
- `taxon` - XRPL taxon number
- `game_role` - merchant, army, power
- `metadata_ingested` - Boolean flag

### **gaming_nfts**
- `id` - UUID
- `collection_id` - FK to collections
- `nft_id` - Full XRPL NFT identifier
- `owner_address` - Current owner
- `metadata` - JSONB (name, description, image, attributes)
- `traits` - JSONB (trait_type → value mapping)

### **nft_power_attributes**
- `nft_id` - FK to gaming_nfts
- `army_power` - Integer
- `religion_power` - Integer
- `civilization_power` - Integer
- `economic_power` - Integer
- `total_power` - Integer
- `character_class` - String
- `special_powers` - JSONB array
- `materials_found` - JSONB array
- `rarities_found` - JSONB array
- `keywords_detected` - JSONB object

---

## 🎯 Next Steps

1. **Test the full setup**:
   ```bash
   curl -X POST http://localhost:5000/api/nft-ingestion/full-setup
   ```

2. **Verify all collections loaded**:
   ```bash
   curl http://localhost:5000/api/collections/themed/stats
   ```

3. **Check badge system**:
   ```bash
   curl http://localhost:5000/api/badges
   ```

4. **Test AI integration**:
   ```bash
   curl -X POST http://localhost:5000/api/game-ai/welcome \
     -H "Content-Type: application/json" \
     -d '{"playerName": "TestPlayer"}'
   ```

5. **Integrate into frontend**:
   - Add badge display to profile pages
   - Integrate AI chat component
   - Show NFT power levels and character classes
   - Add voice narration to battles

---

## ✨ Features Summary

✅ **4 Themed Collections** with unique power boosts  
✅ **Automatic NFT Ingestion** from Bithomp API  
✅ **Trait-Based Power Calculation** with material/rarity multipliers  
✅ **Character Class System** (10 different classes)  
✅ **16 Special Badges** across 5 rarity tiers  
✅ **Talking AI Integration** (The Oracle)  
✅ **Voice Narration** for battles and events  
✅ **Comprehensive API** for all game features  

**Total API Endpoints:** 1301+ routes  
**Collections:** 4 themed XRPL collections  
**Power Types:** 4 (Army, Religion, Civilization, Economic)  
**Character Classes:** 10 unique classes  
**Badges:** 16 special achievement badges  

---

🎮 **Ready to Play!** All systems are operational and waiting for NFT data to be ingested!
