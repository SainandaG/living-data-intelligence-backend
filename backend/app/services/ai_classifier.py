import os
import json
import google.generativeai as genai
from app.models.schemas import Schema, Table
from typing import List, Dict, Any

class AIClassifier:
    """AI-powered table classification using Google's Gemini"""
    
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('models/gemini-2.0-flash')
            self.has_ai = True
        else:
            self.has_ai = False
            print("⚠️ AI Classifier: No GOOGLE_API_KEY found. Falling back to heuristics.")

    async def classify_tables(self, schema: Schema) -> Schema:
        """Classify tables as fact/dimension and identify business entities"""
        if not self.has_ai:
            return self._heuristic_classify(schema)
            
        print("🧠 AI Classification: Analyzing schema with Gemini...")
        
        try:
            # Prepare prompt
            table_info = []
            for t in schema.tables:
                cols = [c.name for c in t.columns]
                table_info.append(f"Table: {t.name}, Columns: {', '.join(cols)}")
            
            prompt = f"""
            Analyze the following database schema and classify each table.
            For each table, determine:
            1. 'table_type': either 'fact' (transactional, high volume, metrics) or 'dimension' (entities, master data, attributes).
            2. 'business_entity': a single word describing the core entity (e.g., customer, transaction, account, product, fraud).
            3. 'importance_score': a number from 1-20 based on its central role in the schema.

            Schema:
            {chr(10).join(table_info)}

            Return ONLY a JSON object where keys are table names and values are objects with these three fields.
            """

            import asyncio
            response = await asyncio.to_thread(self.model.generate_content, prompt)
            # Remove markdown code blocks if present
            clean_json = response.text.strip().replace('```json', '').replace('```', '')
            ai_data = json.loads(clean_json)

            for table in schema.tables:
                if table.name in ai_data:
                    data = ai_data[table.name]
                    table.table_type = data.get('table_type', 'dimension')
                    table.business_entity = data.get('business_entity', 'other')
                    table.importance_score = data.get('importance_score', 10)
            
            return schema

        except Exception as e:
            print(f"❌ AI Classification Error: {e}. Falling back to heuristics.")
            return self._heuristic_classify(schema)

    def _heuristic_classify(self, schema: Schema) -> Schema:
        """Fallback heuristic classification"""
        print("🧪 AI Classification: Using heuristic fallback...")
        for table in schema.tables:
            # We assume 'table' is an object here if it comes from schema.tables (Pydantic)
            # The original classify_tables had logic to handle dicts, but _heuristic_classify
            # is called with a Schema object, so its tables are Pydantic Table objects.
            
            t_type = self._classify_table_type(table, schema)
            b_entity = self._identify_business_entity(table)
            importance = self._calculate_importance(table)
            
            if isinstance(table, dict):
                table['table_type'] = t_type
                table['business_entity'] = b_entity
                table['importance_score'] = importance
            else:
                table.table_type = t_type
                table.business_entity = b_entity
                table.importance_score = importance
        
        return schema
    
    def _classify_table_type(self, table: Any, schema: Schema) -> str:
        """Classify as fact or dimension table using advanced heuristics"""
        # Helper for attribute access
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

        name = get(table, 'name', '').lower()
        row_count = get(table, 'row_count', 0)
        foreign_keys = get(table, 'foreign_keys', [])
        columns = get(table, 'columns', [])
        
        # Heuristic 1: Row density relative to schema
        schema_tables = schema.tables if not isinstance(schema, dict) else schema.get('tables', [])
        
        total_rows = sum(get(t, 'row_count', 0) for t in schema_tables) or 1
        avg_rows = total_rows / max(len(schema_tables), 1)
        is_dense = row_count > (avg_rows * 1.5)
        
        # Heuristic 2: Relationship Cardinality
        outgoing_fks = len(foreign_keys)
        
        # Incoming references
        incoming_references = 0
        for t in schema_tables:
            t_fks = get(t, 'foreign_keys', [])
            for fk in t_fks:
                ref_table = fk.get('referenced_table') if isinstance(fk, dict) else getattr(fk, 'referenced_table', None)
                if ref_table == get(table, 'name'):
                    incoming_references += 1
        
        # Heuristic 3: Common naming patterns
        fact_patterns = ['fact', 'journal', 'ledger', 'transaction', 'event', 'log', 'history', 'payment', 'alert', 'fraud']
        dim_patterns = ['dim', 'master', 'ref', 'type', 'status', 'category', 'user', 'customer', 'account', 'product', 'branch']
        
        is_fact_named = any(p in name for p in fact_patterns)
        is_dim_named = any(p in name for p in dim_patterns)
        
        # Fact Score calculation
        fact_score = 0
        if is_dense: fact_score += 3
        if outgoing_fks >= 2: fact_score += 4
        if is_fact_named: fact_score += 5
        
        has_amount = False
        for c in columns:
            c_name = c.get('name') if isinstance(c, dict) else getattr(c, 'name', '')
            if 'amount' in c_name.lower() or 'total' in c_name.lower():
                has_amount = True
                break
        if has_amount: fact_score += 3
        
        # Dimension Score calculation
        dim_score = 0
        if not is_dense and row_count > 0: dim_score += 2
        if incoming_references >= 2: dim_score += 5
        if is_dim_named: dim_score += 5
        if outgoing_fks <= 1: dim_score += 3

        if fact_score > dim_score:
            return 'fact'
        elif dim_score >= fact_score:
            return 'dimension'
        return 'unknown'
    
    def _identify_business_entity(self, table: Any) -> str:
        """Identify business entity type"""
        # Helper
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

        name = get(table, 'name', '').lower()
        
        entities = {
            'customer': ['customer', 'client', 'user'],
            'account': ['account', 'wallet'],
            'transaction': ['transaction', 'transfer', 'payment'],
            'branch': ['branch', 'location', 'office'],
            'employee': ['employee', 'staff', 'worker'],
            'product': ['product', 'service', 'offering'],
            'loan': ['loan', 'credit', 'mortgage'],
            'card': ['card', 'debit', 'credit_card'],
            'fraud': ['fraud', 'alert', 'suspicious'],
            'audit': ['audit', 'log', 'history']
        }
        
        for entity, keywords in entities.items():
            if any(keyword in name for keyword in keywords):
                return entity
        
        return 'other'
    
    def _calculate_importance(self, table: Any) -> int:
        """Calculate importance score for visualization sizing"""
        # Helper
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

        score = 0
        row_count = get(table, 'row_count', 0)
        
        # Row count importance
        if row_count > 1000000:
            score += 5
        elif row_count > 100000:
            score += 4
        elif row_count > 10000:
            score += 3
        elif row_count > 1000:
            score += 2
        else:
            score += 1
        
        # Foreign key relationships
        fks = get(table, 'foreign_keys', [])
        score += min(len(fks) * 2, 10)
        
        # Has numeric metrics
        numeric_cols = get(table, 'numeric_columns', [])
        if len(numeric_cols) > 0:
            score += 3
        
        # Fact tables are more important
        table_type = get(table, 'table_type', 'unknown')
        if table_type == 'fact':
            score += 5
        
        return min(score, 20)

    def detect_structural_anomalies(self, schema: Schema) -> List[Dict]:
        """
        Detect structural anomalies in the schema.
        Returns a list of anomalies with explanations.
        """
        # Helper for universal access
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

        anomalies = []
        tables = schema.tables if not isinstance(schema, dict) else schema.get('tables', [])
        
        for table in tables:
            table_name = get(table, 'name')
            table_type = get(table, 'table_type')
            fks = get(table, 'foreign_keys', [])

            # 1. Lonely Fact Table (No dimensions connected)
            if table_type == 'fact' and len(fks) == 0:
                anomalies.append({
                    'id': f"orphan_fact_{table_name}",
                    'severity': 'high',
                    'entity': table_name,
                    'type': 'Orphaned Fact Table',
                    'description': f"Table '{table_name}' appears to be transactional but has no relationships.",
                    'recommendation': "Check for missing foreign keys or data quality issues."
                })
                
            # 2. God Object (Too many connections)
            if len(fks) > 10:
                anomalies.append({
                    'id': f"god_object_{table_name}",
                    'severity': 'medium',
                    'entity': table_name,
                    'type': 'God Object',
                    'description': f"Table '{table_name}' has excessive dependencies ({len(fks)} FKs).",
                    'recommendation': "Consider breaking this table into smaller logical units."
                })
                
            # 3. Identity Crisis (Ambiguous Naming)
            if table_name and table_name.lower() in ['data', 'temp', 'stuff', 'backup']:
                anomalies.append({
                    'id': f"bad_name_{table_name}",
                    'severity': 'low',
                    'entity': table_name,
                    'type': 'Ambiguous Naming',
                    'description': f"Table name '{table_name}' is too generic.",
                    'recommendation': "Rename to reflect business purpose."
                })
                
        return anomalies

    def generate_explanation(self, anomaly_id: str) -> str:
        """Generate a natural language story for an anomaly"""
        # In a real system, this would use an LLM
        # For now, we use template-based generation
        return "Anomaly explanation generation pending..."

# Global instance
ai_classifier = AIClassifier()
