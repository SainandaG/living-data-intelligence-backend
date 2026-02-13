import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.neural_core import neural_core
from app.services.wezu_agents import WEZUGridSentinel

async def test_wezu_flow():
    print("🚀 Starting WEZU Integration Test...")
    
    connection_id = "mock_wezu_db"
    
    # 1. Mock Schema with WEZU tables
    mock_schema = {
        "tables": [
            {"name": "batteries", "row_count": 500, "importance_score": 80},
            {"name": "stations", "row_count": 50, "importance_score": 90},
            {"name": "telematics_data", "row_count": 1000000, "importance_score": 70}
        ]
    }
    
    # 2. Seed Neural Core
    print("🧠 Seeding Neural Core with WEZU assets...")
    neural_core.update_schema_context(mock_schema, connection_id=connection_id)
    
    # Trigger a scan for one table
    await neural_core.process_signal("batteries", intensity=0.5, connection_id=connection_id)
    
    # Check if gravity was boosted
    gravity = neural_core.gravity_stores[connection_id].get("batteries", 0)
    print(f"📊 Gravity for 'batteries': {gravity:.2f} (Expected boost > 5.0)")
    
    # 3. Running GridSentinel patrol
    print("\n🕵️ Activating Grid Sentinel patrol...")
    sentinel = WEZUGridSentinel()
    # We pass 'mock' as connection_id in the patrol_cycle logic to trigger simulated results
    await sentinel.patrol_cycle('mock')
    
    print("\n✅ WEZU Integration Test Complete.")

if __name__ == "__main__":
    asyncio.run(test_wezu_flow())
