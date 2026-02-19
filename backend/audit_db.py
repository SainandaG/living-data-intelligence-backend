import asyncio
import os
import json
from dotenv import load_dotenv
from app.services.db_connector import db_connector

load_dotenv()

async def audit_db():
    print("🕵️ Auditing Database...")
    
    config = {
        'db_type': 'postgres',
        'host': os.getenv('DB_HOST'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME'),
        'username': os.getenv('DB_USER'),
        'password': os.getenv('DB_PASSWORD')
    }
    
    print(f"🔌 Connecting to {config['database']}...")
    conn = await db_connector.connect(config)
    conn_id = conn['id']
    
    # 1. List all tables
    print("\n📋 All Tables:")
    tables_query = """
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name;
    """
    tables = await db_connector.query(conn_id, tables_query)
    for t in tables:
        print(f" - {t['table_schema']}.{t['table_name']}")
        if t['table_name'] == 'organization_social_links':
            print("   ⚠️ FOUND organization_social_links table!")

    # 2. Check neural snapshots
    print("\n🧠 Neural Snapshots:")
    try:
        snapshots = await db_connector.query(conn_id, "SELECT id, connection_id, snapshot_at FROM evolution.neural_snapshots ORDER BY snapshot_at DESC LIMIT 5")
        for s in snapshots:
            print(f" - Snapshot ID: {s['id']}, Connection: {s['connection_id']}, At: {s['snapshot_at']}")
            
            # Look inside the snapshot for the problematic node
            data = await db_connector.query(conn_id, f"SELECT neural_data FROM evolution.neural_snapshots WHERE id = {s['id']}")
            if data and data[0]['neural_data']:
                neural_data = data[0]['neural_data']
                if isinstance(neural_data, str):
                    neural_data = json.loads(neural_data)
                
                nodes = neural_data.get('nodes', {})
                if 'organization_social_links' in nodes:
                    print(f"   ⚠️ FOUND organization_social_links in Snapshot {s['id']} nodes!")
                
                edges = neural_data.get('edges', {})
                for eid, edata in edges.items():
                    if edata.get('source') == 'organization_social_links' or edata.get('target') == 'organization_social_links':
                        print(f"   ⚠️ FOUND organization_social_links in Snapshot {s['id']} edges: {eid}")
    except Exception as e:
        print(f" - No snapshots found or error: {e}")

    await db_connector.close_all()

if __name__ == "__main__":
    asyncio.run(audit_db())
