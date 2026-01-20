import requests
import asyncio
import sys

async def debug_perms():
    print("🕵️ Debugging Neon Permissions (Verbose)...", flush=True)
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
        # 1. Connect
        print("Connecting...", flush=True)
        resp = requests.post(f"{BASE_URL}/connect", json=db_config)
        conn_id = resp.json()['connection_id']
        print(f"Connected: {conn_id}", flush=True)
        
        # 2. Force Grants
        print("Forcing Grants...", flush=True)
        grants = [
            "GRANT USAGE ON SCHEMA evolution TO neondb_owner",
            "GRANT CREATE ON SCHEMA evolution TO neondb_owner",
            "GRANT ALL ON ALL TABLES IN SCHEMA evolution TO neondb_owner",
            "ALTER DEFAULT PRIVILEGES IN SCHEMA evolution GRANT ALL ON TABLES TO neondb_owner"
        ]
        
        for sql in grants:
            print(f"Exec: {sql}", flush=True)
            resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
            print(f"Status: {resp.status_code}", flush=True)
            if resp.status_code != 200:
                print(f"Error: {resp.text}", flush=True)

        # 3. Test Select
        print("\nTesting Select...", flush=True)
        sql = "SELECT count(*) FROM evolution.transactions"
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
        print(f"Select Status: {resp.status_code}", flush=True)
        print(f"Select Result: {resp.json()}", flush=True)
            
    except Exception as e:
        print(f"Main Error: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(debug_perms())
