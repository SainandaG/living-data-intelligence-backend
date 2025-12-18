# 🎮 Quick Test Guide - Advanced Features

## ✅ What's Working Now

Your platform now has **Living Graph Intelligence** and **Anomaly Detection**!

---

## 🚀 How to Test (2 Minutes)

### Step 1: Refresh Your Browser

If you have the demo already open:
```
Press F5 or Ctrl+R to reload
```

If not:
```
Open: http://localhost:8000
Click: "🎨 Try Demo"
```

---

## 👀 What to Watch For

### 1. Health Status Indicator (Top-Right)

**You'll see it change between:**

🟢 **Healthy (85-100/100)**
- Green dot
- Steady, slow pulse
- Means: System running normally

🟡 **Stressed (50-79/100)**  
- Yellow dot
- Faster pulse
- Means: Some issues detected

🔴 **Anomalous (0-49/100)**
- Red dot
- Rapid pulse
- Means: Critical issues!

**Updates every 2 seconds**

---

### 2. Anomaly Notifications (Top-Center)

**Every ~20 seconds, you might see:**

🚨 **Critical Anomaly** (Red background)
```
"Transaction rate is 67% higher than normal. 
Possible causes: marketing campaign, system 
load test, or DDoS attack."
```

⚠️ **Warning Anomaly** (Yellow background)
```
"Fraud alerts increased by 150%. Possible 
coordinated attack or compromised accounts detected."
```

**Auto-dismisses after 10 seconds**

---

### 3. Smart Particles

Watch the flowing particles between nodes:

- 🟢 **Green** = Normal transactions
- 🟡 **Yellow** = Warning level  
- 🔴 **Red** = Fraud/Critical

**New particles appear every 2-3 seconds**

---

### 4. Live Metrics (Right Panel)

All metrics update in real-time:
- Transaction Rate: 500-1500/min
- Total Transactions: 50M-51M
- Fraud Alerts: 0-10
- Average Amount: $100-$5000
- Failed Transactions: 0-50

---

## 🎯 Expected Behavior

### Normal Flow (Most of the time):
```
✅ Status: Healthy (90/100)
✅ Particles: Mostly green
✅ No notifications
✅ Metrics updating smoothly
```

### Occasional Stress:
```
⚠️ Status: Stressed (65/100)
⚠️ Particles: Mix of colors
⚠️ Yellow notification appears
⚠️ Metrics show elevated values
```

### Rare Critical Events:
```
🚨 Status: Anomalous (40/100)
🚨 Particles: Many red
🚨 Red notification appears
🚨 Multiple issues detected
```

---

## 🐛 Troubleshooting

**Not seeing health status changes?**
- Wait 10-20 seconds, it updates every 2 seconds
- Refresh the page (F5)
- Check browser console (F12) for errors

**No anomaly notifications?**
- They appear randomly (~10% chance every 2 seconds)
- Wait 30-60 seconds
- Look for console logs: "Anomaly detected:"

**Particles not flowing?**
- Check if 3D visualization loaded
- Look for spinning nodes
- Try clicking "Try Demo" again

**WebSocket errors in console?**
- **This is normal for demo mode!**
- Demo uses simulated data, not WebSocket
- Errors won't affect functionality

---

## 📊 What's Happening Behind the Scenes

Every 2 seconds:
1. ✅ Generate random metrics
2. ✅ Calculate health score
3. ✅ Update status indicator
4. ✅ Check for anomalies (10% chance)
5. ✅ Show notification if anomaly found
6. ✅ Add particle (30% chance)

---

## 🎨 Visual Checklist

After 60 seconds, you should have seen:

- [ ] Status indicator change color at least once
- [ ] At least 1-2 anomaly notifications
- [ ] Health score fluctuate (e.g., 92 → 75 → 88)
- [ ] Mix of green, yellow, and red particles
- [ ] Metrics updating continuously

---

## 💡 Pro Tips

**To see more anomalies:**
- Wait during high transaction rates (>1200)
- Watch when fraud alerts spike (>5)
- Notice failed transactions increase (>30)

**To understand health scoring:**
- Healthy = All metrics in normal range
- Stressed = 1-2 metrics elevated
- Anomalous = Multiple critical issues

**Best viewing:**
- Full screen browser
- Zoom at 100%
- Right panel visible for metrics

---

## ✨ Cool Things to Notice

1. **Status dot pulses faster** when stressed/anomalous
2. **Particle colors match severity** of current state
3. **Notifications explain WHY** anomaly occurred
4. **Health score is calculated** from multiple factors
5. **Everything updates in real-time** without refresh

---

## 🎉 Success Criteria

If you see these, **it's working perfectly:**

✅ Status changes from Healthy → Stressed → Healthy  
✅ At least one anomaly notification appears  
✅ Particles flow in different colors  
✅ Metrics update every 2 seconds  
✅ Health score fluctuates (not stuck at 100)  

---

**Enjoy your intelligent, living data platform!** 🧠✨

*Any issues? Check browser console (F12) for detailed logs.*
