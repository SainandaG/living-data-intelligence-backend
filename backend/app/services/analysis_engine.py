# -*- coding: utf-8 -*-
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

    async def get_table_intelligence(self, connection_id: str, table_name: str, known_row_count: int = None) -> Dict[str, Any]:
        """
        Compute deep intelligence metrics for a specific table.
        """
        try:
            # 1. Get Neural Core & Schema metrics
            try:
                gravity = neural_core.gravity_stores.get(connection_id, {}).get(table_name, 1.0)
                in_deg = neural_core.in_degrees.get(connection_id, {}).get(table_name, 0)
                out_deg = neural_core.out_degrees.get(connection_id, {}).get(table_name, 0)
                hub_score = neural_core.hub_scores.get(connection_id, {}).get(table_name, 0.0)
            except Exception as e:
                # print(f"⚠️ Neural Core metric access failed: {e}")
                gravity, in_deg, out_deg, hub_score = 1.0, 0, 0, 0.0
            
            # Resolve Row Count with multiple fallbacks
            row_count = known_row_count if known_row_count is not None else 0
            
            if row_count == 0:
                # Try Schema Analyzer
                from app.services.schema_analyzer import schema_analyzer
                schema = schema_analyzer.get_analysis_result(connection_id)
                if schema and hasattr(schema, 'tables'):
                    table_obj = next((t for t in schema.tables if t.name.lower() == table_name.lower()), None)
                    if table_obj:
                        row_count = table_obj.row_count or 0
            
            # EMERGENCY FALLBACK 1: Neural Core Snapshot
            try:
                if row_count == 0:
                    core_snap = neural_core.snapshots.get(connection_id)
                    
                    if core_snap and isinstance(core_snap, dict) and 'tables' in core_snap:
                        for t in core_snap['tables']:
                            t_name = None
                            t_rows = 0
                            
                            if isinstance(t, dict):
                                t_name = t.get('name')
                                t_rows = t.get('row_count', t.get('record_count', 0))
                            elif hasattr(t, 'name'): 
                                t_name = t.name
                                t_rows = getattr(t, 'row_count', getattr(t, 'record_count', 0))
                            
                            if (t_name or '').lower() == table_name.lower():
                                row_count = t_rows
                                break
            except Exception as e:
                # print(f"⚠️ Snapshot fallback error: {e}")
                pass
                            
            # EMERGENCY FALLBACK 2: Direct Count (Nuclear Option)
            if row_count == 0:
                try:
                    from app.services.db_connector import db_connector
                    # Table Resolver: Case-insensitive check
                    actual_table_name = table_name
                    from app.services.schema_analyzer import schema_analyzer
                    schema = schema_analyzer.get_analysis_result(connection_id)
                    if schema:
                        table_names_lower = {t.name.lower(): t.name for t in schema.tables}
                        if table_name.lower() in table_names_lower:
                            actual_table_name = table_names_lower[table_name.lower()]

                    # Nuclear Option: Direct Count
                    quoted_table = db_connector.quote_identifier(connection_id, actual_table_name)
                    q = f"SELECT COUNT(*) as c FROM {quoted_table}"
                        
                    res = await db_connector.query(connection_id, q)
                    if res and 'c' in res[0]:
                        row_count = res[0]['c']
                        # print(f"🔥 [Analysis Engine] Direct Count Fallback: Found {row_count} rows")
                except Exception:
                    pass

            # 2. Structural Entropy Calculation
            try:
                total_in = sum(neural_core.in_degrees.get(connection_id, {}).values())
                total_out = sum(neural_core.out_degrees.get(connection_id, {}).values())
                total_connections = total_in + total_out
            except:
                total_connections = 0
            
            row_count = max(row_count, 0)

            
            # 3. Authenticated Metrics Projection (Master Specification)
            from app.services.graph_intelligence import graph_intelligence
            
            # REUSE detected degrees instead of re-fetching potentially dangerous list/dict
            # in_deg and out_deg are already safe integers from top of block
            
            auth_data = graph_intelligence.get_authenticated_metrics(
                table_name, 
                row_count, 
                in_deg, 
                out_deg,
                total_system_connections=total_connections
            )
            
            vitality = auth_data['vitality']
            proof = auth_data['proofs']

            # 5. Narrative (Static fallback initially)
            narrative = self._generate_static_narrative(table_name, in_deg, out_deg, vitality, row_count)

            return {
                "table_name": table_name,
                "metrics": {
                    "gravity": auth_data['gravity'],
                    "vitality": vitality,
                    "entropy": auth_data['entropy'],
                    "hub_score": hub_score,
                    "in_degree": in_deg,
                    "out_degree": out_deg,
                    "row_count": row_count
                },
                "proofs": proof,
                "narrative": narrative
            }

        except Exception as e:
            # print(f"⚠️ Analysis Engine Critical Failure: {e}")
            # Final Safety Net
            return {
                "table_name": table_name,
                "metrics": { "gravity": 1.0, "vitality": 0.0, "entropy": 0.0, "hub_score": 0.0, "in_degree": 0, "out_degree": 0, "row_count": 0 },
                "proofs": ["Analysis unavailable"],
                "narrative": "Node verification pending."
            }
        except Exception as e:
            print(f"⚠️ Authenticated Analysis Failed for {table_name}: {e}")
            import traceback
            traceback.print_exc()
            
            # EMERGENCY REDIRECT: Use Authenticated Engine even in failure
            from app.services.graph_intelligence import graph_intelligence
            # Try to use the row_count we discovered, even if other parts failed
            safe_row_count = locals().get('row_count', 0)
            auth = graph_intelligence.get_authenticated_metrics(table_name, safe_row_count, 0, 0)
            
            return {
                "table_name": table_name,
                "metrics": {
                    "gravity": auth['gravity'],
                    "vitality": auth['vitality'],
                    "entropy": auth['entropy'],
                    "hub_score": 0.0,
                    "in_degree": 0,
                    "out_degree": 0,
                    "row_count": 0
                },
                "proofs": auth['proofs'],
                "narrative": f"Neural Core synchronized for '{table_name}'. Authenticating reality-driven metrics..."
            }

    async def generate_ai_insight(self, table_name: str, metrics: Dict[str, Any], topology: str) -> str:
        """Generate a sci-fi/technical insight using Groq"""
        if not self.groq_client:
            return self._generate_static_narrative(table_name, metrics.get('in_degree', 0), metrics.get('out_degree', 0), metrics.get('vitality', 0.0), metrics.get('row_count', 0))

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
            return self._generate_static_narrative(table_name, metrics.get('in_degree', 0), metrics.get('out_degree', 0), metrics.get('vitality', 0.0), metrics.get('row_count', 0))

    def _generate_static_narrative(self, table_name: str, in_deg: int, out_deg: int, vitality: float, row_count: int = 0) -> str:
        """Generate a reality-driven narrative for the table"""
        if row_count == 0 and in_deg == 0:
            return "No data available for this node."
        records_str = f"{row_count:,}" if row_count > 0 else "Analysis Pending"
        return f"Node '{table_name}' currently maintains a vitality of {vitality}%. Records: {records_str}. Connectivity: {in_deg} In-bound, {out_deg} Out-bound."

analysis_engine = AnalysisEngine()
