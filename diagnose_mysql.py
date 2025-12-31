import pymysql
import sys

print("🔍 DEBUG: Starting MySQL Connection Test...")

# Credentials from the user's error log
config = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "", # Try empty first, user didn't specify
    "database": "f1",
    "connect_timeout": 5
}

print(f"Attempting to connect with: {config}")

try:
    conn = pymysql.connect(**config)
    print("✅ SUCCESS: Connected to MySQL database!")
    
    with conn.cursor() as cursor:
        cursor.execute("SELECT VERSION()")
        version = cursor.fetchone()
        print(f"📊 Server Version: {version[0]}")
    
    conn.close()
    
except pymysql.err.OperationalError as e:
    print(f"❌ CONNECTION FAILED: {e}")
    print("\nPossible causes:")
    print("1. MySQL service is not running.")
    print("2. Incorrect password (I used empty string).")
    print("3. Database 'f1' does not exist.")
    print("4. Firewall blocking port 3306.")
except Exception as e:
    print(f"❌ UNEXPECTED ERROR: {e}")
