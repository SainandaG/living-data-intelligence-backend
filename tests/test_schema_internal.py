import asyncio
import sys
from app.services.schema_analyzer import schema_analyzer
from app.services.db_connector import db_connector

async def test_schema():
    print("🔬 Testing Schema Analyzer...", flush=True)
    
    # Mock connection setup (since we can't use API easily here without running whole app)
    # Actually I'll use the API approach to properly simulate
    import requests
    db_config = {
        "db_type": "neon",
        "host": "ep-round-leaf-a4fbu14a-pooler.us-east-1.aws.neon.tech",
        "port": 5432,
        "database": "live_intelligence",
        "username": "neondb_owner",
        "password": "npg_RZDgx9asJ2Ek"
    }
    
    BASE_URL = "http://localhost:8001/api"
    
    try:
        resp = requests.post(f"{BASE_URL}/connect", json=db_config)
        conn_id = resp.json()['connection_id']
        print(f"Connected: {conn_id}", flush=True)
        
        # Manually invoke Schema Analyzer via internal code in main process? 
        # No, I can't access memory of running process.
        # I have to rely on proper API or debug logs.
        # But I can write a script that imports modules and runs them IF I provide the config.
        
        # Let's try to run schema analysis via a new endpoint or just checking if there is one?
        # No existing endpoint exposes schema analysis directly?
        # Wait, /api/connect calls it in background?
        # No, temporal analyzer calls it.
        
        # I'll create a script that USES the app code directly.
        # I need to set up db_connector.
        
        pass

    except Exception as e:
        print(f"Error: {e}")

# BETTER APPROACH:
# I will use the app's internal logic in this script.
async def run_internal():
    from app.services.db_connector import db_connector
    from app.services.schema_analyzer import schema_analyzer
    
    db_config = {
        "db_type": "neon",
        "host": "ep-round-leaf-a4fbu14a-pooler.us-east-1.aws.neon.tech",
        "port": 5432,
        "database": "live_intelligence",
        "username": "neondb_owner",
        "password": "npg_RZDgx9asJ2Ek"
    }
    
    conn_id = "test_conn"
    # Manually register connection
    db_connector.connections[conn_id] = {
        "config": db_config,
        "type": "neon",
        "client": None # Client needs to be real for analyze_schema to work!
    }
    
    # Trigger connect and get ID
    res = await db_connector.connect(db_config)
    conn_id = res['id']
    print(f"Test Connected: {conn_id}", flush=True)
    
    try:
        print("Running analyze_schema...", flush=True)
        schema = await schema_analyzer.analyze_schema(conn_id)
        print(f"Tables Found: {len(schema.tables)}", flush=True)
        for t in schema.tables:
            print(f"- {t.schema_name}.{t.name} (PKs: {t.primary_keys})", flush=True)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_internal())
