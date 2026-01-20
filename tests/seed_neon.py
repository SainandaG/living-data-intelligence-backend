import asyncio
import requests
import time

async def seed_neon():
    print("🚀 Connecting to Neon DB for seeding...")
    
    # Credentials from user screenshot
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
        # 1. Establish connection
        print(f"🔗 Establishing link to {db_config['host']}...")
        resp = requests.post(f"{BASE_URL}/connect", json=db_config)
        conn_data = resp.json()
        
        if not conn_data.get('success'):
            print(f"❌ Connection failed: {conn_data}")
            return
            
        conn_id = conn_data['connection_id']
        print(f"✅ Connection Established: {conn_id}")
        
        # 2. Trigger Seeding
        print(f"🌱 Seeding temporal data (Users, Products, Orders, Transactions)...")
        seed_resp = requests.post(f"{BASE_URL}/seed/{conn_id}")
        
        if seed_resp.status_code == 200:
            print("✅ Database seeded successfully!")
            print("✨ You can now view the Evolution Playback on the dashboard.")
        else:
            print(f"❌ Seeding failed: {seed_resp.text}")
            
    except Exception as e:
        print(f"❌ Error during seeding: {e}")

if __name__ == "__main__":
    asyncio.run(seed_neon())
