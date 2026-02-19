
import asyncio
import os
import psycopg2
import time
from dotenv import load_dotenv

load_dotenv('backend/.env', override=True)

def check_counts():
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
        
        print("🕒 Checking counts over 10 seconds...")
        for i in range(3):
            cur.execute("SELECT SUM(n_live_tup) FROM pg_stat_user_tables;")
            estimate = cur.fetchone()[0]
            
            # Get actual count for a few tables to see if they are changing
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 3;")
            tables = [r[0] for r in cur.fetchall()]
            
            actuals = {}
            for t in tables:
                cur.execute(f"SELECT COUNT(*) FROM \"{t}\";")
                actuals[t] = cur.fetchone()[0]
            
            print(f"[{i}] Estimate: {estimate} | Actuals: {actuals}")
            time.sleep(5)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_counts()
