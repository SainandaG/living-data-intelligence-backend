
import asyncio
import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql

# Load environment variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT", "5432")

WEZU_TABLES = [
    "batteries",
    "stations",
    "bess_units",
    "warehouses",
    "battery_health_log",
    "gps_tracking_log",
    "grid_metrics",
    "telematics_data",
    "swap_transactions"
]

def check_tables():
    print(f"🔌 Connecting to {DB_HOST} ({DB_NAME})...")
    
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            sslmode='require'
        )
        cur = conn.cursor()
        
        print("✅ Connected successfully.")
        print("-" * 40)
        print(f"{'TABLE NAME':<25} | {'STATUS':<15} | {'ROWS'}")
        print("-" * 40)
        
        found_count = 0
        missing_count = 0
        
        for table in WEZU_TABLES:
            # Check if table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                );
            """, (table,))
            exists = cur.fetchone()[0]
            
            if exists:
                # Get row count
                cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                count = cur.fetchone()[0]
                status = "✅ Found"
                found_count += 1
            else:
                count = "-"
                status = "❌ Missing"
                missing_count += 1
                
            print(f"{table:<25} | {status:<15} | {count}")
            
        print("-" * 40)
        print(f"Summary: {found_count} found, {missing_count} missing.")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Connection or Query Failed: {e}")

if __name__ == "__main__":
    check_tables()
