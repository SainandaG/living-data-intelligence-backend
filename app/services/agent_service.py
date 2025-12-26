"""
Agentic AI Service
------------------
Autonomous agents that explore the data graph effectively.
"""

import asyncio
import random
from datetime import datetime
from typing import Dict, List

class AgentService:
    def __init__(self):
        self.is_running = False
        self.current_focus = None
        self.findings = []
        self._tasks = []

    async def start_autonomous_loop(self):
        """Start the background exploration agent"""
        self.is_running = True
        self._tasks.append(asyncio.create_task(self._exploration_worker()))
        print("🕵️ Agentic AI: Autonomous Explorer started.")

    async def stop(self):
        self.is_running = False
        for t in self._tasks:
            t.cancel()
        print("🕵️ Agentic AI: Explorer stopped.")

    async def _exploration_worker(self):
        """Main loop for the autonomous agent"""
        while self.is_running:
            try:
                # 1. Select a random sector to analyze
                sector = random.choice(["Transactions", "User Logins", "System Health"])
                self.current_focus = sector
                
                # 2. Simulate analysis time
                analysis_time = random.uniform(2, 5)
                # print(f"🕵️ Agentic AI: Analyzing {sector} sector...")
                await asyncio.sleep(analysis_time)

                # 3. Generate Insight (Simulated)
                if random.random() > 0.7:
                    finding = {
                        "timestamp": datetime.now().isoformat(),
                        "sector": sector,
                        "type": "anomaly",
                        "description": f"Unusual velocity detected in {sector}. Variance > 3σ.",
                        "confidence": 0.92
                    }
                    self.findings.append(finding)
                    
                    # Feed finding into Neural Core for learning
                    from app.services.neural_core import neural_core
                    # Map sector to a potential node or just use 'hub' for general growth
                    await neural_core.process_signal(sector, intensity=finding["confidence"], metadata=finding)
                    
                    # print(f"💡 Agent Insight: {finding['description']}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Agent Error: {e}")
                await asyncio.sleep(5)

    async def analyze_new_connection(self, schema_data: Dict):
        """
        Analyze a fresh database schema to seed the Neural Core.
        Called immediately after connection success.
        """
        from app.services.neural_core import neural_core
        print("🕵️ Agentic AI: Performing initial schema deep-scan...")
        
        tables = schema_data.get('tables', [])
        for table in tables:
            name = table.get('name')
            row_count = table.get('row_count', 0)
            importance = table.get('importance_score', 50)
            
            # Feed intensity based on table scale and importance
            intensity = (importance / 100.0) + (min(row_count, 100000) / 200000.0)
            await neural_core.process_signal(name, intensity=intensity, metadata={"event": "initial_scan"})
        
        # Trigger an initial retraining cycle
        await neural_core.trigger_retraining()
        print(f"🕵️ Agentic AI: Schema analysis complete. Neural Core evolved.")

    async def get_gravity_suggestions(self, schema_data: Dict) -> List[Dict]:
        """
        Suggest columns that would impact the 'gravity' of the flow data.
        Integrates Neural Core insights for smarter suggestions.
        """
        from app.services.neural_core import neural_core
        
        suggestions = []
        tables = schema_data.get('tables', [])
        
        # 1. Check Neural Core for high-gravity nodes
        # If the core has learned that a certain node is important, we suggest it
        core_metrics = neural_core.get_core_metrics()
        # Access internal gravity store directly if needed or via a method
        top_gravity_nodes = sorted(neural_core.gravity_store.items(), key=lambda x: x[1], reverse=True)[:3]
        
        for node_id, score in top_gravity_nodes:
            suggestions.append({
                "table": node_id,
                "column": "Composite Weight",
                "reason": f"Neural Core identified high structural gravity (Score: {score:.2f})",
                "impact": "Critical"
            })

        # 2. Schema-based heuristics
        for table in tables:
            t_name = table.get('name')
            num_cols = table.get('numeric_columns', [])
            
            # Heuristic A: Financial/Fact Tables
            if any(term in t_name.lower() for term in ['transactions', 'orders', 'payments', 'events', 'sales', 'fact']):
                for col in num_cols:
                    if any(term in col.lower() for term in ['amount', 'price', 'total', 'quant', 'val', 'score', 'count']):
                        suggestions.append({
                            "table": t_name,
                            "column": col,
                            "reason": f"High-variance financial metric in '{t_name}'",
                            "impact": "High"
                        })
            
            # Heuristic B: Fallback - Any table with "ID" or "Key" counts if no financial data
            # Suggest clustering by ID density if nothing else
            if not suggestions and num_cols:
                 suggestions.append({
                    "table": t_name,
                    "column": num_cols[0],
                    "reason": f"Primary numeric distribution in '{t_name}'",
                    "impact": "Low"
                })

            # Heuristic C: Dimension Segmentation
            # Look for categorical columns with low cardinality (if available, else guess by name)
            # here we just guess by name for 'segment', 'status', 'type'
            for col in table.get('columns', []):
                c_name = col.get('name', '')
                if any(term in c_name.lower() for term in ['segment', 'tier', 'rating', 'status', 'type', 'category', 'group']):
                    suggestions.append({
                        "table": t_name,
                        "column": c_name,
                        "reason": f"Categorical segmentation field in '{t_name}'",
                        "impact": "Medium"
                    })
                        
        # Deduplicate and Sort
        # Simple dedup by table+column
        seen = set()
        unique_suggestions = []
        for s in suggestions:
            key = f"{s['table']}_{s['column']}"
            if key not in seen:
                seen.add(key)
                unique_suggestions.append(s)

        return sorted(unique_suggestions, key=lambda x: 0 if x['impact'] == 'Critical' else (1 if x['impact'] == 'High' else 2))

    async def get_record_classification(self, table_name: str) -> str:
        """
        Classify a table as 'fact' or 'dimension' for visualization coloring.
        """
        t_low = table_name.lower()
        if any(term in t_low for term in ['transaction', 'order', 'payment', 'event', 'log', 'fact']):
            return 'fact'
        if any(term in t_low for term in ['customer', 'user', 'product', 'account', 'dimension', 'info']):
            return 'dimension'
        return 'entity'

    async def analyze_relationships(self, table_name: str, schema: Dict) -> List[Dict]:
        """
        Use AI to discover semantic relationships between tables
        Returns list of inferred relationships with confidence scores
        """
        suggestions = []
        target_table = None
        
        # Find the target table
        for table in schema.get('tables', []):
            if table['name'] == table_name:
                target_table = table
                break
        
        if not target_table:
            return []
        
        target_cols = [c['name'] for c in target_table.get('columns', [])]
        
        # Analyze other tables for semantic relationships
        for other_table in schema.get('tables', []):
            if other_table['name'] == table_name:
                continue
            
            other_cols = [c['name'] for c in other_table.get('columns', [])]
            
            # Heuristic 1: Similar column name patterns
            common_patterns = set()
            for col in target_cols:
                col_lower = col.lower()
                for other_col in other_cols:
                    other_lower = other_col.lower()
                    # Check for ID patterns
                    if 'id' in col_lower and 'id' in other_lower:
                        if col_lower.replace('_id', '') in other_lower or other_lower.replace('_id', '') in col_lower:
                            common_patterns.add((col, other_col))
            
            if common_patterns:
                suggestions.append({
                    'target_table': other_table['name'],
                    'column': list(common_patterns)[0][0],
                    'confidence': 0.75,
                    'reasoning': f"Similar ID column patterns: {list(common_patterns)[0]}"
                })
            
            # Heuristic 2: Semantic naming (e.g., "customers" -> "orders")
            semantic_pairs = [
                (['customer', 'user', 'client'], ['order', 'transaction', 'purchase']),
                (['product', 'item'], ['order', 'sale', 'inventory']),
                (['account', 'user'], ['transaction', 'payment', 'activity']),
            ]
            
            for source_terms, target_terms in semantic_pairs:
                table_lower = table_name.lower()
                other_lower = other_table['name'].lower()
                
                if any(term in table_lower for term in source_terms) and any(term in other_lower for term in target_terms):
                    suggestions.append({
                        'target_table': other_table['name'],
                        'column': None,
                        'confidence': 0.65,
                        'reasoning': f"Semantic business logic: {table_name} typically relates to {other_table['name']}"
                    })
                elif any(term in other_lower for term in source_terms) and any(term in table_lower for term in target_terms):
                    suggestions.append({
                        'target_table': other_table['name'],
                        'column': None,
                        'confidence': 0.65,
                        'reasoning': f"Semantic business logic: {other_table['name']} typically relates to {table_name}"
                    })
        
        return suggestions

    async def chat_with_data(self, query: str) -> str:
        """
        Process natural language queries about the graph.
        """
        # In real impl, this would call OpenAI/Gemini API with graph context
        return f"Based on my analysis of the graph, I found that '{query}' relates to 3 critical nodes in the User Cluster."

# Global Instance
agent_service = AgentService()
