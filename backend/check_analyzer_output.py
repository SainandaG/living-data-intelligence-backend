
import asyncio
import sys
import os

# Add current directory and backend to path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.services.schema_analyzer import schema_analyzer
from backend.app.services.db_connector import db_connector
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def check_analyzer_output():
    # We need a connection ID. 
    # Usually the app uses a UUID, but we can try to find an active one or use 'default' if it works
    # However, db_connector might need to connect first.
    
    config = {
        'db_type': 'postgres',
        'host': os.getenv("DB_HOST"),
        'port': os.getenv("DB_PORT", 5432),
        'user': os.getenv("DB_USER"),
        'password': os.getenv("DB_PASSWORD"),
        'database': os.getenv("DB_NAME")
    }
    
    # Connect
    conn_info = await db_connector.connect(config)
    conn_id = conn_info['id']
    
    print(f"🕵️ Analyzing schema for {conn_id}...")
    schema = await schema_analyzer.analyze_schema(conn_id)
    
    table_names = [t.name for t in schema.tables]
    print(f"\nFound {len(table_names)} tables in analyzer output.")
    
    if 'organization_social_links' in table_names:
        print("✅ analyzer found 'organization_social_links'!")
    else:
        print("❌ analyzer DID NOT find 'organization_social_links'!")
        # Let's print similar names
        similars = [n for n in table_names if 'social' in n.lower()]
        if similars:
            print(f"Similar tables found: {similars}")

if __name__ == "__main__":
    asyncio.run(check_analyzer_output())
