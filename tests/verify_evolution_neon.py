import requests
import asyncio
import sys

async def verify_analysis():
    print("🧪 Verifying Temporal Analyzer with Evolution data...", flush=True)
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
        
        # 2. Trigger Evolution Analysis
        print("Triggering /api/evolution/timeline...", flush=True)
        resp = requests.get(f"{BASE_URL}/evolution/timeline/{conn_id}")
        
        if resp.status_code == 200:
            data = resp.json()
            # print(data)
            tables = data.get('table_evolution', [])
            print(f"Tables Found: {len(tables)}", flush=True)
            for t in tables:
                print(f" - {t['table_name']}: Birth={t['birth_date']}", flush=True)
                
            if len(tables) == 0:
                print("⚠️ No tables found! Likely a schema issue.", flush=True)
        else:
            print(f"❌ Analysis Failed: {resp.status_code} - {resp.text}", flush=True)
            
    except Exception as e:
        print(f"Error: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(verify_analysis())
