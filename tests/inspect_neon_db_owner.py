import requests
import asyncio

async def check_db_owner():
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
        
        sql = "SELECT d.datname, r.rolname FROM pg_database d JOIN pg_roles r ON d.datdba = r.oid WHERE d.datname = 'live_intelligence'"
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": sql})
        print(f"DB Owner: {resp.json()}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_db_owner())
