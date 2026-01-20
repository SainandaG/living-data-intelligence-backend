
import asyncio
import json
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.neural_core import NeuralCore
from app.services.db_connector import db_connector

async def verify_persistence():
    print("Verifying Neural State Persistence to DB...")
    sys.stdout.flush()
    
    # Use environment variables for connection info
    from dotenv import load_dotenv
    env_path = 'backend/.env'
    print(f"Loading env from {env_path}")
    load_dotenv(env_path)
    
    db_host = os.getenv("DB_HOST")
    db_name = os.getenv("DB_NAME")
    print(f"Connecting to {db_name} on {db_host}...")
    sys.stdout.flush()

    config = {
        "db_type": "neon",
        "host": db_host,
        "port": int(os.getenv("DB_PORT", 5432)),
        "database": db_name,
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD")
    }
    
    # 1. Connect
    try:
        conn_info = await db_connector.connect(config)
        connection_id = conn_info['id']
        print(f"Connected! CID: {connection_id}")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # 2. Setup NeuralCore with a dummy schema
    core = NeuralCore()
    mock_schema = {
        "tables": [
            {"name": "persistence_test", "columns": ["id"], "foreign_keys": []}
        ]
    }
    core.update_schema_context(mock_schema)
    
    # 3. Simulate process_signal
    print("Processing signal...")
    await core.process_signal(connection_id, 1.0)
    
    # 3b. Manually trigger for verification (ensures table exists)
    print("Manually triggering save_snapshot...")
    await core.save_snapshot(connection_id)
    
    print("Waiting for final sync...")
    await asyncio.sleep(2)
    sys.stdout.flush()
    
    # 4. Check DB for the record
    print("Querying neural_snapshots table...")
    sql = "SELECT id, snapshot_at, core_metrics FROM neural_snapshots WHERE connection_id = %s ORDER BY snapshot_at DESC LIMIT 1"
    try:
        results = await db_connector.query(connection_id, sql, (connection_id,))
        if not results:
            print("FAILED: No snapshot record found in DB.")
        else:
            record = results[0]
            print(f"PASSED: Found snapshot {record['id']} from {record['snapshot_at']}")
            print(f"Metrics: {record['core_metrics']}")
    except Exception as e:
        print(f"ERROR during query: {e}")

if __name__ == "__main__":
    # Ensure UTF-8
    if sys.platform == "win32":
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    asyncio.run(verify_persistence())
