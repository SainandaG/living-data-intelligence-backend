
import asyncio
import sys
import os

# Add backend directory to path so 'app' is at root
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.data_flow_analyzer import data_flow_analyzer
from app.services.db_connector import db_connector
from app.services.schema_analyzer import schema_analyzer
from dotenv import load_dotenv

load_dotenv('backend/.env', override=True)

async def reproduce():
    print("🧪 Attempting to reproduce 500 error for '/api/data-flow/conn_1/stations'...")
    
    config = {
        'db_type': 'postgres',
        'host': os.getenv("DB_HOST"),
        'port': os.getenv("DB_PORT", 5432),
        'username': os.getenv("DB_USER"),
        'password': os.getenv("DB_PASSWORD"),
        'database': os.getenv("DB_NAME")
    }
    
    try:
        # 1. Connect (This creates 'conn_1' if it's the first connection)
        conn_info = await db_connector.connect(config)
        conn_id = conn_info['id']
        print(f"✅ Connected. Connection ID: {conn_id}")
        
        # 2. Call the analyzer
        print(f"🔍 Analyzing flow for 'stations'...")
        flow = await data_flow_analyzer.analyze_table_flow(conn_id, "stations")
        print(f"✅ Success! Found {len(flow['nodes'])} nodes.")
        
        # 3. Call for a case mismatch?
        print(f"🔍 Analyzing flow for 'STATIONS'...")
        flow_case = await data_flow_analyzer.analyze_table_flow(conn_id, "STATIONS")
        print(f"✅ Success (case)! Found {len(flow_case['nodes'])} nodes.")

    except Exception as e:
        print(f"❌ REPRODUCED ERROR: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(reproduce())
