
import asyncio
import json
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.neural_core import NeuralCore

async def test_neural_logic():
    print("🧠 Testing Neural Core Logic...")
    core = NeuralCore()
    
    # Mock Schema with a clear HUB ("users")
    mock_schema = {
        "tables": [
            {
                "name": "users",
                "row_count": 1000,
                "columns": ["id", "name", "email", "created_at"],
                "foreign_keys": [] # Users is referenced by others
            },
            {
                "name": "orders",
                "row_count": 5000,
                "columns": ["id", "user_id", "total", "date"],
                "foreign_keys": [{"target_table": "users"}]
            },
            {
                "name": "logs",
                "row_count": 100000,
                "columns": ["id", "user_id", "msg"],
                "foreign_keys": [{"target_table": "users"}]
            },
            {
                "name": "settings",
                "row_count": 1,
                "columns": ["id", "key", "val"],
                "foreign_keys": []
            }
        ]
    }
    
    # 1. Update Context (Should trigger Pre-calc)
    core.update_schema_context(mock_schema)
    
    # Verify Topology
    print(f"Topology In-Degree: {core.in_degree}")
    assert core.in_degree.get('users') == 2, "Users should have in-degree 2"
    assert core.in_degree.get('settings') == 0, "Settings should have in-degree 0"
    
    # 2. Process Signals (Simulate Scanning)
    for t in mock_schema['tables']:
        await core.process_signal(t['name'], 1.0)
        
    # 3. Check Gravity Scores
    scores = core.gravity_store
    print(f"\nGravity Scores:\n{json.dumps(scores, indent=2)}")
    
    # Users should be high (Hub + Decent rows)
    # Logs should be high (Huge rows)
    # Settings should be low (Low rows, no connections)
    
    assert scores['users'] > scores['settings'], "Users (Hub) must be heavier than Settings (Isolated)"
    assert scores['logs'] > scores['settings'], "Logs (High Rows) must be heavier than Settings"
    
    # 4. Decay Test
    # Create two identical nodes, one active now, one old
    from datetime import datetime, timedelta
    now_iso = datetime.now().isoformat()
    old_iso = (datetime.now() - timedelta(hours=48)).isoformat()
    
    mock_schema['tables'].append({
        "name": "recent_node", "row_count": 500, "columns": ["id"], "foreign_keys": [], "last_interaction": now_iso
    })
    mock_schema['tables'].append({
        "name": "old_node", "row_count": 500, "columns": ["id"], "foreign_keys": [], "last_interaction": old_iso
    })
    
    # Re-run for new nodes
    core.update_schema_context(mock_schema)
    await core.process_signal("recent_node", 1.0)
    await core.process_signal("old_node", 1.0)
    
    scores = core.gravity_store
    print(f"Recent Score: {scores['recent_node']}")
    print(f"Old Score:    {scores['old_node']}")
    
    assert scores['recent_node'] > scores['old_node'], "Recent node should have higher gravity due to time decay"

    print("\n✅ Verification Passed: Neural Logic is sound.")

if __name__ == "__main__":
    asyncio.run(test_neural_logic())
