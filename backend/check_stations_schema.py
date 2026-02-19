
import asyncio
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env', override=True)

def check_stations_schema():
    host = os.getenv("DB_HOST")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    database = os.getenv("DB_NAME")
    port = os.getenv("DB_PORT", 5432)

    try:
        conn = psycopg2.connect(
            host=host,
            database=database,
            user=user,
            password=password,
            port=port,
            sslmode='require'
        )
        cur = conn.cursor()
        
        print(f"🔍 Checking schema for table 'stations'...")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stations';")
        rows = cur.fetchall()
        
        if rows:
            for col, dtype in rows:
                print(f" - {col} ({dtype})")
        else:
            print("❌ Table 'stations' not found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_stations_schema()
