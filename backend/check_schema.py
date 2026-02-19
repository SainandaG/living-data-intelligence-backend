import asyncio
import os
import sys
from dotenv import load_dotenv

# Mock app structure
sys.path.append(os.getcwd())
from app.services.db_connector import db_connector

load_dotenv(override=True)

async def check_columns():
    conn_config = {
        "db_type": "postgres",
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
    
    try:
        conn = await db_connector.connect(conn_config)
        cid = conn['id']
        print(f"✅ Connected: {cid}")
        
        tables = ['batteries', 'batteryhealthlog', 'telemetics_data']
        
        for t in tables:
            print(f"\n--- Columns in {t} ---")
            q = f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t}'"
            res = await db_connector.query(cid, q)
            if res:
                for r in res:
                    print(f"  {r['column_name']} ({r['data_type']})")
            else:
                print(f"  ❌ Table {t} not found or no columns.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_columns())
