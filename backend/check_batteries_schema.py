
import asyncio
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env', override=True)

def check_batteries_schema():
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
        
        print(f"🔍 Checking schema for table 'batteries'...")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'batteries';")
        rows = cur.fetchall()
        
        if rows:
            for col, dtype in rows:
                print(f" - {col} ({dtype})")
        else:
            print("❌ Table 'batteries' not found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_batteries_schema()
