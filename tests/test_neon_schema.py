import requests
import asyncio

async def test_neon_schema():
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
        print(f"Connected: {conn_id}")
        
        # Try to create schema
        print("Creating schema 'evolution'...")
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "CREATE SCHEMA IF NOT EXISTS evolution"})
        print(f"Status: {resp.status_code}")
        print(f"Result: {resp.text}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_neon_schema())
