import psycopg2
import os
from dotenv import load_dotenv

def test_db():
    try:
        host = 'ep-round-leaf-a4fbu14a-pooler.us-east-1.aws.neon.tech'
        port = 5432
        database = 'live_intelligence'
        user = 'neondb_owner'
        password = 'npg_RZDgx9asJ2Ek'
        
        print(f"Connecting to {host}...")
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            connect_timeout=10
        )
        cur = conn.cursor()
        print("Connected! Listing tables...")
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchall()
        print(f"Tables found: {tables}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test_db()
