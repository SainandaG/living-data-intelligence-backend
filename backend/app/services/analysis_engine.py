"""
Analysis Engine - Computes high-level intelligence metrics for nodes
Calculates Entropy, Centrality, and Vitality history.
"""
import math
from typing import Dict, List, Any
from app.services.neural_core import neural_core
from app.services.db_connector import db_connector

class AnalysisEngine:
    def __init__(self):
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        self.groq_client = None
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=groq_key)
                print("✅ AnalysisEngine: Groq AI Online")
            except Exception as e:
                print(f"⚠️ AnalysisEngine: Groq init failed: {e}")

    async def get_table_intelligence(self, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Compute deep intelligence metrics for a specific table.
        """
        try:
            # 1. Get Neural Core metrics
            gravity = neural_core.gravity_store.get(table_name, 1.0)
            in_deg = neural_core.in_degree.get(table_name, 0)
            out_deg = neural_core.out_degree.get(table_name, 0)
            hub_score = neural_core.hub_scores.get(table_name, 0.0)
            
            # 2. Structural Entropy Calculation
            # H = -sum(p * log(p)) where p is the relative degree distribution
            total_connections = sum(neural_core.in_degree.values()) + sum(neural_core.out_degree.values())
            node_connections = in_deg + out_deg
            
            if total_connections > 0 and node_connections > 0:
                p = node_connections / total_connections
                entropy = -p * math.log2(p)
            else:
                entropy = 0.0
            
            # 3. Vitality Projection (Director Formulation)
            # V = min(100, (log10(N + 1) * 20) + (G * 5))
            from app.services.schema_analyzer import schema_analyzer
            schema = schema_analyzer.get_analysis_result(connection_id)
            table_obj = next((t for t in schema.tables if t.name == table_name), None) if schema else None
            
            row_count = table_obj.row_count if (table_obj and table_obj.row_count) else 1
            vitality = min(100, (math.log10(max(1, row_count)) * 20) + (gravity * 5))
            
            # 4. Formulate the "Mathematical Proof" string (LaTeX-ish)
            proof = {
                "gravity": f"G = σ(log10(N) + C_s - 3.0) = {gravity:.2f}",
                "vitality": f"V = min(100, 20log10(N) + 5G) = {vitality:.1f}%",
                "entropy": f"H(x) = -Σ P(x)log2 P(x) = {entropy:.4f}"
            }

            # 5. Narrative (Static fallback initially)
            narrative = self._generate_static_narrative(table_name, in_deg, out_deg, vitality)

            return {
                "table_name": table_name,
                "metrics": {
                    "gravity": gravity,
                    "vitality": vitality,
                    "entropy": entropy,
                    "hub_score": hub_score,
                    "in_degree": in_deg,
                    "out_degree": out_deg,
                    "row_count": row_count
                },
                "proofs": proof,
                "narrative": narrative
            }
        except Exception as e:
            print(f"Error in get_table_intelligence: {e}")
            import traceback
            traceback.print_exc()
            # Return safe defaults
            return {
                "table_name": table_name,
                "metrics": {
                    "gravity": 1.0,
                    "vitality": 50.0,
                    "entropy": 0.0,
                    "hub_score": 0.0,
                    "in_degree": 0,
                    "out_degree": 0,
                    "row_count": 0
                },
                "proofs": {
                    "gravity": "G = 1.0 (default)",
                    "vitality": "V = 50.0% (default)",
                    "entropy": "H = 0.0 (default)"
                },
                "narrative": f"Node '{table_name}' is being analyzed. Neural Core may need initialization."
            }

    async def generate_ai_insight(self, table_name: str, metrics: Dict[str, Any], topology: str) -> str:
        """Generate a sci-fi/technical insight using Groq"""
        if not self.groq_client:
            return "Neural Link Offline: AI Insight Unavailable."

        system_prompt = """You are the CORE INTELLIGENCE of a neural data system. 
        Your job is to analyze a specific data node (table) based on its structural metrics and detected topology.
        
        OUTPUT FORMAT:
        Return a single, concise paragraph (max 2 sentences).
        Style: Sci-Fi, Technical, Insightful. Use terms like 'neural pathways', 'data gravity', 'informational entropy'.
        
        INPUT DATA:
        - Node Name: The data entity
        - Topology: Nucleus (Central Hub), Helix (Flow/Stream), or Ring (Stable Reference)
        - Gravity: Importance score (Higher = more mass/pull)
        - Entropy: Unpredictability/Complexity
        """

        user_prompt = f"""
        Node: {table_name}
        Topology: {topology}
        Metrics: Gravity={metrics.get('gravity'):.2f}, Entropy={metrics.get('entropy'):.4f}, Rows={metrics.get('row_count')}
        
        Explain its role in the system.
        """

        try:
            import asyncio
            response = await asyncio.to_thread(
                self.groq_client.chat.completions.create,
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=150
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Groq Insight Error: {e}")
            return "Neural Link Interrupted. Calculation Pending..."

    def _generate_static_narrative(self, name: str, in_deg: int, out_deg: int, vitality: float) -> str:
        """Generate a basic intelligence narrative if AI service is offline"""
        if in_deg > 5:
            role = "Central Hub/Authority"
        elif out_deg > 3:
            role = "Transaction Driver/Fact Table"
        else:
            role = "Structural Leaf Entity"
            
        health = "High Vitality" if vitality > 70 else ("Stable" if vitality > 30 else "Low Density/Stagnant")
        
        return f"Node '{name}' functions as a {role} within the neural topology. Current stability is classified as {health}."

analysis_engine = AnalysisEngine()
