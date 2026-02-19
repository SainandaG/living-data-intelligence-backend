
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.db_connector import db_connector
from app.services.drill_down import drill_down_service
from app.services.analysis_engine import analysis_engine
from app.services.gravity_engine import gravity_engine
from dotenv import load_dotenv

async def verify_drilldown():
    load_dotenv('backend/.env', override=True)
    
    print(f"🧪 Verifying Drill-Down Services...")
    
    # Establish connection first
    conn_id = "test_conn_1"
    try:
        await db_connector.connect(conn_id)
        print(f"✅ Connected to DB as {conn_id}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    test_tables = ['stations', 'STATIONS', 'organization_social_links']
    
    for table in test_tables:
        print(f"\n--- Testing Table: {table} ---")
        
        # 1. Test DrillDownService.get_table_sample
        try:
            sample = await drill_down_service.get_table_sample(conn_id, table, limit=5)
            if 'error' in sample:
                print(f"❌ DrillDown.get_table_sample failed: {sample['error']}")
            else:
                print(f"✅ DrillDown.get_table_sample: Found {sample['count']} records")
        except Exception as e:
            print(f"❌ DrillDown.get_table_sample crashed: {e}")
            
        # 2. Test AnalysisEngine.get_table_intelligence
        try:
            intel = await analysis_engine.get_table_intelligence(conn_id, table)
            if intel.get('metrics', {}).get('row_count', 0) > 0 or intel.get('proofs'):
                print(f"✅ AnalysisEngine.get_table_intelligence: Success")
            else:
                print(f"⚠️ AnalysisEngine.get_table_intelligence: Returned empty/default metrics")
        except Exception as e:
            print(f"❌ AnalysisEngine.get_table_intelligence crashed: {e}")
            
        # 3. Test GravityEngine.calculate_gravity (if column exists)
        try:
            # Helper for stations
            col = 'name' if 'station' in table.lower() else 'id'
            gravity = await gravity_engine.calculate_gravity(conn_id, table, col, limit=5)
            if gravity:
                print(f"✅ GravityEngine.calculate_gravity: Processed {len(gravity)} records")
            else:
                print(f"⚠️ GravityEngine.calculate_gravity: No data found")
        except Exception as e:
            # We expect failure if 'conn_1' is not found in a fresh script run
            # But if it's there (from main.py or previous seeding), it should work.
            print(f"❌ GravityEngine.calculate_gravity crashed/failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify_drilldown())
