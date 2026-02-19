import asyncio
import os
from dotenv import load_dotenv
from app.services.db_connector import db_connector
from app.services.schema_analyzer import schema_analyzer

load_dotenv()

async def verify():
    print("🕵️ Verifying Schema Visibility...")
    
    # 1. Simulate Connection
    config = {
        'db_type': os.getenv('DB_TYPE', 'mysql'),
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'database': os.getenv('DB_NAME', 'aw'), 
        'username': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', '')
    }
    
    print(f"🔌 Connecting to {config['database']} on {config['host']}...")
    conn = await db_connector.connect(config)
    conn_id = conn['id']
    
    # 2. Analyze Schema
    print("🔍 Analyzing Schema...")
    schema = await schema_analyzer.analyze_schema(conn_id)
    
    # 3. Check for WEZU tables
    tables = [t.name for t in schema.tables]
    wezu_tables = ['batteries', 'grid_metrics', 'bess_units']
    
    print(f"\n📊 Found {len(tables)} tables.")
    found = []
    missing = []
    
    for w in wezu_tables:
        if w in tables:
            found.append(w)
        else:
            missing.append(w)
            
    print(f"\n✅ Found WEZU Tables: {found}")
    if missing:
        print(f"❌ Missing WEZU Tables: {missing}")
    else:
        print("🎉 SUCCESS: All WEZU tables are visible to the backend logic!")
        
    await db_connector.close_all()

if __name__ == "__main__":
    asyncio.run(verify())
