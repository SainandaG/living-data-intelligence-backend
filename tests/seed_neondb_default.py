import requests
import asyncio

async def test_neondb_default():
    db_config = {
        "db_type": "neon",
        "host": "ep-round-leaf-a4fbu14a-pooler.us-east-1.aws.neon.tech",
        "port": 5432,
        "database": "neondb", # Testing default DB
        "username": "neondb_owner",
        "password": "npg_RZDgx9asJ2Ek"
    }
    
    BASE_URL = "http://localhost:8001/api"
    
    try:
        resp = requests.post(f"{BASE_URL}/connect", json=db_config)
        if resp.status_code != 200:
            print(f"Failed to connect to neondb: {resp.text}")
            return
            
        conn_id = resp.json()['connection_id']
        print(f"Connected to neondb: {conn_id}")
        
        # Try to seed
        print("Seeding neondb...")
        resp = requests.post(f"{BASE_URL}/seed/{conn_id}")
        print(f"Seed Status: {resp.status_code} - {resp.text}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_neondb_default())
