import asyncio
import os
import sys
from datetime import datetime
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
    
    print("Connecting to database...")
    try:
        conn_info = await db_connector.connect(db_config)
        conn_id = conn_info['id']
        print(f"Connected! Connection ID: {conn_id}")
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    try:
        # Insert a fresh user
        print("Inserting fresh user...")
        await db_connector.query(conn_id, """
            INSERT INTO evolution.users (username, email, created_at) 
            VALUES ($1, $2, $3) 
            ON CONFLICT DO NOTHING
        """, "fresh_user", "fresh@example.com", datetime.now())
        
        # Insert a fresh transaction
        print("Inserting fresh transaction...")
        # We need an order_id. Let's find one or use None if allowed (nullable)
        # In seeder.py, order_id is integer. Let's check if it's nullable.
        # Line 107: order_id INTEGER,
        # It doesn't say NOT NULL, so it should be nullable.
        await db_connector.query(conn_id, """
            INSERT INTO evolution.transactions (order_id, amount, recorded_at) 
            VALUES ($1, $2, $3)
        """, None, 99.99, datetime.now())
        
        print("Fresh data inserted successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db_connector.close_all()
        print("Disconnected.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main())
    finally:
        loop.close()
