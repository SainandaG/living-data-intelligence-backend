import psycopg2, os
from dotenv import load_dotenv
load_dotenv(override=True)
conn = psycopg2.connect(host=os.getenv('DB_HOST'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), dbname=os.getenv('DB_NAME'), port=os.getenv('DB_PORT','5432'), sslmode='require')
cur = conn.cursor()
cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='rentals' ORDER BY ordinal_position")
cols = cur.fetchall()
print('--- rentals table columns ---')
for col in cols: print(f"  {col[0]:<20} {col[1]:<20} {col[2]}")
cur.close()
conn.close()
