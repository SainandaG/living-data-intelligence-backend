from app.models.schemas import Schema, Table
from typing import List

class AIClassifier:
    """AI-powered table classification"""
    
    async def classify_tables(self, schema: Schema) -> Schema:
        """Classify tables as fact/dimension and identify business entities"""
        print("🧠 AI Classification: Analyzing table types...")
        
        for table in schema.tables:
            table.table_type = self._classify_table_type(table, schema)
            table.business_entity = self._identify_business_entity(table)
            table.importance_score = self._calculate_importance(table)
        
        return schema
    
    def _classify_table_type(self, table: Table, schema: Schema) -> str:
        """Classify as fact or dimension table"""
        name = table.name.lower()
        
        has_timestamp = any(
            'timestamp' in col.name.lower() or 
            'created' in col.name.lower() or 
            'date' in col.name.lower()
            for col in table.columns
        )
        
        has_many_fks = len(table.foreign_keys) >= 2
        has_high_row_count = table.row_count > 10000
        has_numeric_metrics = len(table.numeric_columns) > 0
        
        # Fact table indicators
        fact_indicators = [
            'transaction' in name,
            'event' in name,
            'log' in name,
            'history' in name,
            'activity' in name,
            'alert' in name,
            'payment' in name,
            'transfer' in name,
            has_timestamp and has_many_fks,
            has_high_row_count and has_numeric_metrics
        ]
        
        fact_score = sum(fact_indicators)
        
        # Dimension table indicators
        dimension_indicators = [
            'customer' in name,
            'account' in name,
            'branch' in name,
            'employee' in name,
            'product' in name,
            'category' in name,
            'type' in name,
            'status' in name,
            len(table.foreign_keys) <= 1,
            not has_timestamp
        ]
        
        dimension_score = sum(dimension_indicators)
        
        if fact_score > dimension_score:
            return 'fact'
        elif dimension_score > fact_score:
            return 'dimension'
        else:
            return 'unknown'
    
    def _identify_business_entity(self, table: Table) -> str:
        """Identify business entity type"""
        name = table.name.lower()
        
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
    
    def _calculate_importance(self, table: Table) -> int:
        """Calculate importance score for visualization sizing"""
        score = 0
        
        # Row count importance
        if table.row_count > 1000000:
            score += 5
        elif table.row_count > 100000:
            score += 4
        elif table.row_count > 10000:
            score += 3
        elif table.row_count > 1000:
            score += 2
        else:
            score += 1
        
        # Foreign key relationships
        score += min(len(table.foreign_keys) * 2, 10)
        
        # Has numeric metrics
        if len(table.numeric_columns) > 0:
            score += 3
        
        # Fact tables are more important
        if table.table_type == 'fact':
            score += 5
        
        return min(score, 20)

# Global instance
ai_classifier = AIClassifier()
