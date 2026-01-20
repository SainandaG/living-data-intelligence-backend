import requests
import asyncio
import json

async def inspect_neon():
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
        
        # Check all schemas
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "SELECT schema_name FROM information_schema.schemata"})
        print(f"Schemas: {[s['schema_name'] for s in resp.json()]}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(inspect_neon())
