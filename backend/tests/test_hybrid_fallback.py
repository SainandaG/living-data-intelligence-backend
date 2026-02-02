
import pytest
import asyncio
from unittest.mock import MagicMock, patch
from backend.app.services.t1_agent import T1Agent

@pytest.mark.asyncio
async def test_hybrid_fallback_logic():
    """
    Test that T1Agent falls back to legacy handler if modular handler crashes.
    """
    # 1. Setup Agent with Modular Handlers ENABLED
    with patch('backend.app.services.t1_agent.USE_MODULAR_HANDLERS', True):
        agent = T1Agent()
        
        # 2. sabotage the modular handler for 'graph.highlight'
        agent.modular_handler_map['graph.highlight'].handle = MagicMock(side_effect=Exception("New Feature Crash!"))
        
        # 3. Execute Action
        result = await agent.execute_action(
            command_id="test_cmd_1",
            action="graph.highlight",
            parameters={"table_name": "users"}
        )
        
        # 4. Verify Success (Logic should have fallen back to legacy and succeeded)
        assert result['success'] is True
        assert result['result']['action_type'] == 'graph_highlight'
        print("✅ Hybrid Validation Passed: System recovered from modular crash and used legacy code.")
