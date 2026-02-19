
import os
import psycopg2
from dotenv import load_dotenv
import sys

# Force override to ensure we use the local .env
load_dotenv(override=True)

host = os.getenv("DB_HOST", "")
user = os.getenv("DB_USER", "")
password = os.getenv("DB_PASSWORD", "")
dbname = os.getenv("DB_NAME", "")
port = os.getenv("DB_PORT", "5432")

sslmode = 'require' if 'neon.tech' in host else 'prefer'

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
    conn.autocommit = True
    cur = conn.cursor()

    print("Checking columns...")
    
    # Check if columns exist
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'batteries'
    """)
    cols = [r[0] for r in cur.fetchall()]
    print(f"Existing columns: {cols}")

    missing = []
    if 'temperature_c' not in cols: missing.append("ADD COLUMN temperature_c FLOAT DEFAULT 25.0")
    if 'voltage_v' not in cols: missing.append("ADD COLUMN voltage_v FLOAT DEFAULT 48.0")
    if 'current_a' not in cols: missing.append("ADD COLUMN current_a FLOAT DEFAULT 5.0")
    
    if missing:
        print(f"Adding columns: {missing}")
        sql = f"ALTER TABLE batteries {', '.join(missing)};"
        cur.execute(sql)
        print("✅ Columns added successfully.")
    else:
        print("✅ All columns already exist.")

    cur.close()
    conn.close()
    sys.exit(0)
    
except Exception as e:
    print(f"❌ FAILURE: {e}")
    sys.exit(1)
