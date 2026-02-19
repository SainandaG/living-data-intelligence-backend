import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def test_direct_postgres():
    host = "ep-green-bird-aimdtum7.c-4.us-east-1.aws.neon.tech"
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    database = os.getenv("DB_NAME")
    port = os.getenv("DB_PORT", 5432)

    print(f"Testing direct connection to {host}...")
    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=port,
            sslmode='require',
            connect_timeout=10
        )
        print("✅ Direct Connection Successful!")
        cur = conn.cursor()
        cur.execute("SELECT version();")
        print(f"Version: {cur.fetchone()}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Direct Connection Failed: {e}")

if __name__ == "__main__":
    test_direct_postgres()
