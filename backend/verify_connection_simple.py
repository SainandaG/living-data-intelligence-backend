
import os
from dotenv import load_dotenv
import psycopg2
import sys

# Force override to ensure we use the local .env
load_dotenv(override=True)

host = os.getenv("DB_HOST", "")
user = os.getenv("DB_USER", "")
password = os.getenv("DB_PASSWORD", "")
dbname = os.getenv("DB_NAME", "")
port = os.getenv("DB_PORT", "5432")

print(f"--- DATABASE CONNECTION TEST ---")
print(f"Host: {host}")
print(f"User: {user}")
print(f"Database: {dbname}")
print(f"Password Length: {len(password) if password else 0}")

if 'neon.tech' in host:
    print(f"Detected Neon DB. Using sslmode='require'")
    sslmode = 'require'
else:
    sslmode = 'prefer'

try:
    conn = psycopg2.connect(
        host=host,
        user=user,
        password=password,
        dbname=dbname,
        port=port,
        sslmode=sslmode,
        connect_timeout=10
    )
    print("✅ SUCCESS: Connected to database!")
    
    cur = conn.cursor()
    cur.execute("SELECT version();")
    ver = cur.fetchone()
    print(f"Server Version: {ver[0]}")
    
    # Check batteries table
    try:
        cur.execute("SELECT COUNT(*) FROM batteries")
        count = cur.fetchone()[0]
        print(f"✅ Found 'batteries' table with {count} rows.")
    except Exception as e:
        print(f"⚠️ Could not read 'batteries' table: {e}")
        conn.rollback()

    cur.close()
    conn.close()
    sys.exit(0)
    
except Exception as e:
    print(f"❌ FAILURE: Connection failed.")
    print(f"Error: {e}")
    sys.exit(1)
