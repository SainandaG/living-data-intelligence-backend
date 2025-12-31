"""
Agent System
Defines agent framework and implements specialized agents.
Agents observe state and execute actions decided by Neural Core.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List
from datetime import datetime
import numpy as np

from app.models.state_models import NeuralCoreState, Action, ActionType


class Agent(ABC):
    """Base class for all agents"""
    
    def __init__(self, agent_id: str, neural_core: 'NeuralCore'):
        self.agent_id = agent_id
        self.neural_core = neural_core
        self.observations_count = 0
    
    @abstractmethod
    async def observe(self, state: NeuralCoreState) -> Dict[str, Any]:
        """
        Observe the current state and return observations.
        Agents MUST NOT make decisions here.
        """
        pass
    
    @abstractmethod
    async def execute(self, action: Action, state: NeuralCoreState) -> Dict[str, Any]:
        """
        Execute an action decided by Neural Core.
        Return execution result for feedback.
        """
        pass


class SchemaObserverAgent(Agent):
    """Observes schema changes and structural patterns"""
    
    async def observe(self, state: NeuralCoreState) -> Dict[str, Any]:
        observations = {
            'agent_id': self.agent_id,
            'timestamp': datetime.now(),
            'observations': []
        }
        
        # Detect structural anomalies
        for node_id, node in state.nodes.items():
            # Orphan tables (no FK relationships)
            if node.fk_count == 0 and node.entity_type == 'fact':
                observations['observations'].append({
                    'type': 'structural_anomaly',
                    'severity': 'medium',
                    'node_id': node_id,
                    'reason': 'Fact table with no foreign keys'
                })
            
            # Oversized tables
            if node.row_count > 10_000_000:
                observations['observations'].append({
                    'type': 'scale_concern',
                    'severity': 'low',
                    'node_id': node_id,
                    'reason': f'Large table: {node.row_count:,} rows'
                })
            
            # Tables with many columns (potential denormalization)
            if node.column_count > 50:
                observations['observations'].append({
                    'type': 'structural_anomaly',
                    'severity': 'low',
                    'node_id': node_id,
                    'reason': f'Wide table: {node.column_count} columns'
                })
        
        self.observations_count += len(observations['observations'])
        return observations
    
    async def execute(self, action: Action, state: NeuralCoreState):
        # Schema agent doesn't execute actions, only observes
        return {'status': 'no_action'}


class UserBehaviorAgent(Agent):
    """Tracks user interactions and infers intent"""
    
    async def observe(self, state: NeuralCoreState) -> Dict[str, Any]:
        if not state.session:
            return {'observations': []}
        
        observations = {
            'agent_id': self.agent_id,
            'observations': []
        }
        
        session = state.session
        
        # Detect exploration patterns
        if session.exploration_depth > 3:
            observations['observations'].append({
                'type': 'deep_exploration',
                'severity': 'info',
                'reason': f'User drilling down {session.exploration_depth} levels',
                'suggestion': 'User is investigating something specific'
            })
        
        # Detect focus on specific node
        if session.focused_node:
            node = state.nodes.get(session.focused_node)
            if node and node.click_count > 3:
                observations['observations'].append({
                    'type': 'high_interest',
                    'node_id': session.focused_node,
                    'reason': f'Node clicked {node.click_count} times',
                    'suggestion': 'Offer detailed analysis or related nodes'
                })
        
        # Detect if user is stuck (many clicks but low exploration)
        if len(session.nodes_visited) > 10 and session.exploration_depth < 2:
            observations['observations'].append({
                'type': 'user_stuck',
                'severity': 'info',
                'reason': 'User visiting many nodes but not drilling down',
                'suggestion': 'Suggest drill-down or provide guidance'
            })
        
        self.observations_count += len(observations['observations'])
        return observations
    
    async def execute(self, action: Action, state: NeuralCoreState):
        # Execution handled by frontend, this agent just tracks
        return {'status': 'tracked'}


class AnomalyDetectionAgent(Agent):
    """Detects statistical anomalies in metrics"""
    
    def __init__(self, agent_id: str, neural_core: 'NeuralCore'):
        super().__init__(agent_id, neural_core)
        self.baseline_metrics: Dict[str, List[float]] = {}
        self.z_threshold = 3.0
    
    async def observe(self, state: NeuralCoreState) -> Dict[str, Any]:
        observations = {'observations': []}
        
        # Collect current metrics
        current_metrics = self._collect_metrics(state)
        
        # Compare against baseline
        for metric_name, value in current_metrics.items():
            if metric_name not in self.baseline_metrics:
                self.baseline_metrics[metric_name] = []
            
            baseline = self.baseline_metrics[metric_name]
            if len(baseline) < 10:
                # Building baseline
                baseline.append(value)
                continue
            
            # Calculate Z-score
            mean = np.mean(baseline)
            std = np.std(baseline)
            
            if std > 0:
                z_score = abs((value - mean) / std)
                
                if z_score > self.z_threshold:
                    severity = 'critical' if z_score > 5 else 'high' if z_score > 4 else 'medium'
                    observations['observations'].append({
                        'type': 'statistical_anomaly',
                        'severity': severity,
                        'metric_name': metric_name,
                        'current_value': value,
                        'expected_range': (mean - 2*std, mean + 2*std),
                        'z_score': z_score
                    })
            
            # Update baseline (rolling window)
            baseline.append(value)
            if len(baseline) > 100:
                baseline.pop(0)
        
        self.observations_count += len(observations['observations'])
        return observations
    
    def _collect_metrics(self, state: NeuralCoreState) -> Dict[str, float]:
        """Extract current metrics from state"""
        metrics = {}
        
        if not state.nodes:
            return metrics
        
        # Aggregate node metrics
        total_queries = sum(node.query_frequency for node in state.nodes.values())
        avg_error_rate = np.mean([node.error_rate for node in state.nodes.values()])
        
        metrics['total_query_frequency'] = total_queries
        metrics['avg_error_rate'] = avg_error_rate
        metrics['active_anomaly_count'] = len(state.active_anomalies)
        metrics['total_interactions'] = state.total_interactions
        
        return metrics
    
    async def execute(self, action: Action, state: NeuralCoreState):
        # Anomaly agent doesn't execute, only detects
        return {'status': 'detected'}


class RecommendationAgent(Agent):
    """Generates action recommendations based on state"""
    
    async def observe(self, state: NeuralCoreState) -> Dict[str, Any]:
        """This agent doesn't observe, it recommends actions"""
        return {'observations': []}
    
    async def execute(self, action: Action, state: NeuralCoreState):
        """Execute recommendation action (send to frontend)"""
        if action.action_type == ActionType.SUGGEST_DRILL_DOWN:
            return {
                'status': 'executed',
                'recommendation': {
                    'type': 'drill_down',
                    'node_id': action.params['node_id'],
                    'reason': action.params.get('reason', action.reasoning)
                }
            }
        
        elif action.action_type == ActionType.SUGGEST_RELATED_NODE:
            return {
                'status': 'executed',
                'recommendation': {
                    'type': 'related_node',
                    'node_id': action.params['node_id'],
                    'reason': action.reasoning
                }
            }
        
        elif action.action_type == ActionType.EXPLAIN_ANOMALY:
            return {
                'status': 'executed',
                'recommendation': {
                    'type': 'explain_anomaly',
                    'metric_name': action.params['metric_name'],
                    'z_score': action.params.get('z_score', 0),
                    'reason': action.reasoning
                }
            }
        
        return {'status': 'unknown_action'}
