
import asyncio
import os
from dotenv import load_dotenv
from app.services.db_connector import db_connector
from app.services.data_flow_analyzer import data_flow_analyzer

load_dotenv('backend/.env', override=True)

async def test_case_insensitivity():
    results = []
    config = {
        'db_type': 'postgres',
        'host': os.getenv("DB_HOST"),
        'port': os.getenv("DB_PORT", 5432),
        'username': os.getenv("DB_USER"),
        'password': os.getenv("DB_PASSWORD"),
        'database': os.getenv("DB_NAME")
    }
    
    try:
        results.append("[INFO] Connecting...")
        conn_info = await db_connector.connect(config)
        conn_id = conn_info['id']
        
        results.append(f"[SCAN] Testing 'stations'...")
        flow1 = await data_flow_analyzer.analyze_table_flow(conn_id, "stations")
        if 'error' in flow1:
            results.append(f"[FAIL] 'stations' failed: {flow1['error']}")
        else:
            results.append(f"[SUCCESS] 'stations' success! Nodes: {len(flow1['nodes'])}")
            
        results.append(f"[SCAN] Testing 'STATIONS'...")
        flow2 = await data_flow_analyzer.analyze_table_flow(conn_id, "STATIONS")
        if 'error' in flow2:
            results.append(f"[FAIL] 'STATIONS' failed: {flow2['error']}")
        else:
            results.append(f"[SUCCESS] 'STATIONS' success! Nodes: {len(flow2['nodes'])}")
            
        results.append(f"[SCAN] Testing 'organization_social_links'...")
        flow3 = await data_flow_analyzer.analyze_table_flow(conn_id, "organization_social_links")
        if 'error' in flow3:
            results.append(f"[FAIL] 'organization_social_links' failed: {flow3['error']}")
        else:
            results.append(f"[SUCCESS] 'organization_social_links' success! Nodes: {len(flow3['nodes'])}")
            
        if not ('error' in flow1 or 'error' in flow2 or 'error' in flow3):
            results.append("[VERIFIED] All tables resolved correctly.")
            
    except Exception as e:
        results.append(f"[ERROR] Test crashed: {e}")
    finally:
        await db_connector.close_all()
        with open("verification_results.tmp", "w", encoding='utf-8') as f:
            f.write("\n".join(results))
        print("Results written to verification_results.tmp")

if __name__ == "__main__":
    asyncio.run(test_case_insensitivity())
