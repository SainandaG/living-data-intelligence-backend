
import asyncio
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')

def audit_all_schemas():
    host = os.getenv("DB_HOST")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    database = os.getenv("DB_NAME")
    port = os.getenv("DB_PORT", 5432)

    print(f"🕵️ Auditing ALL schemas in {database} at {host}...")
    try:
        conn = psycopg2.connect(
            host=host,
            database=database,
            user=user,
            password=password,
            port=port,
            sslmode='require'
        )
        cur = conn.cursor()
        
        # 1. List all tables in ALL schemas
        cur.execute("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name;
        """)
        tables = cur.fetchall()
        print(f"\nFound {len(tables)} tables in total:")
        
        found_ghost = False
        for schema, table in tables:
            if 'social_links' in table.lower():
                print(f"❌ FOUND '{table}' in schema '{schema}'")
                found_ghost = True
            # else:
            #     print(f"  - {schema}.{table}")
        
        if not found_ghost:
            print("✅ No 'social_links' related tables found in any schema.")

        # 2. Check for the specific ghost in evolution.neural_snapshots (RE-VERIFY)
        print("\nChecking evolution.neural_snapshots for the ghost reference again...")
        try:
            cur.execute("SELECT neural_data FROM evolution.neural_snapshots WHERE neural_data::text LIKE '%social_links%';")
            rows = cur.fetchall()
            print(f"Found {len(rows)} snapshots containing 'social_links'.")
        except:
            print("Failed to check neural_snapshots (maybe table doesn't exist yet)")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error during audit: {e}")

if __name__ == "__main__":
    audit_all_schemas()
