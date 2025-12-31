"""
Reward Calculator
Calculates rewards for actions based on user feedback.
"""
from typing import Dict, Any
from app.models.state_models import Action, NeuralCoreState


class RewardCalculator:
    """Calculates rewards for actions based on user feedback"""
    
    @staticmethod
    def calculate_reward(action: Action, feedback: Dict[str, Any], state: NeuralCoreState) -> float:
        """
        Calculate reward for an action.
        
        Reward components:
        - User engagement: Did user interact with suggestion?
        - Correctness: Was the suggestion helpful?
        - Timeliness: Was it shown at the right time?
        - Exploration: Did it lead to deeper exploration?
        
        Returns:
            Reward value in range [-2.0, +2.0]
        """
        reward = 0.0
        
        # Component 1: User Engagement (+1.0 to -0.5)
        if feedback.get('user_clicked'):
            reward += 1.0
        elif feedback.get('user_hovered'):
            reward += 0.3
        elif feedback.get('user_ignored'):
            reward -= 0.5
        elif feedback.get('user_dismissed'):
            reward -= 1.0
        
        # Component 2: Correctness (+0.5 to -0.5)
        if feedback.get('led_to_discovery'):
            reward += 0.5
        elif feedback.get('marked_as_helpful'):
            reward += 0.3
        elif feedback.get('marked_as_unhelpful'):
            reward -= 0.5
        
        # Component 3: Timeliness (+0.3 to 0)
        time_to_interaction = feedback.get('time_to_interaction', float('inf'))
        if time_to_interaction < 5:  # seconds
            reward += 0.3
        elif time_to_interaction < 15:
            reward += 0.1
        
        # Component 4: Exploration Depth (+0.2 to 0)
        if feedback.get('increased_exploration_depth'):
            reward += 0.2
        
        # Normalize to [-2.0, +2.0] range
        return max(-2.0, min(2.0, reward))
