"""
T1 Agent - Action Execution Engine
Executes platform actions triggered by T0 Agent.
"""
from typing import Dict, Any, Optional
import time
import asyncio

from app.services.agent_state_manager import get_agent_state_manager, T1State


class T1Agent:
    """
    T1 Agent - The Action Execution Engine
    
    Responsibilities:
    - Execute graph actions (highlight, zoom, flow)
    - Execute analytics actions (anomalies, clustering)
    - Execute UI actions (show schema, reset view)
    - Manage T1 state transitions
    - Report execution results
    """
    
    def __init__(self):
        """Initialize the T1 Agent."""
        self.state_manager = get_agent_state_manager()
        
        # Action handlers registry
        self.action_handlers = {
            'graph.highlight': self._handle_highlight_node,
            'graph.zoom_cluster': self._handle_zoom_cluster,
            'graph.start_flow': self._handle_start_flow,
            'graph.stop_flow': self._handle_stop_flow,
            'graph.recalculate_gravity': self._handle_recalculate_gravity,
            'graph.reset_view': self._handle_reset_view,
            'analytics.anomaly': self._handle_run_anomaly,
            'analytics.cluster': self._handle_apply_clustering,
            'ui.show_schema': self._handle_show_schema,
            'ui.drill_down': self._handle_drill_down,
            'graph.start_evolution': self._handle_start_evolution,
            'graph.stop_evolution': self._handle_stop_evolution,
            'graph.simulate_formation': self._handle_simulate_formation,
            'graph.trace_lineage': self._handle_trace_lineage,
            'analytics.report': self._handle_system_report,
            'ui.sonify': self._handle_toggle_sonification,
            'analytics.optimize': self._handle_apply_clustering,
        }
        
        print("✅ T1 Agent initialized")
    
    async def execute_action(
        self,
        command_id: str,
        action: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a platform action.
        
        Args:
            command_id: The command ID from T0
            action: Action string (e.g., "graph.highlight")
            parameters: Action parameters
            
        Returns:
            Execution result
        """
        start_time = time.time()
        
        # Update state: IDLE → EXECUTING
        self.state_manager.update_t1_state(T1State.EXECUTING)
        
        try:
            # Get the appropriate handler
            handler = self.action_handlers.get(action)
            
            if not handler:
                raise ValueError(f"Unknown action: {action}")
            
            # Execute the action
            result = await handler(parameters)
            
            execution_time = int((time.time() - start_time) * 1000)
            
            # Update state: EXECUTING → SUCCESS
            self.state_manager.update_t1_state(T1State.SUCCESS)
            
            # Complete command tracking
            self.state_manager.complete_command(
                command_id=command_id,
                success=True,
                execution_time_ms=execution_time
            )
            
            # Back to IDLE
            self.state_manager.update_t1_state(T1State.IDLE)
            
            return {
                'success': True,
                'action': action,
                'result': result,
                'execution_time_ms': execution_time
            }
            
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            
            # Update state: EXECUTING → FAILED
            self.state_manager.update_t1_state(T1State.FAILED)
            
            # Complete command with error
            self.state_manager.complete_command(
                command_id=command_id,
                success=False,
                execution_time_ms=execution_time,
                error=str(e)
            )
            
            # Back to IDLE
            self.state_manager.update_t1_state(T1State.IDLE)
            
            print(f"❌ T1 Agent execution error: {e}")
            
            return {
                'success': False,
                'action': action,
                'error': str(e),
                'execution_time_ms': execution_time
            }
    
    # ============ GRAPH ACTION HANDLERS ============
    
    async def _handle_highlight_node(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle node highlighting action.
        
        This is a frontend action - we return instructions for the frontend to execute.
        """
        table_name = params.get('table_name')
        
        if not table_name:
            raise ValueError("Missing table_name parameter")
        
        # Simulate action (in reality, this would be handled by frontend)
        await asyncio.sleep(0.1)  # Simulate processing
        
        return {
            'action_type': 'graph_highlight',
            'target': table_name,
            'instruction': 'highlight_node',
            'message': f"Highlighted node: {table_name}"
        }
    
    async def _handle_zoom_cluster(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle cluster zoom action."""
        cluster_name = params.get('cluster_name')
        
        if not cluster_name:
            raise ValueError("Missing cluster_name parameter")
        
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'graph_zoom',
            'target': cluster_name,
            'instruction': 'zoom_to_cluster',
            'message': f"Zoomed to cluster: {cluster_name}"
        }
    
    async def _handle_start_flow(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle start data flow action."""
        await asyncio.sleep(0.05)
        
        return {
            'action_type': 'graph_flow',
            'instruction': 'start_flow',
            'message': "Started data flow animation"
        }
    
    async def _handle_stop_flow(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle stop data flow action."""
        await asyncio.sleep(0.05)
        
        return {
            'action_type': 'graph_flow',
            'instruction': 'stop_flow',
            'message': "Stopped data flow animation"
        }
    
    async def _handle_recalculate_gravity(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle gravity recalculation action."""
        await asyncio.sleep(0.2)
        
        return {
            'action_type': 'graph_layout',
            'instruction': 'recalculate_gravity',
            'message': "Recalculated node positions"
        }
    
    async def _handle_reset_view(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle reset camera view action."""
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'graph_camera',
            'target': 'overview',
            'instruction': 'reset_view',
            'message': "Reset camera to overview"
        }
    
    async def _handle_start_evolution(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle start evolution playback action."""
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'graph_evolution',
            'instruction': 'start_evolution',
            'message': "Starting temporal evolution playback"
        }
    
    async def _handle_stop_evolution(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle stop evolution playback action."""
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'graph_evolution',
            'instruction': 'stop_evolution',
            'message': "Exiting evolution mode"
        }
    
    # ============ ANALYTICS ACTION HANDLERS ============
    
    async def _handle_run_anomaly(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle anomaly detection action."""
        await asyncio.sleep(0.3)  # Simulate analysis
        
        return {
            'action_type': 'analytics',
            'instruction': 'run_anomaly_detection',
            'message': "Running anomaly detection...",
            'status': 'initiated'
        }
    
    async def _handle_apply_clustering(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle clustering action."""
        await asyncio.sleep(0.2)
        
        return {
            'action_type': 'analytics',
            'instruction': 'apply_clustering',
            'message': "Applying clustering algorithm...",
            'status': 'initiated'
        }
    
    # ============ UI ACTION HANDLERS ============
    
    async def _handle_show_schema(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle show schema action."""
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'ui_navigation',
            'instruction': 'show_schema',
            'message': "Showing schema view"
        }
    
    async def _handle_drill_down(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle drill down action."""
        table_name = params.get('table_name')
        if not table_name:
            raise ValueError("Missing table_name parameter")
            
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'ui_navigation',
            'instruction': 'drill_down',
            'target': table_name,
            'message': f"Drilling down into {table_name}"
        }
    
    async def _handle_simulate_formation(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle node formation simulation action."""
        table_name = params.get('table_name')
        
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'graph_evolution',
            'instruction': 'simulate_formation',
            'target': table_name,
            'message': f"Starting node formation simulation {'for ' + table_name if table_name else ''}"
        }
    
    async def _handle_system_report(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle system report action."""
        await asyncio.sleep(0.1)
        
        return {
            'action_type': 'analytics',
            'instruction': 'system_report',
            'message': "Generating comprehensive system report..."
        }
    
    async def _handle_toggle_sonification(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle data sonification toggle."""
        active = params.get('active', True)
        await asyncio.sleep(0.05)
        
        return {
            'action_type': 'ui_audio',
            'instruction': 'toggle_sonification',
            'target': 'active' if active else 'inactive',
            'message': f"Data sonification {'activated' if active else 'deactivated'}"
        }
    
    # ============ UTILITY METHODS ============
    
    def register_action_handler(
        self,
        action: str,
        handler: callable
    ) -> None:
        """
        Register a custom action handler.
        
        Args:
            action: Action string (e.g., "custom.action")
            handler: Async function to handle the action
        """
        self.action_handlers[action] = handler
        print(f"✅ Registered action handler: {action}")
    
    def get_available_actions(self) -> list[str]:
        """
        Get list of available actions.
        
        Returns:
            List of action strings
        """
        return list(self.action_handlers.keys())
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get current T1 agent state.
        
        Returns:
            State information dictionary
        """
        return {
            'state': self.state_manager.t1_state.value,
            'available_actions': len(self.action_handlers)
        }
    
    async def _handle_trace_lineage(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle data lineage tracing command"""
        table_name = parameters.get('table_name')
        hops = parameters.get('hops', 2)
        connection_id = parameters.get('connection_id')
        
        if not table_name:
            return {'success': False, 'error': "No table name specified for lineage trace"}
            
        if not connection_id:
            return {'success': False, 'error': "No active database connection found for lineage trace"}
            
        from app.services.graph_generator import graph_generator
        try:
            lineage = await graph_generator.get_k_hop_lineage(connection_id, table_name, hops)
            
            return {
                'success': True,
                'action_type': 'graph_trace_lineage',
                'instruction': 'trace_lineage',
                'target': table_name,
                'parameters': {
                    'lineage_nodes': lineage['lineage_nodes'],
                    'hops': hops
                }
            }
        except Exception as e:
            return {'success': False, 'error': f"Lineage trace failed: {str(e)}"}
    
    def __repr__(self) -> str:
        return f"<T1Agent state={self.state_manager.t1_state.value}>"


# Global instance
_t1_instance: Optional[T1Agent] = None


def get_t1_agent() -> T1Agent:
    """
    Get the global T1 agent instance (Singleton pattern).
    
    Returns:
        T1Agent instance
    """
    global _t1_instance
    if _t1_instance is None:
        _t1_instance = T1Agent()
    return _t1_instance
