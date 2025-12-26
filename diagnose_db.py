import psycopg2
import sys
import os

print("🔍 DEBUG: Starting Database Connection Test...")

# Default credentials (often used in local dev)
config = {
    "host": "localhost",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": "password", # Common default, likely incorrect for specific user
    "connect_timeout": 5
}

print(f"Attempting to connect with: host={config['host']}, port={config['port']}, user={config['user']}")

try:
    conn = psycopg2.connect(**config)
    print("✅ SUCCESS: Connected to PostgreSQL database!")
    
    # Test query
    cur = conn.cursor()
    cur.execute("SELECT version();")
    version = cur.fetchone()
    print(f"📊 Server Version: {version[0]}")
    
    cur.close()
    conn.close()
    
except psycopg2.OperationalError as e:
    print(f"❌ CONNECTION FAILED: {e}")
    print("\nPossible causes:")
    print("1. PostgreSQL service is not running.")
    print("2. Incorrect password (I used 'password' as default).")
    print("3. Database 'postgres' does not exist.")
    print("4. Firewall blocking port 5432.")
except Exception as e:
    print(f"❌ UNEXPECTED ERROR: {e}")
