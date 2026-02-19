
import sys
import os
import asyncio
import traceback

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

async def test():
    print("🚀 Starting Debug Script")
    try:
        from app.services.db_connector import db_connector
        print("✅ DB Connector imported")
        
        from app.services.neural_core import neural_core
        print("✅ Neural Core imported")
        
        from app.services.analysis_engine import analysis_engine
        print("✅ Analysis Engine imported")
        
        conn_id = "test_conn_1"
        try:
            await db_connector.connect(conn_id)
            print("✅ DB Connected")
        except:
            print("⚠️ DB Connection failed (expected if no DB)")
            pass
            
        print("🔍 calling get_table_intelligence...")
        try:
            res = await analysis_engine.get_table_intelligence(conn_id, "stations")
            print("✅ Result:", res)
        except Exception:
            traceback.print_exc()

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
