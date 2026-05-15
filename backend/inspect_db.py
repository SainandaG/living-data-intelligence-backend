import asyncio
import os
import sys
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

load_dotenv(override=True)

from app.services.db_connector import db_connector

async def main():
    db_config = {
        "db_type": os.getenv("DB_TYPE", "postgresql"),
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT", 5432)),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
    
    conn_info = await db_connector.connect(db_config)
    conn_id = conn_info['id']
    
    print("Checking columns of 'users' table...")
    try:
        results = await db_connector.query(conn_id, """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """)
        for r in results:
            print(f"Column: {r['column_name']}, Type: {r['data_type']}")
    except Exception as e:
        print(f"Error: {e}")
        
    await db_connector.close_all()

if __name__ == "__main__":
    asyncio.run(main())
