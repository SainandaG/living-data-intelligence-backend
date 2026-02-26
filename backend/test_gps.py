import psycopg2, os
from dotenv import load_dotenv
load_dotenv(override=True)
try:
    conn = psycopg2.connect(host=os.getenv('DB_HOST'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), dbname=os.getenv('DB_NAME'), port=os.getenv('DB_PORT','5432'), sslmode='require')
    cur = conn.cursor()

    cur.execute("SELECT id, battery_id FROM rentals WHERE status='ACTIVE' LIMIT 1")
    row = cur.fetchone()
    if row:
        r_id, b_id = row
        print(f"Using rental_id={r_id}, battery_id={b_id}")
        try:
            cur.execute(f"""
                INSERT INTO gps_tracking_log
                    (rental_id, battery_id, latitude, longitude, speed,
                     heading, accuracy, altitude,
                     is_mock_location, provider, timestamp)
                VALUES ({r_id}, {b_id}, 17.0, 78.0, 40.0,
                        0, 10.0, 0.0,
                        false, 'GPS', NOW())
            """)
            conn.commit()
            print('✅ Insert successful')
        except Exception as e:
            print(f'❌ ERROR: {e}')
    else:
        print('No active rentals found.')
    conn.close()
except Exception as e:
    print(f"Connection error: {e}")
