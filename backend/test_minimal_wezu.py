import asyncio
import sys
import os
import math

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.neural_core import NeuralCore

async def test_minimal_wezu():
    print("🚀 Starting Minimal WEZU Ontology Test...")
    
    # Instantiate a fresh core to avoid global state pollution
    core = NeuralCore()
    connection_id = "test_wezu"
    
    # 1. Mock Schema
    mock_schema = {
        "tables": [
            {"name": "batteries", "row_count": 500, "columns": [{"name": "id"}], "foreign_keys": []},
            {"name": "other_table", "row_count": 500, "columns": [{"name": "id"}], "foreign_keys": []}
        ]
    }
    
    # 2. Update context
    core.update_schema_context(mock_schema, connection_id=connection_id)
    
    # 3. Process signals
    print("🧠 Processing signals...")
    await core.process_signal("batteries", intensity=0.5, connection_id=connection_id)
    await core.process_signal("other_table", intensity=0.5, connection_id=connection_id)
    
    # 4. Check results
    batt_gravity = core.gravity_stores[connection_id].get("batteries", 0)
    other_gravity = core.gravity_stores[connection_id].get("other_table", 0)
    
    print(f"📊 Gravity for 'batteries': {batt_gravity:.2f}")
    print(f"📊 Gravity for 'other_table': {other_gravity:.2f}")
    
    if batt_gravity > other_gravity:
        print("✅ SUCCESS: WEZU 'batteries' correctly boosted by ontology.")
    else:
        print("❌ FAILURE: No ontology boost detected.")

if __name__ == "__main__":
    asyncio.run(test_minimal_wezu())
