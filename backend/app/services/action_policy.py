"""
Action Policy
Implements multi-armed bandit for action selection.
"""
import random
import math
from typing import List, Dict
from app.models.state_models import Action, ActionType, NeuralCoreState


class ActionPolicy:
    """Decides which action to take based on state using multi-armed bandit"""
    
    def __init__(self, epsilon: float = 0.1):
        """
        Initialize action policy.
        
        Args:
            epsilon: Exploration rate (0.0-1.0)
        """
        # Multi-armed bandit for action selection
        self.action_stats: Dict[str, Dict[str, float]] = {}
        for action_type in ActionType:
            self.action_stats[action_type.value] = {
                'attempts': 0,
                'successes': 0,
                'total_reward': 0.0,
                'avg_reward': 0.0
            }
        
        self.epsilon = epsilon  # Exploration rate
        self.total_attempts = 0
    
    def select_action(self, candidate_actions: List[Action], state: NeuralCoreState) -> Action:
        """
        Select best action using epsilon-greedy multi-armed bandit.
        
        Args:
            candidate_actions: List of possible actions
            state: Current Neural Core state
        
        Returns:
            Selected action
        """
        if not candidate_actions:
            from datetime import datetime
            return Action(
                action_id=f"action_{datetime.now().timestamp()}",
                action_type=ActionType.STAY_SILENT,
                params={},
                confidence=1.0,
                reasoning="No candidate actions available"
            )
        
        # Epsilon-greedy: explore vs exploit
        if random.random() < self.epsilon:
            # Explore: random action
            action = random.choice(candidate_actions)
            action.reasoning += " [EXPLORATION]"
        else:
            # Exploit: best action based on historical rewards
            action = max(candidate_actions, key=lambda a: self._get_action_value(a))
            action.reasoning += " [EXPLOITATION]"
        
        return action
    
    def _get_action_value(self, action: Action) -> float:
        """
        Calculate expected value of an action using UCB1.
        
        Args:
            action: Action to evaluate
        
        Returns:
            Expected value
        """
        stats = self.action_stats[action.action_type.value]
        
        if stats['attempts'] == 0:
            return 1.0  # Optimistic initial value
        
        # Upper Confidence Bound (UCB1)
        avg_reward = stats['avg_reward']
        
        if self.total_attempts > 0:
            exploration_bonus = math.sqrt(
                2 * math.log(self.total_attempts) / stats['attempts']
            )
        else:
            exploration_bonus = 0
        
        return avg_reward + exploration_bonus
    
    def update_policy(self, action: Action, reward: float):
        """
        Update policy based on action outcome.
        
        Args:
            action: Action that was taken
            reward: Reward received
        """
        stats = self.action_stats[action.action_type.value]
        stats['attempts'] += 1
        stats['total_reward'] += reward
        stats['avg_reward'] = stats['total_reward'] / stats['attempts']
        
        if reward > 0:
            stats['successes'] += 1
        
        self.total_attempts += 1
    
    def get_stats(self) -> Dict[str, Dict[str, float]]:
        """Get current policy statistics"""
        return self.action_stats.copy()
    
    def decay_epsilon(self, decay_rate: float = 0.99):
        """Gradually reduce exploration rate"""
        self.epsilon = max(0.01, self.epsilon * decay_rate)
