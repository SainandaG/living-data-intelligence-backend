import requests
import asyncio

async def force_permissions():
    print("🔓 Applying permissive grants (Sledgehammer fix)...", flush=True)
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
        resp = requests.post(f"{BASE_URL}/connect", json=db_config)
        conn_id = resp.json()['connection_id']
        print(f"Connected: {conn_id}", flush=True)
        
        # 2. Grant to PUBLIC (Everyone)
        grants = [
            "GRANT USAGE ON SCHEMA evolution TO public",
            "GRANT SELECT ON ALL TABLES IN SCHEMA evolution TO public",
            # Also ensure future tables are readable
            "ALTER DEFAULT PRIVILEGES IN SCHEMA evolution GRANT SELECT ON TABLES TO public",
            # For good measure, ensure owner still has everything
            "GRANT ALL ON SCHEMA evolution TO neondb_owner",
            "GRANT ALL ON ALL TABLES IN SCHEMA evolution TO neondb_owner"
        ]
        
        for sql in grants:
            print(f"Exec: {sql}", flush=True)
            resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
            if resp.status_code != 200:
                print(f"❌ Error: {resp.text}", flush=True)
            else:
                print("✅ Success", flush=True)

        # 3. Verify
        print("\nVerifying Access...", flush=True)
        sql = "SELECT count(*) as count FROM evolution.orders"
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
        print(f"Result: {resp.json()}", flush=True)
            
    except Exception as e:
        print(f"Critical Error: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(force_permissions())
