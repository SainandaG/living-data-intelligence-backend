import asyncio
import os
from dotenv import load_dotenv
import asyncpg

async def test_conn():
    load_dotenv(override=True)
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", 5432)
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    
    print(f"Testing connection to {db_host}:{db_port} as {db_user} for database {db_name}...")
    
    try:
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            database=db_name,
            ssl='require' if 'neon.tech' in db_host else 'prefer',
            timeout=30
        )
        print("✅ Connection successful!")
        val = await conn.fetchval("SELECT 1")
        print(f"✅ Query successful: SELECT 1 returned {val}")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_conn())
