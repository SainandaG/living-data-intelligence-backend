import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
from app.services.db_connector import db_connector

load_dotenv(override=True)

async def fix_schema():
    conn_config = {
        "db_type": "postgres",
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
    
    try:
        print("🔌 Connecting to DB...")
        conn = await db_connector.connect(conn_config)
        cid = conn['id']
        
        # 1. Check & Rename Temperature
        q = "SELECT 1 FROM information_schema.columns WHERE table_name='batteries' AND column_name='temperature_c'"
        res = await db_connector.query(cid, q)
        if res:
            print("🛠️ Renaming temperature_c -> temperature")
            await db_connector.query(cid, "ALTER TABLE batteries RENAME COLUMN temperature_c TO temperature")
        else:
            print("✅ temperature_c not found (already renamed?)")

        # 2. Check & Rename Voltage
        q = "SELECT 1 FROM information_schema.columns WHERE table_name='batteries' AND column_name='voltage_v'"
        res = await db_connector.query(cid, q)
        if res:
            print("🛠️ Renaming voltage_v -> voltage")
            await db_connector.query(cid, "ALTER TABLE batteries RENAME COLUMN voltage_v TO voltage")
        else:
            print("✅ voltage_v not found (already renamed?)")

        # 3. Add SoH
        print("🛠️ Adding soh_percentage if missing")
        await db_connector.query(cid, "ALTER TABLE batteries ADD COLUMN IF NOT EXISTS soh_percentage DOUBLE PRECISION DEFAULT 100.0")

        # 4. Add LastReported
        print("🛠️ Adding last_reported_at if missing")
        await db_connector.query(cid, "ALTER TABLE batteries ADD COLUMN IF NOT EXISTS last_reported_at TIMESTAMP DEFAULT NOW()")
        
        print("🎉 Schema Fix Complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_schema())
