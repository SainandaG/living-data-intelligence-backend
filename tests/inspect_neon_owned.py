import requests
import asyncio

async def find_owned_schemas():
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
        
        sql = "SELECT nspname FROM pg_namespace JOIN pg_roles ON nspowner = pg_roles.oid WHERE rolname = 'neondb_owner'"
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
        print(f"Owned Schemas: {resp.json()}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(find_owned_schemas())
