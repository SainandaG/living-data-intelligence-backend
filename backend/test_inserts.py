import psycopg2, os
from dotenv import load_dotenv
load_dotenv(override=True)

conn = psycopg2.connect(
    host=os.getenv('DB_HOST'), user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'), dbname=os.getenv('DB_NAME'),
    port=os.getenv('DB_PORT','5432'), sslmode='require'
)
cur = conn.cursor()

cur.execute("SELECT id FROM batteries LIMIT 1")
bid = cur.fetchone()[0]
print(f"Using battery_id = {bid}")

# Test EXACT same INSERT as updated simulator
print("\n--- batteryhealthlog (fixed version) ---")
try:
    cur.execute("""
        INSERT INTO batteryhealthlog
            (battery_id, charge_percentage, health_percentage,
             voltage, current, temperature, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
    """, (bid, 95.5, 95.5, 47.8, 16.0, 25.0))
    conn.commit()
    print("  ✅ INSERT OK")
except Exception as e:
    conn.rollback()
    print(f"  ❌ ERROR: {e}")

print("\n--- gps_tracking_log (fixed version) ---")
try:
    cur.execute("""
        INSERT INTO gps_tracking_log
            (battery_id, latitude, longitude, speed,
             heading, accuracy, altitude,
             is_mock_location, provider, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (bid, 17.38, 78.48, 45.0, 0, 10.0, 0.0, False, 'GPS'))
    conn.commit()
    print("  ✅ INSERT OK")
except Exception as e:
    conn.rollback()
    print(f"  ❌ ERROR: {e}")

# Check final counts
for t in ['batteryhealthlog','gps_tracking_log']:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"\n  {t}: {cur.fetchone()[0]} rows")

cur.close()
conn.close()
