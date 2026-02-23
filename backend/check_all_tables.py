import psycopg2, os
from dotenv import load_dotenv
load_dotenv(override=True)

conn = psycopg2.connect(
    host=os.getenv('DB_HOST'), user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'), dbname=os.getenv('DB_NAME'),
    port=os.getenv('DB_PORT','5432'), sslmode='require'
)
cur = conn.cursor()

print("=" * 60)
print("  WEZU DEEP REPORT — batteries, stations, telemetics_data")
print("=" * 60)

# --- BATTERIES ---
print("\n🔋 BATTERIES")
cur.execute("SELECT COUNT(*), AVG(temperature), AVG(voltage), AVG(current_a), AVG(soh_percentage), AVG(health_percentage) FROM batteries")
r = cur.fetchone()
print(f"  Total rows     : {r[0]}")
print(f"  Avg Temp       : {r[1]:.2f}°C")
print(f"  Avg Voltage    : {r[2]:.2f} V")
print(f"  Avg Current    : {r[3]:.2f} A")
print(f"  Avg SoH        : {r[4]:.2f}%")
print(f"  Avg Health     : {r[5]:.2f}%")

cur.execute("SELECT COUNT(*) FROM batteries WHERE temperature > 45")
hot = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM batteries WHERE soh_percentage < 80")
low_soh = cur.fetchone()[0]
cur.execute("SELECT MIN(temperature), MAX(temperature) FROM batteries")
mn, mx = cur.fetchone()
cur.execute("SELECT last_reported_at FROM batteries ORDER BY last_reported_at DESC LIMIT 1")
last = cur.fetchone()[0]
print(f"  Temp range     : {mn:.1f}°C — {mx:.1f}°C")
print(f"  Hot (>45°C)    : {hot} batteries")
print(f"  Low SoH (<80%) : {low_soh} batteries")
print(f"  Last updated   : {last}")

# --- STATIONS ---
print("\n🏪 STATIONS")
cur.execute("SELECT COUNT(*), AVG(rating), SUM(total_reviews), MIN(rating), MAX(rating) FROM stations")
r = cur.fetchone()
print(f"  Total rows     : {r[0]}")
print(f"  Avg Rating     : {r[1]:.2f}★")
print(f"  Total Reviews  : {int(r[2]) if r[2] else 0}")
print(f"  Rating range   : {r[3]:.1f} — {r[4]:.1f}★")

cur.execute("SELECT COUNT(*) FROM stations WHERE status='ACTIVE' OR status='active'")
active = cur.fetchone()[0]
cur.execute("SELECT COUNT(DISTINCT station_type) FROM stations WHERE station_type IS NOT NULL")
types = cur.fetchone()[0]
cur.execute("SELECT station_type, COUNT(*) FROM stations GROUP BY station_type ORDER BY COUNT(*) DESC LIMIT 3")
type_rows = cur.fetchall()
print(f"  Active stations: {active}")
print(f"  Station types  : {types}")
for t, c in type_rows:
    print(f"    - {t or 'NULL'}: {c}")

# --- TELEMETICS_DATA ---
print("\n📡 TELEMETICS_DATA")
cur.execute("SELECT COUNT(*) FROM telemetics_data")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM telemetics_data WHERE received_at >= NOW() - INTERVAL '5 minutes'")
last5 = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM telemetics_data WHERE received_at >= NOW() - INTERVAL '2 minutes'")
last2 = cur.fetchone()[0]
cur.execute("SELECT AVG(temperature), AVG(voltage), AVG(current), AVG(soh) FROM telemetics_data")
r = cur.fetchone()
cur.execute("SELECT COUNT(DISTINCT battery_id) FROM telemetics_data")
unique_batts = cur.fetchone()[0]
cur.execute("SELECT received_at FROM telemetics_data ORDER BY received_at DESC LIMIT 1")
last_tele = cur.fetchone()
print(f"  Total rows     : {total}")
print(f"  Last 2 min     : {last2} inserts")
print(f"  Last 5 min     : {last5} inserts")
print(f"  Unique batteries: {unique_batts}")
if r[0]:
    print(f"  Avg Temp       : {r[0]:.2f}°C")
    print(f"  Avg Voltage    : {r[1]:.2f} V")
    print(f"  Avg Current    : {r[2]:.2f} A")
    print(f"  Avg SoH        : {r[3]:.2f}%")
if last_tele:
    print(f"  Latest record  : {last_tele[0]}")

print("\n" + "=" * 60)
cur.close()
conn.close()
