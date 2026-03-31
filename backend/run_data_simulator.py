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
from app.services.data_simulator import data_simulator

async def run_simulation():
    """Manually runs the data simulation process."""
    print("🚀 Starting Manual Data Simulation...")
    
    # 1. Connect to Database
    db_config = {
        "db_type": "postgres",
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
    
    if not (db_config["host"] and db_config["username"]):
        print("❌ Error: Database credentials missing from .env")
        return

    print(f"🔌 Connecting to database: {db_config['database']}...")
    await db_connector.connect(db_config)
    print("✅ Database connected successfully.")

    # 2. Run the simulation
    try:
        print("⚡ Triggering the simulation loop... Press Ctrl+C to stop.")
        # Start the simulation task
        simulation_task = asyncio.create_task(data_simulator.start_simulation())
        
        # Keep the script running to allow the background task to execute
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Stopping Data Simulator...")
        data_simulator.stop_simulation()
        if 'simulation_task' in locals():
            simulation_task.cancel()
    except Exception as e:
        print(f"⚠️ Error running simulation: {e}")
    finally:
        # Cleanup connection
        await db_connector.close_all()
        print("👋 Simulation finished. Database disconnected.")

if __name__ == "__main__":
    try:
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(run_simulation())
    except KeyboardInterrupt:
        print("\n👋 Exiting...")
