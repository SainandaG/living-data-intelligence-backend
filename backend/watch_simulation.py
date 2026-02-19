
import os
import time
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

def get_battery_stats():
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
        cur = conn.cursor()
        cur.execute("SELECT AVG(temperature_c), AVG(voltage_v), AVG(current_a), COUNT(*) FROM batteries")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return None

print(f"--- WATCHING BATTERY SIMULATION ---")
print(f"Monitoring DB: {dbname} on {host}")
print("Updates every 10 seconds. Press Ctrl+C to stop.")
print("-" * 75)
print(f"{'TIME':<10} | {'TEMP (°C)':<12} | {'VOLT (V)':<12} | {'CURR (A)':<12} | {'COUNT':<10}")
print("-" * 75)

try:
    while True:
        stats = get_battery_stats()
        if stats:
            avg_temp = stats[0]
            avg_volt = stats[1]
            avg_curr = stats[2]
            count = stats[3]
            
            temp_str = f"{float(avg_temp):.2f}" if avg_temp else "N/A"
            volt_str = f"{float(avg_volt):.2f}" if avg_volt else "N/A"
            curr_str = f"{float(avg_curr):.2f}" if avg_curr else "N/A"
            
            print(f"{time.strftime('%H:%M:%S'):<10} | {temp_str:<12} | {volt_str:<12} | {curr_str:<12} | {count:<10}")
        
        time.sleep(10)
except KeyboardInterrupt:
    print("\nStopped monitoring.")
