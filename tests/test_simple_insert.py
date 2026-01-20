import requests
import asyncio

async def test_simple_insert():
    db_config = {
        "db_type": "neon",
        "host": "ep-round-leaf-a4fbu14a-pooler.us-east-1.aws.neon.tech",
        "port": 5432,
        "database": "neondb",
        "username": "neondb_owner",
        "password": "npg_RZDgx9asJ2Ek"
    }
    BASE_URL = "http://localhost:8001/api"
    try:
        resp = requests.post(f"{BASE_URL}/connect", json=db_config)
        conn_id = resp.json()['connection_id']
        
        # 1. Create table
        print("Creating table...")
        requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "CREATE TABLE IF NOT EXISTS simple_test (id serial primary key, name text)"})
        
        # 2. Insert with params
        print("Inserting with params...")
        # Since my /query endpoint takes SQL as a param, it might not support tuple params easily via requests.
        # But seeder.py uses internal db_connector.query which does.
        
        # I'll try a raw SQL insert without params first
        resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": "INSERT INTO simple_test (name) VALUES ('test')"})
        print(f"Insert Status: {resp.status_code} - {resp.text}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_simple_insert())
