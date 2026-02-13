"""
XAI Service - Explainable AI Engine
-----------------------------------
Provides natural language justifications for AI-driven metrics (gravity, glow)
and agent decision paths.
"""

import os
import json
import asyncio
import google.generativeai as genai
from typing import Dict, Any, List, Optional
from app.services.neural_core import neural_core
from app.services.analysis_engine import analysis_engine

class XAIService:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('models/gemini-2.0-flash')
            self.has_ai = True
        else:
            self.has_ai = False
            print("⚠️ XAI Service: No GOOGLE_API_KEY found. Using template fallback.")

    async def get_node_justification(self, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Explain why a specific table has its current gravity and glow metrics.
        """
        # 1. Gather raw data
        intel = await analysis_engine.get_table_intelligence(connection_id, table_name)
        metrics = intel.get("metrics", {})
        
        # 2. Generate Justification
        if self.has_ai:
            justification = await self._generate_ai_justification(table_name, metrics)
        else:
            justification = self._generate_template_justification(table_name, metrics)
            
        return {
            "table_name": table_name,
            "metrics": metrics,
            "justification": justification,
            "confidence": 0.85 if self.has_ai else 0.60
        }

    async def _generate_ai_justification(self, table_name: str, metrics: Dict[str, Any]) -> str:
        """Use Gemini to generate a scientific justification for the metrics"""
        prompt = f"""
        Justify the following structural metrics for data node '{table_name}'.
        Metrics:
        - Gravity: {metrics.get('gravity'):.2f} (Importance/Centrality)
        - Entropy: {metrics.get('entropy'):.4f} (Complexity/Unpredictability)
        - Vitality: {metrics.get('vitality'):.1f}% (Activity/Growth)
        
        Provide a concise, expert-level explanation of why these metrics result in this node's current 'Glow' intensity and 'Gravitational' pull in the data graph.
        Max 2 sentences.
        """
        
        try:
            response = await asyncio.to_thread(self.model.generate_content, prompt)
            return response.text.strip()
        except Exception as e:
            print(f"XAI Service AI Error: {e}")
            return self._generate_template_justification(table_name, metrics)

    def _generate_template_justification(self, table_name: str, metrics: Dict[str, Any]) -> str:
        """Fallback template for justification"""
        gravity = metrics.get("gravity", 1.0)
        if gravity > 3.0:
            return f"Node '{table_name}' exhibits high structural gravity due to its central role as a nexus for multiple relational pathways."
        elif gravity > 1.5:
            return f"Node '{table_name}' maintains a stable gravitational field, serving as a significant data artifact in the schema."
        else:
            return f"Node '{table_name}' is a peripheral entity with low structural mass, primarily functioning as a descriptive attribute layer."

    async def explain_agent_action(self, action: str, parameters: Dict[str, Any]) -> str:
        """Provide a reasoning trace for a T1 Agent action"""
        prompt = f"""
        Explain the logical reasoning behind the following autonomous agent action:
        Action: {action}
        Parameters: {json.dumps(parameters)}
        """
        
        if not self.has_ai:
            return f"Agent initiated {action} based on structural pattern recognition in the active schema."
            
        try:
            response = await asyncio.to_thread(self.model.generate_content, prompt)
            return response.text.strip()
        except:
            return f"Executing {action} to optimize neural graph visualization."

# Global instance
xai_service = XAIService()
