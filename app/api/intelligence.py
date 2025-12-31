"""
Intelligence API
Endpoints for Neural Core interaction with frontend.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

from app.models.state_models import IntelligenceSignal, UserFeedback
from app.services.neural_core import neural_core

router = APIRouter()


class ActionFeedbackRequest(BaseModel):
    """Request model for action feedback"""
    connection_id: str
    action_id: str
    user_clicked: bool = False
    user_hovered: bool = False
    user_ignored: bool = False
    user_dismissed: bool = False
    time_to_interaction: Optional[float] = None
    led_to_discovery: bool = False
    increased_exploration_depth: bool = False
    marked_as_helpful: bool = False
    marked_as_unhelpful: bool = False


@router.post("/signal")
async def send_intelligence_signal(signal: IntelligenceSignal):
    """
    Frontend sends interaction signals to Neural Core.
    Updates state based on user interactions.
    """
    try:
        connection_id = signal.connection_id
        state = neural_core.states.get(connection_id)
        
        if not state:
            # Create state if it doesn't exist
            state = neural_core.get_or_create_state(connection_id)
        
        # Update state based on signal type
        if signal.signal_type == "node_click":
            node_id = signal.params.get('node_id')
            if node_id and node_id in state.nodes:
                node = state.nodes[node_id]
                node.click_count += 1
                node.last_interaction = datetime.now()
                
                # Update session focus
                if state.session:
                    state.session.focused_node = node_id
                    state.session.nodes_visited.add(node_id)
        
        elif signal.signal_type == "node_hover":
            node_id = signal.params.get('node_id')
            if node_id and node_id in state.nodes:
                node = state.nodes[node_id]
                node.hover_count += 1
        
        elif signal.signal_type == "drill_down":
            node_id = signal.params.get('node_id')
            if state.session:
                state.session.exploration_depth += 1
                if node_id:
                    state.session.nodes_visited.add(node_id)
                    
                    # Update node drill-down count
                    if node_id in state.nodes:
                        state.nodes[node_id].drill_down_count += 1
        
        elif signal.signal_type == "action_feedback":
            # Process feedback on Neural Core action
            feedback_data = signal.params.get('feedback', {})
            feedback = UserFeedback(
                action_id=signal.params['action_id'],
                timestamp=datetime.now(),
                **feedback_data
            )
            await neural_core.process_feedback(
                signal.params['action_id'], 
                feedback, 
                connection_id
            )
        
        # Update state timestamp
        state.last_updated = datetime.now()
        state.total_interactions += 1
        
        # Save state periodically (every 10 interactions)
        if state.total_interactions % 10 == 0:
            neural_core.state_manager.save_state(state)
        
        return {"status": "signal_received", "timestamp": datetime.now().isoformat()}
    
    except Exception as e:
        print(f"❌ Error processing signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/action/{connection_id}")
async def get_intelligence_action(connection_id: str):
    """
    Frontend polls for Neural Core decisions.
    Returns action if Neural Core has a suggestion.
    """
    try:
        action = await neural_core.observe_and_decide(connection_id)
        
        if action and action.action_type.value != "stay_silent":
            return {
                "has_action": True,
                "action": {
                    "action_id": action.action_id,
                    "type": action.action_type.value,
                    "params": action.params,
                    "confidence": action.confidence,
                    "reasoning": action.reasoning,
                    "timestamp": action.timestamp.isoformat()
                }
            }
        
        return {"has_action": False}
    
    except Exception as e:
        print(f"❌ Error getting action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/{connection_id}")
async def get_learning_metrics(connection_id: str):
    """
    Get learning metrics for monitoring Neural Core performance.
    """
    try:
        metrics = neural_core.get_learning_metrics(connection_id)
        return metrics
    
    except Exception as e:
        print(f"❌ Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback")
async def send_action_feedback(feedback: ActionFeedbackRequest):
    """
    Send feedback on a specific action.
    Alternative to using the signal endpoint.
    """
    try:
        user_feedback = UserFeedback(
            action_id=feedback.action_id,
            timestamp=datetime.now(),
            user_clicked=feedback.user_clicked,
            user_hovered=feedback.user_hovered,
            user_ignored=feedback.user_ignored,
            user_dismissed=feedback.user_dismissed,
            time_to_interaction=feedback.time_to_interaction,
            led_to_discovery=feedback.led_to_discovery,
            increased_exploration_depth=feedback.increased_exploration_depth,
            marked_as_helpful=feedback.marked_as_helpful,
            marked_as_unhelpful=feedback.marked_as_unhelpful
        )
        
        await neural_core.process_feedback(
            feedback.action_id,
            user_feedback,
            feedback.connection_id
        )
        
        return {"status": "feedback_received"}
    
    except Exception as e:
        print(f"❌ Error processing feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/{connection_id}")
async def get_state_info(connection_id: str):
    """
    Get current state information for debugging.
    """
    try:
        state = neural_core.states.get(connection_id)
        
        if not state:
            return {"exists": False}
        
        return {
            "exists": True,
            "connection_id": state.connection_id,
            "database_type": state.database_type,
            "nodes_count": len(state.nodes),
            "edges_count": len(state.edges),
            "total_interactions": state.total_interactions,
            "total_rewards": state.total_rewards,
            "learning_epoch": state.learning_epoch,
            "active_anomalies": len(state.active_anomalies),
            "has_session": state.session is not None,
            "last_updated": state.last_updated.isoformat()
        }
    
    except Exception as e:
        print(f"❌ Error getting state info: {e}")
        raise HTTPException(status_code=500, detail=str(e))
