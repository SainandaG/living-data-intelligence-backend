import requests
import asyncio
import sys

async def check_progress():
    with open("check_debug.log", "w") as f:
        f.write("Starting check...\n")
        try:
            db_config = {
                "db_type": "neon",
                "host": "ep-round-leaf-a4fbu14a-pooler.us-east-1.aws.neon.tech",
                "port": 5432,
                "database": "live_intelligence",
                "username": "neondb_owner",
                "password": "npg_RZDgx9asJ2Ek"
            }
            BASE_URL = "http://localhost:8001/api"
            
            f.write("Connecting...\n")
            resp = requests.post(f"{BASE_URL}/connect", json=db_config)
            if resp.status_code != 200:
                f.write(f"Connect failed: {resp.text}\n")
                return
            conn_id = resp.json()['connection_id']
            f.write(f"Connected: {conn_id}\n")
            
            tables = ['users', 'products', 'orders', 'transactions']
            results = {}
            for t in tables:
                resp = requests.post(f"{BASE_URL}/query/{conn_id}", params={"sql": f"SELECT count(*) as cnt FROM evolution.{t}"})
                if resp.status_code == 200:
                    data = resp.json()
                    cnt = data[0]['cnt'] if data else 0
                    results[t] = cnt
                else:
                    results[t] = "Error"
            
            f.write(f"Results: {results}\n")
            print(f"Results: {results}")

        except Exception as e:
            f.write(f"Exception: {e}\n")
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_progress())
