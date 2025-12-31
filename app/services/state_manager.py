"""
State Manager
Handles persistence and versioning of Neural Core state.
"""
import os
import json
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import asdict
from app.models.state_models import NeuralCoreState


class StateManager:
    """Manages state persistence and versioning"""
    
    def __init__(self, storage_path: str = "./neural_state"):
        self.storage_path = storage_path
        self.states: Dict[str, NeuralCoreState] = {}
        
        # Create storage directory if it doesn't exist
        os.makedirs(storage_path, exist_ok=True)
    
    def save_state(self, state: NeuralCoreState):
        """Persist state to disk with versioning"""
        try:
            filepath = os.path.join(
                self.storage_path, 
                f"{state.connection_id}_v{state.state_version}.json"
            )
            
            # Convert state to dict, handling datetime and set serialization
            state_dict = self._serialize_state(state)
            
            with open(filepath, 'w') as f:
                json.dump(state_dict, f, indent=2, default=str)
            
            print(f"💾 State saved: {filepath}")
            
            # Cleanup old versions (keep last 100)
            self._cleanup_old_versions(state.connection_id)
            
        except Exception as e:
            print(f"❌ Error saving state: {e}")
    
    def load_state(self, connection_id: str) -> Optional[NeuralCoreState]:
        """Load most recent state from disk"""
        try:
            # Find all versions for this connection
            versions = self._get_versions(connection_id)
            
            if not versions:
                return None
            
            # Load latest version
            latest_version = max(versions)
            filepath = os.path.join(
                self.storage_path,
                f"{connection_id}_v{latest_version}.json"
            )
            
            with open(filepath, 'r') as f:
                state_dict = json.load(f)
            
            # Deserialize state
            state = self._deserialize_state(state_dict)
            
            print(f"📂 State loaded: {filepath}")
            return state
            
        except Exception as e:
            print(f"⚠️ Error loading state: {e}")
            return None
    
    def get_state_history(self, connection_id: str, limit: int = 10) -> List[NeuralCoreState]:
        """Retrieve state history for analysis"""
        versions = self._get_versions(connection_id)
        
        if not versions:
            return []
        
        # Get last N versions
        recent_versions = sorted(versions, reverse=True)[:limit]
        
        states = []
        for version in recent_versions:
            filepath = os.path.join(
                self.storage_path,
                f"{connection_id}_v{version}.json"
            )
            
            try:
                with open(filepath, 'r') as f:
                    state_dict = json.load(f)
                state = self._deserialize_state(state_dict)
                states.append(state)
            except Exception as e:
                print(f"⚠️ Error loading version {version}: {e}")
        
        return states
    
    def _get_versions(self, connection_id: str) -> List[int]:
        """Get all version numbers for a connection"""
        versions = []
        
        for filename in os.listdir(self.storage_path):
            if filename.startswith(f"{connection_id}_v") and filename.endswith('.json'):
                try:
                    version_str = filename.replace(f"{connection_id}_v", "").replace(".json", "")
                    versions.append(int(version_str))
                except ValueError:
                    continue
        
        return versions
    
    def _cleanup_old_versions(self, connection_id: str, keep_count: int = 100):
        """Remove old versions, keeping only the most recent"""
        versions = self._get_versions(connection_id)
        
        if len(versions) <= keep_count:
            return
        
        # Sort and get versions to delete
        versions_to_delete = sorted(versions)[:-keep_count]
        
        for version in versions_to_delete:
            filepath = os.path.join(
                self.storage_path,
                f"{connection_id}_v{version}.json"
            )
            try:
                os.remove(filepath)
                print(f"🗑️ Cleaned up old version: v{version}")
            except Exception as e:
                print(f"⚠️ Error deleting version {version}: {e}")
    
    def _serialize_state(self, state: NeuralCoreState) -> dict:
        """Convert state to JSON-serializable dict"""
        state_dict = asdict(state)
        
        # Handle datetime serialization
        state_dict['last_updated'] = state.last_updated.isoformat()
        
        if state.session:
            state_dict['session']['start_time'] = state.session.start_time.isoformat()
            # Convert sets to lists
            state_dict['session']['nodes_visited'] = list(state.session.nodes_visited)
            state_dict['session']['edges_explored'] = list(state.session.edges_explored)
        
        # Handle node states
        for node_id, node in state_dict['nodes'].items():
            if node['last_interaction']:
                node['last_interaction'] = node['last_interaction'].isoformat()
        
        # Handle anomalies
        for anomaly in state_dict['active_anomalies']:
            anomaly['timestamp'] = anomaly['timestamp'].isoformat()
        
        return state_dict
    
    def _deserialize_state(self, state_dict: dict) -> NeuralCoreState:
        """Convert dict back to NeuralCoreState"""
        from app.models.state_models import NodeState, EdgeState, AnomalyState, UserSessionState
        
        # Parse datetime
        state_dict['last_updated'] = datetime.fromisoformat(state_dict['last_updated'])
        
        # Parse session
        if state_dict.get('session'):
            session_dict = state_dict['session']
            session_dict['start_time'] = datetime.fromisoformat(session_dict['start_time'])
            session_dict['nodes_visited'] = set(session_dict['nodes_visited'])
            session_dict['edges_explored'] = set(session_dict['edges_explored'])
            state_dict['session'] = UserSessionState(**session_dict)
        
        # Parse nodes
        nodes = {}
        for node_id, node_dict in state_dict['nodes'].items():
            if node_dict.get('last_interaction'):
                node_dict['last_interaction'] = datetime.fromisoformat(node_dict['last_interaction'])
            nodes[node_id] = NodeState(**node_dict)
        state_dict['nodes'] = nodes
        
        # Parse edges
        edges = {}
        for edge_id, edge_dict in state_dict['edges'].items():
            edges[edge_id] = EdgeState(**edge_dict)
        state_dict['edges'] = edges
        
        # Parse anomalies
        anomalies = []
        for anomaly_dict in state_dict['active_anomalies']:
            anomaly_dict['timestamp'] = datetime.fromisoformat(anomaly_dict['timestamp'])
            anomalies.append(AnomalyState(**anomaly_dict))
        state_dict['active_anomalies'] = anomalies
        
        return NeuralCoreState(**state_dict)


# Global instance
state_manager = StateManager()
