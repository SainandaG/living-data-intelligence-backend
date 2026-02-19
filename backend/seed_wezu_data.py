import asyncio
import os
import random
import math
from datetime import datetime, timedelta
from app.services.db_connector import db_connector
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def seed_wezu_data():
    """
    Seeds the database with WEZU Energy domain specific tables and data.
    """
    print("🔋 Initializing WEZU Energy Data Seeder...")
    
    # 0. CONNECT TO DB (MySQL)
    try:
        config = {
            'db_type': os.getenv('DB_TYPE', 'mysql'),
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', 3306)),
            'database': os.getenv('DB_NAME', 'wezu'),
            'username': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', '')
        }
        
        print(f"🔌 Connecting to {config['host']} ({config['db_type']})...")
        conn_info = await db_connector.connect(config)
        connection_id = conn_info['id']
        print(f"✅ Connected! Connection ID: {connection_id}")

        # 1. Create Tables (MySQL Compatible)
        tables_sql = [
            """
            CREATE TABLE IF NOT EXISTS batteries (
                battery_id VARCHAR(50) PRIMARY KEY,
                serial_number VARCHAR(100) UNIQUE,
                model_type VARCHAR(50),
                nominal_voltage_v FLOAT,
                capacity_kwh FLOAT,
                soh_percentage FLOAT DEFAULT 100.0,
                cycle_count INT DEFAULT 0,
                manufacturing_date DATE,
                status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, MAINTENANCE, RETIRED
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS grid_metrics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                zone_id VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                load_mw FLOAT,
                frequency_hz FLOAT,
                voltage_kv FLOAT,
                carbon_intensity_gco2_kwh FLOAT,
                stability_index FLOAT
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS bess_units (
                unit_id VARCHAR(50) PRIMARY KEY,
                location_name VARCHAR(100),
                total_capacity_kwh FLOAT,
                current_charge_kwh FLOAT,
                discharge_rate_kw FLOAT,
                grid_connection_status VARCHAR(20) DEFAULT 'CONNECTED',
                operating_mode VARCHAR(20) DEFAULT 'ARBITRAGE', -- ARBITRAGE, STABILITY, BACKUP
                last_maintenance_date DATE
            );
            """
        ]

        for sql in tables_sql:
            await db_connector.query(connection_id, sql)
        print("✅ Tables created/verified.")

        # 2. Seed Data
        # Batteries
        print("🌱 Seeding Batteries...")
        battery_types = ['LFP-48V', 'NMC-72V', 'LTO-24V']
        for i in range(100):
            bid = f"WEZU-BAT-{i:04d}"
            # MySQL uses INSERT IGNORE for conflict handling on PK
            await db_connector.query(connection_id, """
                INSERT IGNORE INTO batteries (battery_id, serial_number, model_type, nominal_voltage_v, capacity_kwh, soh_percentage, cycle_count, status, manufacturing_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                bid, 
                f"SN-{random.randint(100000, 999999)}",
                random.choice(battery_types),
                48.0,
                2.5,
                random.uniform(85.0, 100.0),
                random.randint(10, 500),
                random.choice(['ACTIVE', 'ACTIVE', 'ACTIVE', 'MAINTENANCE']),
                (datetime.now() - timedelta(days=random.randint(100, 1000))).date()
            ))

        # Grid Metrics (TimeSeries)
        print("🌱 Seeding Grid Metrics...")
        base_time = datetime.now()
        await db_connector.query(connection_id, "TRUNCATE TABLE grid_metrics") # Clean slate for metrics
        
        # Batch insert for speed or simple loop
        for i in range(24 * 7): # Last 7 days hourly
            ts = base_time - timedelta(hours=i)
            await db_connector.query(connection_id, """
                INSERT INTO grid_metrics (zone_id, timestamp, load_mw, frequency_hz, carbon_intensity_gco2_kwh, stability_index)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                'ZONE-ALPHA',
                ts,
                random.uniform(400, 800) + (100 * math.sin(i/24 * math.pi)), # Daily curve
                random.uniform(49.8, 50.2), # Hz
                random.uniform(150, 400),
                random.uniform(0.8, 1.0)
            ))

        # BESS Units
        print("🌱 Seeding BESS Units...")
        locations = ['North-Hub', 'South-Station', 'West-Depot', 'East-GigaFactory']
        for loc in locations:
            uid = f"BESS-{loc.upper()}"
            cap = random.choice([1000, 5000, 10000])
            await db_connector.query(connection_id, """
                INSERT IGNORE INTO bess_units (unit_id, location_name, total_capacity_kwh, current_charge_kwh, discharge_rate_kw, operating_mode)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                uid,
                loc,
                cap,
                cap * random.uniform(0.2, 0.9),
                random.uniform(0, 500),
                random.choice(['ARBITRAGE', 'STABILITY', 'BACKUP'])
            ))

        print("✨ WEZU Energy Data Seeding Complete!")
        
        await db_connector.close_all()

    except Exception as e:
        print(f"❌ Error seeding data: {e}")

if __name__ == "__main__":
    import math
    asyncio.run(seed_wezu_data())
