import psycopg2, os, random
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv(override=True)

conn = psycopg2.connect(host=os.getenv('DB_HOST'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), dbname=os.getenv('DB_NAME'), port=os.getenv('DB_PORT','5432'), sslmode='require')
cur = conn.cursor()

# Get 50 batteries and stations
cur.execute("SELECT id FROM batteries LIMIT 50")
b_ids = [r[0] for r in cur.fetchall()]
cur.execute("SELECT id FROM stations LIMIT 50")
s_ids = [r[0] for r in cur.fetchall()]

# Need some users
cur.execute("SELECT id FROM users LIMIT 50")
u_ids = [r[0] for r in cur.fetchall()]
if not u_ids:
    print("No users found, creating dummy user...")
    cur.execute("INSERT INTO users (email, password_hash, first_name, last_name, phone_number, is_active, is_verified, created_at) VALUES ('dummy@rent.com', 'hash', 'Dummy', 'Renter', '123456', true, true, NOW()) RETURNING id")
    u_ids = [cur.fetchone()[0]]

print(f"Seeding 50 active rentals...")
inserted = 0
for i in range(50):
    try:
        b_id = b_ids[i % len(b_ids)]
        u_id = random.choice(u_ids)
        s_id = random.choice(s_ids)
        start = datetime.now() - timedelta(hours=random.randint(1, 48))
        
        cur.execute("""
            INSERT INTO rentals (
                user_id, battery_id, pickup_station_id, status, start_time, 
                total_price, rental_duration_days, daily_rate, damage_deposit, 
                discount_amount, late_fee_amount, late_fee_applicable, 
                pickup_verified, return_verified
            ) VALUES (
                %s, %s, %s, 'ACTIVE', %s, 
                500.0, 7, 50.0, 1000.0, 
                0.0, 0.0, false, 
                true, false
            ) ON CONFLICT DO NOTHING
        """, (u_id, b_id, s_id, start))
        inserted += 1
    except Exception as e:
        print(f"Error on rental {i}: {e}")
        conn.rollback()

conn.commit()
print(f"✅ Inserted {inserted} active rentals.")

cur.execute("SELECT id, battery_id FROM rentals WHERE status='ACTIVE' LIMIT 10")
print("Active Rentals sample:", cur.fetchall())

cur.close(); conn.close()
