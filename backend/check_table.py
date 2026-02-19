
import asyncio
import os
from dotenv import load_dotenv
from app.services.db_connector import db_connector

load_dotenv()

async def check_table():
    # Helper to print all tables
    print("Connecting to DB...")
    # Mock connection ID and config as backend would
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
        
        # Get all tables
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        tables = await db_connector.query(conn_id, query)
        
        found = False
        print("\n--- TABLES ---")
        for t in tables:
            name = t['table_name']
            print(f"- {name}")
            if name.lower() == 'swap_suggestions':
                found = True
                
        print("\n----------------")
        if found:
            print("✅ Table 'swap_suggestions' FOUND.")
        else:
            print("❌ Table 'swap_suggestions' NOT FOUND.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn_info:
            await db_connector.close(conn_info['id'])

if __name__ == "__main__":
    asyncio.run(check_table())
