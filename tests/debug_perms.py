import requests
import asyncio

async def debug_perms():
    print("🕵️ Debugging Neon Permissions...")
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
        
        # 1. Check Schema Owner
        print("\n1. Schema Ownership:")
        sql = "SELECT nspname, rolname FROM pg_namespace JOIN pg_roles ON nspowner = pg_roles.oid WHERE nspname = 'evolution'"
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
        print(resp.json())
        
        # 2. Check explicitly if we can select
        print("\n2. Try Select:")
        try:
            resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "SELECT count(*) FROM evolution.transactions"})
            print(f"Status: {resp.status_code}")
            print(f"Result: {resp.text}")
        except Exception as e:
            print(f"Select failed: {e}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_perms())
