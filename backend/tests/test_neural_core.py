
import pytest
import asyncio
from datetime import datetime, timedelta

@pytest.mark.asyncio
async def test_neural_topology_building(neural_core, mock_schema):
    """Test that Neural Core correctly builds graph topology from schema"""
    connection_id = "test_conn_1"
    
    # Initialize
    neural_core.update_schema_context(mock_schema, connection_id)
    
    # Check In-Degrees (Users is referenced by Orders and Logs)
    # Note: Accessing internal state directly for white-box testing
    in_degree = neural_core.in_degrees.get(connection_id, {})
    
    assert in_degree.get('users') == 2, "Users should have in-degree 2 (Orders + Logs)"
    assert in_degree.get('settings') == 0, "Settings should have in-degree 0"

@pytest.mark.asyncio
async def test_gravity_calculation(neural_core, mock_schema):
    """Test gravity score logic"""
    connection_id = "test_conn_2"
    neural_core.update_schema_context(mock_schema, connection_id)
    
    # Process signals to simulate scanning
    for t in mock_schema['tables']:
        await neural_core.process_signal(t['name'], 1.0, connection_id=connection_id)
        
    gravity = neural_core.gravity_stores.get(connection_id, {})
    
    # Assertions based on business logic:
    # Users: Central Hub -> High Gravity
    # Logs: Massive Rows -> High Gravity
    # Settings: Isolated + Small -> Low Gravity
    
    assert gravity['users'] > gravity['settings'], "Hub node (Users) must have higher gravity than isolated node"
    assert gravity['logs'] > gravity['settings'], "High-volume node (Logs) must have higher gravity than small node"

@pytest.mark.asyncio
async def test_time_decay_logic(neural_core, mock_schema):
    """Test that older nodes decay in gravity over time"""
    connection_id = "test_conn_3"
    
    now_iso = datetime.now().isoformat()
    # 48 hours ago
    old_iso = (datetime.now() - timedelta(hours=48)).isoformat()
    
    # Add time-variant nodes to schema
    mock_schema['tables'].append({
        "name": "recent_node", 
        "row_count": 500, 
        "columns": [], 
        "foreign_keys": [], 
        "last_interaction": now_iso
    })
    mock_schema['tables'].append({
        "name": "old_node", 
        "row_count": 500, 
        "columns": [], 
        "foreign_keys": [], 
        "last_interaction": old_iso
    })
    
    neural_core.update_schema_context(mock_schema, connection_id)
    
    # Analyze
    await neural_core.process_signal("recent_node", 1.0, connection_id=connection_id)
    await neural_core.process_signal("old_node", 1.0, connection_id=connection_id)
    
    gravity = neural_core.gravity_stores.get(connection_id, {})
    
    assert gravity['recent_node'] > gravity['old_node'], "Recent interactions should imply higher gravity than old ones"

