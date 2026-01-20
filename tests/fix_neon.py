import requests
import asyncio

async def fix_neon():
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
        
        # 1. Grant permissions
        print("Granting permissions on public...")
        requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "GRANT ALL ON SCHEMA public TO neondb_owner"})
        requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "GRANT ALL ON ALL TABLES IN SCHEMA public TO neondb_owner"})
        
        # 2. Try to create test table
        print("Testing CREATE TABLE...")
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "CREATE TABLE IF NOT EXISTS public.perms_test (id serial primary key)"})
        print(f"Status: {resp.status_code}")
        print(f"Text: {resp.text}")

        if resp.status_code != 200:
             # If public still fails, we'll try 'evolution' schema
             print("Public failed. Trying 'evolution' schema...")
             requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "CREATE SCHEMA IF NOT EXISTS evolution"})
             resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "CREATE TABLE IF NOT EXISTS evolution.perms_test (id serial primary key)"})
             print(f"Evolution Status: {resp.status_code}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_neon())
