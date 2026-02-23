"""
WEZU Simulation Watcher — matches real Neon DB schema
Run: python watch_simulation.py
Refreshes every 15s. Simulator updates every 120s.
"""
import os, time
import psycopg2
from dotenv import load_dotenv

load_dotenv(override=True)
HOST     = os.getenv("DB_HOST", "")
USER     = os.getenv("DB_USER", "")
PASSWORD = os.getenv("DB_PASSWORD", "")
DBNAME   = os.getenv("DB_NAME", "")
PORT     = os.getenv("DB_PORT", "5432")
SSLMODE  = "require" if "neon.tech" in HOST else "prefer"
REFRESH  = 15
SEP      = "─" * 72

def connect():
    return psycopg2.connect(host=HOST, user=USER, password=PASSWORD,
                            dbname=DBNAME, port=PORT, sslmode=SSLMODE,
                            connect_timeout=10)

def q(cur, sql):
    try:
        cur.execute(sql)
        return cur.fetchone()
    except Exception:
        return None

def watch():
    print(f"\n{'═'*72}")
    print(f"  🔋 WEZU Simulation Watcher  |  {DBNAME}@{HOST[:35]}")
    print(f"  Refresh: {REFRESH}s  |  Simulator: every 120s")
    print(f"{'═'*72}\n")

    while True:
        ts = time.strftime("%H:%M:%S")
        print(f"[{ts}] Polling…")
        print(SEP)
        try:
            conn = connect()
            cur  = conn.cursor()

            # 1. batteries — real columns: temperature, voltage, current_a, soh_percentage
            row = q(cur, "SELECT COUNT(*), AVG(temperature), AVG(voltage), AVG(current_a), AVG(soh_percentage) FROM batteries")
            if row:
                cnt, temp, volt, curr, soh = row
                print(f"  🔋 {'batteries':<22} count={cnt or 0:<6} "
                      f"temp={f'{temp:.1f}°C' if temp else 'N/A':<10} "
                      f"volt={f'{volt:.2f}V' if volt else 'N/A':<10} "
                      f"curr={f'{curr:.1f}A' if curr else 'N/A':<10} "
                      f"soh={f'{soh:.2f}%' if soh else 'N/A'}")

            # 2. stations — real columns: rating, total_reviews
            row = q(cur, "SELECT COUNT(*), AVG(rating), SUM(total_reviews) FROM stations")
            if row:
                cnt, rating, reviews = row
                print(f"  🏪 {'stations':<22} count={cnt or 0:<6} "
                      f"avg_rating={f'{rating:.2f}★' if rating else 'N/A':<12} "
                      f"total_reviews={int(reviews) if reviews else 0}")

            # 3. telemetics_data — recent inserts
            row = q(cur, "SELECT COUNT(*) FROM telemetics_data")
            if row and row[0] is not None:
                row2 = q(cur, "SELECT COUNT(*) FROM telemetics_data WHERE received_at >= NOW() - INTERVAL '5 minutes'")
                recent = row2[0] if row2 else 0
                print(f"  📡 {'telemetics_data':<22} total={row[0]:<10} last_5min={recent}")

            # 4. batteryhealthlog
            row = q(cur, "SELECT COUNT(*) FROM batteryhealthlog")
            if row and row[0] is not None:
                row2 = q(cur, "SELECT COUNT(*) FROM batteryhealthlog WHERE timestamp >= NOW() - INTERVAL '5 minutes'")
                recent = row2[0] if row2 else 0
                print(f"  🩺 {'batteryhealthlog':<22} total={row[0]:<10} last_5min={recent}")



            cur.close()
            conn.close()
        except Exception as e:
            print(f"  ❌ DB error: {e}")

        print(SEP)
        print(f"  Next refresh in {REFRESH}s\n")
        time.sleep(REFRESH)

if __name__ == "__main__":
    try:
        watch()
    except KeyboardInterrupt:
        print("\n👋 Stopped.")
