import asyncio
import os
from dotenv import load_dotenv

# Load env vars
load_dotenv(override=True)

# Mock the app structure to leverage existing db_connector
import sys
sys.path.append(os.getcwd())

from app.services.db_connector import db_connector

async def verify_data():
    connection_id = "user_provided_connection_id" # We need the actual ID or iterate known ones
    # Since we don't know the exact connection ID stored in memory, we might need to inspect the file or just use the .env creds directly
    # But db_connector uses its own management.
    # Let's try to list connections first if possible, or just create one from .env
    
    print("--- Verifying WEZU Data in Database ---")
    
    # Manually create a connection config from .env to be sure
    conn_config = {
        "db_type": "postgres", # Key name fix: type -> db_type
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "username": os.getenv("DB_USER"), # Key name fix: user -> username
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
    
    # Connect properly
    try:
        conn_info = await db_connector.connect(conn_config)
        connection_id = conn_info['id']
        print(f"✅ Connected with ID: {connection_id}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    # 1. Check Batteries
    print("\n[Batteries Table Check]")
    try:
        q = "SELECT id, soh_percentage, temperature, voltage, last_reported_at FROM batteries ORDER BY last_reported_at DESC LIMIT 5"
        res = await db_connector.query(connection_id, q)
        if res:
            for row in res:
                print(f"  Row: {row}")
        else:
            print("  ⚠️ No data found in 'batteries' table.")
            # Try legacy columns just in case
            q2 = "SELECT id, temperature_c, voltage_v FROM batteries LIMIT 1"
            res2 = await db_connector.query(connection_id, q2)
            if res2:
                print(f"  ⚠️ FOUND LEGACY COLUMNS instead: {res2}")
            else:
                print("  ❌ No legacy data found either.")
    except Exception as e:
        print(f"  ❌ Error querying batteries: {e}")

    # 2. Check Telemetics
    print("\n[Telemetics Data Check]")
    try:
        q = "SELECT COUNT(*) as count FROM telemetics_data"
        res = await db_connector.query(connection_id, q)
        print(f"  Total Rows: {res[0]['count']}")
    except Exception as e:
        print(f"  ❌ Error querying telemetics_data: {e}")

    # 3. Check BatteryHealthLog
    print("\n[Battery Health Log Check]")
    try:
        q = "SELECT COUNT(*) as count FROM batteryhealthlog"
        res = await db_connector.query(connection_id, q)
        print(f"  Total Rows: {res[0]['count']}")
    except Exception as e:
        print(f"  ❌ Error querying batteryhealthlog: {e}")

if __name__ == "__main__":
    asyncio.run(verify_data())
