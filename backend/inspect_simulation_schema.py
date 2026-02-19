
import asyncio
import os
from dotenv import load_dotenv
from app.services.db_connector import db_connector

load_dotenv()

async def inspect_schema():
    config = {
        "db_type": os.getenv("DB_TYPE"),
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", 5432)),
        "database": os.getenv("DB_NAME", "postgres"),
        "username": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "")
    }
    
    conn_info = None
    try:
        conn_info = await db_connector.connect(config)
        conn_id = conn_info['id']
        print(f"Connected with ID: {conn_id}")
        
        # Check batteries table
        print("\n--- BATTERIES COLUMNS ---")
        query_cols = f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'batteries'"
        cols = await db_connector.query(conn_id, query_cols)
        for c in cols:
            print(f"- {c['column_name']} ({c['data_type']})")
            
        # Check if there are other relevant tables like 'telemetry', 'readings', etc.
        print("\n--- OTHER CANDIDATE TABLES ---")
        query_tables = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%tele%' OR table_name LIKE '%log%' OR table_name LIKE '%metric%'"
        tables = await db_connector.query(conn_id, query_tables)
        for t in tables:
            print(f"- {t['table_name']}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if conn_info:
            await db_connector.close(conn_info['id'])

if __name__ == "__main__":
    asyncio.run(inspect_schema())
