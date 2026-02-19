
import os
import psycopg2
import random
from dotenv import load_dotenv
import sys

# Force override
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

    # Generate random values
    new_temp = round(random.uniform(20.0, 55.0), 1)
    new_volt = round(random.uniform(40.0, 52.0), 1)
    new_curr = round(random.uniform(0.0, 20.0), 1)

    print(f"Updating batteries to: Temp={new_temp}, Volt={new_volt}, Curr={new_curr}")

    cur.execute(f"""
        UPDATE batteries 
        SET temperature_c = {new_temp},
            voltage_v = {new_volt},
            current_a = {new_curr}
    """)
    
    print("✅ Update successful. Check frontend in ~5 seconds.")

    cur.close()
    conn.close()
    sys.exit(0)
    
except Exception as e:
    print(f"❌ FAILURE: {e}")
    sys.exit(1)
