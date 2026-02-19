
import asyncio
import os
import json
from dotenv import load_dotenv
from app.services.db_connector import db_connector
import datetime
from decimal import Decimal
from uuid import UUID

load_dotenv()

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

async def check_data():
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
        
        # 1. Get Columns
        print("\n--- COLUMNS ---")
        query_cols = f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'swap_suggestions'"
        cols = await db_connector.query(conn_id, query_cols)
        for c in cols:
            print(f"- {c['column_name']} ({c['data_type']})")

        # 2. Try Fetching Data (Simulate API)
        print("\n--- FETCHING DATA ---")
        query = "SELECT * FROM swap_suggestions LIMIT 10"
        results = await db_connector.query(conn_id, query)
        
        print(f"Fetched {len(results)} rows.")
        if len(results) > 0:
            print("Row 1 sample:")
            print(results[0])
            
            # 3. Simulate JSON Serialization (FastAPI response)
            print("\n--- SERIALIZATION TEST ---")
            try:
                json_output = json.dumps(results, cls=CustomEncoder)
                print("✅ Serialization Successful")
            except Exception as e:
                print(f"❌ Serialization FAILED: {e}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if conn_info:
            await db_connector.close(conn_info['id'])

if __name__ == "__main__":
    asyncio.run(check_data())
