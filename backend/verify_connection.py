import requests
import os
from dotenv import load_dotenv

load_dotenv()

def verify_connection():
    BASE_URL = "http://localhost:8001/api"
    HEALTH_URL = "http://localhost:8001/health"
    
    print(f"Checking health at {HEALTH_URL}...")
    try:
        h_resp = requests.get(HEALTH_URL, timeout=5)
        print(f"Health Status: {h_resp.status_code}")
        print(f"Health Detail: {h_resp.json()}")
    except Exception as e:
        print(f"❌ Health Check Failed: {e}")
        return

    config = {
        "db_type": "postgres", # Force postgres for neon
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT", 5432)),
        "database": os.getenv("DB_NAME"),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD")
    }
    
    print(f"Attempting to connect to {config['host']} via {BASE_URL}/connect...")
    try:
        resp = requests.post(f"{BASE_URL}/connect", json=config)
        if resp.status_code == 200:
            print("✅ Connection Successful!")
            print(f"Response: {resp.json()}")
        else:
            print(f"❌ Connection Failed: {resp.status_code}")
            print(f"Detail: {resp.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_connection()
