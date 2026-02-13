# 📋 Sakila Database Setup Guide

**Database**: Sakila Sample Database (MySQL)  
**Purpose**: DVD Rental Store Database  
**Source**: Official MySQL Sample Database  
**Installation**: Via Antigravity Terminal (No manual steps needed!)

---

## 🎯 What is Sakila?

Sakila is MySQL's official sample database representing a DVD rental store with:
- **Customers** - Customer information
- **Films** - Movie catalog  
- **Actors** - Actor details
- **Rentals** - Rental transactions
- **Inventory** - Store inventory
- **Payments** - Payment records
- **Staff** - Employee data
- **Stores** - Store locations

---

## 🤖 Automated Installation (Recommended)

**Just ask Antigravity to install it!**

Simply say: *"Install Sakila database"*

Antigravity will:
1. ✅ Download sakila-db.zip automatically
2. ✅ Extract SQL files
3. ✅ Create database in MySQL
4. ✅ Load schema (16 tables)
5. ✅ Load sample data
6. ✅ Update .env configuration
7. ✅ Restart backend
8. ✅ Verify installation

**No manual commands needed!**

---

## 🛠️ Manual Installation (If Preferred)

### Step 1: Download and Extract

```powershell
# Create directory
mkdir sakila
cd sakila

# Download (if you have curl)
curl -o sakila-db.zip https://downloads.mysql.com/docs/sakila-db.zip

# Extract the zip file manually or use:
Expand-Archive -Path sakila-db.zip -DestinationPath .
```

**After extraction, you'll have:**
- `sakila-schema.sql` - Creates tables and structure
- `sakila-data.sql` - Inserts sample data

---

### Step 2: Create Database in MySQL

```bash
# Create database (Antigravity will run this)
mysql -u root -p -e "CREATE DATABASE sakila;"
```

---

### Step 3: Load Schema (Tables)

```bash
# Load table structure (Antigravity will run this)
Get-Content sakila-schema.sql | mysql -u root -p sakila
```

---

### Step 4: Load Data

```bash
# Load sample data (Antigravity will run this)
Get-Content sakila-data.sql | mysql -u root -p sakila
```

---

### Step 5: Verify Installation

```bash
# Check tables (Antigravity will verify)
mysql -u root -p -e "USE sakila; SHOW TABLES;"

# Check data
mysql -u root -p -e "SELECT COUNT(*) FROM sakila.film;"
mysql -u root -p -e "SELECT COUNT(*) FROM sakila.customer;"
```

**Expected Tables (16 total):**
- actor
- address
- category
- city
- country
- customer
- film
- film_actor
- film_category
- film_text
- inventory
- language
- payment
- rental
- staff
- store

---

### Step 6: Update .env Configuration

Edit `backend/.env`:

```env
# Database Configuration (Antigravity will update this)
DB_TYPE=MYSQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sakila
DB_USER=root
DB_PASSWORD=your_password
```

---

### Step 7: Restart Backend

```bash
# Stop current backend (Ctrl+C in terminal)
# Then restart:
cd backend
python main.py
```

---

### Step 8: Open Platform

1. Open browser: **http://localhost:5173**
2. Platform auto-connects to Sakila database
3. See 3D visualization of all tables!

---

## 📊 Expected Results

### Tables You'll See:
- **Blue Nodes** (Dimension): actor, category, city, country, language, store
- **Yellow Nodes** (Fact): rental, payment, inventory, film_actor
- **Relationships**: Foreign keys between tables

### Sample Queries to Try:
```sql
-- Total films
SELECT COUNT(*) FROM film;

-- Total customers
SELECT COUNT(*) FROM customer;

-- Recent rentals
SELECT * FROM rental ORDER BY rental_date DESC LIMIT 10;

-- Top actors
SELECT a.first_name, a.last_name, COUNT(*) as film_count
FROM actor a
JOIN film_actor fa ON a.actor_id = fa.actor_id
GROUP BY a.actor_id
ORDER BY film_count DESC
LIMIT 10;
```

---

## 🎤 Voice Commands to Try

Once connected:
```
"highlight film"
"show me customer"
"zoom in"
"start flow"
"show anomalies"
"reset view"
```

---

## 🔧 Troubleshooting

### Problem: Download fails
**Solution**: Download manually from https://dev.mysql.com/doc/index-other.html

### Problem: Tables not showing
**Solution**: 
1. Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`
2. Check tables: `mysql -u root -p -e "USE sakila; SHOW TABLES;"`
3. Restart backend

### Problem: Permission denied
**Solution**: Make sure MySQL user has read access to sakila database

---

## 📁 File Locations

After setup:
```
living-data-intelligence-backend/
├── sakila/
│   ├── sakila-schema.sql    # Table definitions
│   ├── sakila-data.sql       # Sample data
│   └── sakila-db.zip         # Original download
├── backend/
│   └── .env                  # Updated with sakila config
```

---

## ✅ Quick Command Reference

**Note**: All these commands will be executed by Antigravity automatically!

```bash
# Download
curl -o sakila-db.zip https://downloads.mysql.com/docs/sakila-db.zip

# Extract
Expand-Archive -Path sakila-db.zip -DestinationPath sakila

# Create database
mysql -u root -p -e "CREATE DATABASE sakila;"

# Load schema
Get-Content sakila/sakila-schema.sql | mysql -u root -p sakila

# Load data
Get-Content sakila/sakila-data.sql | mysql -u root -p sakila

# Verify
mysql -u root -p -e "SELECT COUNT(*) FROM sakila.film;"

# Antigravity will update .env automatically
# DB_NAME=sakila

# Antigravity will restart backend automatically
```

---

## 🎉 Success Checklist

- ✅ Downloaded sakila-db.zip
- ✅ Extracted SQL files
- ✅ Created sakila database
- ✅ Loaded schema (16 tables)
- ✅ Loaded data (~1000 films, ~600 customers)
- ✅ Updated .env file
- ✅ Restarted backend
- ✅ Opened http://localhost:5173
- ✅ Seeing 3D visualization!

---

## 📊 Database Statistics

**Total Tables**: 16  
**Sample Data**:
- ~1000 films
- ~600 customers
- ~200 actors
- ~16,000 rentals
- ~16,000 payments

**Perfect for testing:**
- 3D visualization
- Voice commands
- Real-time monitoring
- Anomaly detection
- AI chat queries

---

**Status**: Ready to Install  
**Difficulty**: Easy (5 minutes)  
**Database Type**: MySQL Sample Database
