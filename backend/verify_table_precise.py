
import asyncio
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')

def verify_exact_table():
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
        
        print(f"🔍 Checking for table like '%social_links%'...")
        cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%social_links%';")
        rows = cur.fetchall()
        
        if rows:
            for schema, name in rows:
                print(f"✅ Found: Schema='{schema}', Name='{name}'")
        else:
            print("❌ No table found with name like '%social_links%'.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_exact_table()
