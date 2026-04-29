import asyncio
import os
import asyncpg

async def check():
    # Load .env
    if os.path.exists(".env"):
        with open(".env") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key] = value

    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    
    try:
        conn = await asyncpg.connect(db_url)
        print("--- TABLES ---")
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        for t in tables:
            print(t['table_name'])
        
        print("\n--- ROLES ---")
        try:
            roles = await conn.fetch("SELECT * FROM roles")
            for r in roles:
                print(dict(r))
        except Exception as e:
            print(f"Error checking roles: {e}")
            
        print("\n--- USERS REQUIRED COLUMNS ---")
        try:
            columns = await conn.fetch("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'users'")
            for c in columns:
                if c['is_nullable'] == 'NO' and c['column_default'] is None:
                    print(f"REQUIRED: {c['column_name']}")
                else:
                    print(f"Optional: {c['column_name']} (Default: {c['column_default']})")
        except Exception as e:
            print(f"Error checking users columns: {e}")
            
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(check())
