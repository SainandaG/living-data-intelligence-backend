# 🎨 Hierarchical Circle Packing & Historical Flow Animation

## 🌟 New Feature Added!

Your platform now includes **hierarchical circle packing visualization** with **historical data flow animation** - exactly like the reference image you shared!

![Reference Image](file:///C:/Users/sai%20nanda%20G/.gemini/antigravity/brain/d8e5598d-14f2-4c30-a2ee-c523f052e7ad/uploaded_image_1766041162101.png)

---

## ✨ What's New

### 1. **Hierarchical Circle Packing**
When you click on a node and then click "📊 View Flow":
- **Main Circle** - The selected table (center)
- **Child Circles** - Columns and related tables
- **Nested Layout** - Similar to your reference image
- **Color-Coded** - Different colors for different types

### 2. **Historical Flow Animation**
- **Timeline Slider** - Scrub through 24 hours of data
- **Play/Pause Controls** - Watch flow animate automatically
- **Timestamp Display** - See exact time and volume
- **Particle Animation** - Visualize data flowing in real-time

### 3. **Flow Particles**
- 🟢 **Green** - Normal transactions
- 🟡 **Yellow** - Warning level
- 🔴 **Red** - Fraud/Critical
- Particles flow outward from the center showing data movement

---

## 🎮 How to Use

### Step 1: Connect to Database
```bash
python main.py
# Open http://localhost:8000
# Click "Connect Database"
```

### Step 2: Click on Any Node
- Click any table node in the 3D graph
- Drill-down panel opens on the right

### Step 3: View Hierarchical Flow
- Click **"📊 View Flow"** button (top-right of drill-down panel)
- See circle packing visualization appear
- Timeline controls appear at bottom

### Step 4: Explore Historical Data
- **Drag slider** to see different time periods
- **Click ▶ Play** to animate automatically
- **Watch particles** flow from center outward
- **See volume** change over time

---

## 📊 What You'll See

### Circle Packing Layout
```
┌─────────────────────────────────┐
│     Related Tables (Pink)       │
│   ┌───────────────────────┐     │
│   │   Main Table (Cyan)   │     │
│   │  ┌─────────────────┐  │     │
│   │  │    Columns      │  │     │
│   │  │   (Purple)      │  │     │
│   │  └─────────────────┘  │     │
│   └───────────────────────┘     │
└─────────────────────────────────┘
```

### Timeline Controls
```
┌──────────────────────────────────┐
│ Historical Flow                  │
├──────────────────────────────────┤
│ [====●================] Slider   │
│ 2025-12-18 10:30 - Volume: 450  │
│                                  │
│ [▶ Play] [⏸ Pause] [⏮ Reset]   │
└──────────────────────────────────┘
```

---

## 🎯 Features

### Hierarchical Visualization
✅ **Circle Packing** - Nested circles showing relationships  
✅ **Entity Colors** - Distinct colors per type  
✅ **Labels** - Table and column names displayed  
✅ **Connections** - Lines showing relationships  

### Historical Flow
✅ **24-Hour Timeline** - Full day of data  
✅ **5-Minute Intervals** - Detailed granularity  
✅ **Volume Tracking** - See transaction counts  
✅ **Peak Detection** - Identifies busy periods  

### Animation
✅ **Auto-Play** - Watch flow over time  
✅ **Manual Scrub** - Drag to any timestamp  
✅ **Particle Effects** - Visual data movement  
✅ **Color-Coded** - Normal/Warning/Fraud  

---

## 🔧 API Endpoints

### Get Hierarchy
```
GET /api/hierarchy/{connection_id}/table/{table_name}
```
Returns circle packing structure with columns and related tables.

### Get Historical Flow
```
GET /api/hierarchy/{connection_id}/table/{table_name}/flow?hours=24
```
Returns 24 hours of flow data with timestamps.

### Get Animation Data
```
GET /api/hierarchy/{connection_id}/table/{table_name}/animate/{timestamp}
```
Returns particle data for a specific timestamp.

---

## 💡 Example Workflow

1. **Connect to banking database**
2. **Click on "transactions" table**
3. **Click "📊 View Flow"**
4. **See hierarchy:**
   - Center: transactions table
   - Inner: columns (id, amount, date, etc.)
   - Outer: related tables (accounts, customers)
5. **Click ▶ Play**
6. **Watch:**
   - Particles flow outward
   - Volume changes over time
   - Peak hours show more particles
   - Fraud alerts appear as red particles

---

## 🎨 Visual Examples

### Normal Flow (9 AM - Peak Hour)
```
Volume: 450 transactions/5min
Particles: Mostly green
Pattern: Steady outward flow
```

### Low Activity (3 AM)
```
Volume: 25 transactions/5min
Particles: Few, scattered
Pattern: Slow, sparse flow
```

### Fraud Spike (Detected)
```
Volume: 150 transactions/5min
Particles: Many red
Pattern: Burst of red particles
```

---

## 🚀 Technical Details

### Backend
- `hierarchical_flow.py` - Flow analysis service
- `hierarchy.py` - API endpoints
- Simulates historical data (replace with real queries)

### Frontend
- `hierarchical-view.js` - Circle packing + animation
- `timeline-styles.css` - Timeline UI
- Three.js for 3D rendering

### Data Structure
```javascript
{
  name: "transactions",
  type: "fact",
  children: [
    { name: "id", type: "column" },
    { name: "amount", type: "column" },
    { name: "accounts", type: "related_table" }
  ]
}
```

---

## 🎉 Key Benefits

**For Analysts:**
- Understand table structure at a glance
- See data flow patterns over time
- Identify peak usage periods

**For Developers:**
- Visualize relationships hierarchically
- Debug data flow issues
- Monitor transaction patterns

**For Business:**
- Spot anomalies in flow
- Understand usage patterns
- Identify optimization opportunities

---

## 🐛 Troubleshooting

**Hierarchy not showing?**
- Make sure you clicked "📊 View Flow" button
- Check browser console for errors
- Ensure table has columns/relationships

**Timeline not playing?**
- Click ▶ Play button
- Check if slider is at end (reset first)
- Verify historical data loaded

**No particles?**
- Wait a few seconds for animation
- Check if timestamp has data
- Try different time periods

---

**Built with advanced circle packing algorithms and historical flow analysis** 🎨✨
