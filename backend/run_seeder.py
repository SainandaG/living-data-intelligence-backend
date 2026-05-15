import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure the backend directory is in the path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Load environment variables
load_dotenv(override=True)

from app.services.db_connector import db_connector
from app.services.seeder import seeder

async def run_seeder():
    """Manually runs the database seeder."""
    print("Starting Database Seeding...")
    
    # 1. Connect to Database
    db_config = {
        "db_type": os.getenv("DB_TYPE", "postgresql"),
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT", 5432)),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
    
    if not (db_config["host"] and db_config["username"]):
        print("Error: Database credentials missing from .env")
        return

    print(f"Connecting to database: {db_config['database']}...")
    try:
        conn_info = await db_connector.connect(db_config)
        conn_id = conn_info['id']
        print(f"Database connected successfully. Connection ID: {conn_id}")
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return

    # 2. Run the seeder
    try:
        print("Seeding data...")
        result = await seeder.seed_database(conn_id)
        print(f"Seeding result: {result}")
    except Exception as e:
        print(f"Error during seeding: {e}")
    finally:
        # Cleanup connection
        await db_connector.close_all()
        print("Database disconnected.")

if __name__ == "__main__":
    try:
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_seeder())
        finally:
            loop.close()
    except KeyboardInterrupt:
        print("\nExiting...")
