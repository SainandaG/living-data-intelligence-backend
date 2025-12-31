"""
Neural Core State Models
Defines all dataclasses for Neural Core state management.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any
from datetime import datetime
from enum import Enum


@dataclass
class NodeState:
    """State of a single node in the graph"""
    node_id: str
    table_name: str
    entity_type: str  # 'fact', 'dimension', 'other'
    row_count: int
    column_count: int
    fk_count: int
    
    # Observed metrics
    query_frequency: float = 0.0
    avg_query_time: float = 0.0
    error_rate: float = 0.0
    
    # User interaction
    click_count: int = 0
    hover_count: int = 0
    drill_down_count: int = 0
    last_interaction: Optional[datetime] = None
    
    # Computed importance
    structural_importance: float = 0.0  # Based on FK connections
    behavioral_importance: float = 0.0  # Based on user interactions
    neural_importance: float = 0.0      # Learned importance


@dataclass
class EdgeState:
    """State of a relationship between nodes"""
    edge_id: str
    source_id: str
    target_id: str
    relationship_type: str  # 'fk', 'inferred', 'column_match'
    
    # Evidence strength
    structural_strength: float  # 0.0-1.0
    statistical_strength: float  # 0.0-1.0
    neural_confidence: float     # 0.0-1.0 (learned)
    
    # Observations
    query_join_frequency: float = 0.0
    user_explored: bool = False


@dataclass
class AnomalyState:
    """Detected anomaly in the system"""
    anomaly_id: str
    timestamp: datetime
    metric_name: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    z_score: float
    
    # User response
    user_acknowledged: bool = False
    user_dismissed: bool = False
    false_positive: bool = False


@dataclass
class UserSessionState:
    """Current user session context"""
    session_id: str
    start_time: datetime
    
    # Focus tracking
    current_view: str  # 'graph', 'schema', 'analytics', 'chat'
    focused_node: Optional[str] = None
    focused_edge: Optional[str] = None
    
    # Interaction history
    nodes_visited: Set[str] = field(default_factory=set)
    edges_explored: Set[str] = field(default_factory=set)
    queries_executed: List[str] = field(default_factory=list)
    chat_messages: int = 0
    
    # Behavior patterns
    exploration_depth: int = 0  # How many drill-downs
    avg_time_per_node: float = 0.0
    prefers_visual: bool = True  # vs tabular


@dataclass
class NeuralCoreState:
    """Complete world model maintained by Neural Core"""
    connection_id: str
    database_type: str
    schema_name: str
    
    # Graph topology
    nodes: Dict[str, NodeState] = field(default_factory=dict)
    edges: Dict[str, EdgeState] = field(default_factory=dict)
    
    # Temporal state
    current_time_window: str = "last_1h"  # 'last_1h', 'last_24h', 'last_7d'
    
    # Anomalies
    active_anomalies: List[AnomalyState] = field(default_factory=list)
    
    # User context
    session: Optional[UserSessionState] = None
    
    # Learning state
    total_interactions: int = 0
    total_rewards: float = 0.0
    learning_epoch: int = 0
    
    # Metadata
    last_updated: datetime = field(default_factory=datetime.now)
    state_version: int = 1


class ActionType(Enum):
    """All possible actions Neural Core can take"""
    
    # Highlighting actions
    HIGHLIGHT_NODE = "highlight_node"
    HIGHLIGHT_EDGE = "highlight_edge"
    HIGHLIGHT_CLUSTER = "highlight_cluster"
    
    # Navigation actions
    SUGGEST_DRILL_DOWN = "suggest_drill_down"
    SUGGEST_RELATED_NODE = "suggest_related_node"
    SUGGEST_VIEW_CHANGE = "suggest_view_change"
    
    # Explanation actions
    EXPLAIN_ANOMALY = "explain_anomaly"
    EXPLAIN_RELATIONSHIP = "explain_relationship"
    EXPLAIN_PATTERN = "explain_pattern"
    
    # Layout actions
    CHANGE_LAYOUT = "change_layout"
    ZOOM_TO_CLUSTER = "zoom_to_cluster"
    
    # Passive action
    STAY_SILENT = "stay_silent"


@dataclass
class Action:
    """Represents a single action"""
    action_id: str
    action_type: ActionType
    params: Dict[str, Any]
    confidence: float  # 0.0-1.0
    reasoning: str
    timestamp: datetime = field(default_factory=datetime.now)
    
    # Execution tracking
    executed: bool = False
    execution_result: Optional[Dict] = None
    
    # Feedback tracking
    user_accepted: Optional[bool] = None  # True if clicked, False if ignored
    reward: Optional[float] = None


@dataclass
class UserFeedback:
    """User feedback on an action"""
    action_id: str
    timestamp: datetime
    
    # Explicit feedback
    user_clicked: bool = False
    user_hovered: bool = False
    user_ignored: bool = False
    user_dismissed: bool = False
    
    # Implicit feedback
    time_to_interaction: Optional[float] = None
    led_to_discovery: bool = False
    increased_exploration_depth: bool = False
    
    # Explicit rating (optional)
    marked_as_helpful: bool = False
    marked_as_unhelpful: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'user_clicked': self.user_clicked,
            'user_hovered': self.user_hovered,
            'user_ignored': self.user_ignored,
            'user_dismissed': self.user_dismissed,
            'time_to_interaction': self.time_to_interaction,
            'led_to_discovery': self.led_to_discovery,
            'increased_exploration_depth': self.increased_exploration_depth,
            'marked_as_helpful': self.marked_as_helpful,
            'marked_as_unhelpful': self.marked_as_unhelpful
        }


@dataclass
class IntelligenceSignal:
    """Signal sent from frontend to Neural Core"""
    connection_id: str
    signal_type: str  # 'node_click', 'node_hover', 'drill_down', 'action_feedback'
    params: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
