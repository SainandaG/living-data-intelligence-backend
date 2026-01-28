"""
Root Cause Analyzer Service
Traces issues to their origin and maps impact paths between tables.
"""
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class RootCauseAnalyzer:
    """Service for tracing data issues and cascading failures across the database schema"""
    
    def __init__(self):
        pass
        
    async def analyze_impact(self, db_connector, connection_id: str, table_name: str) -> Dict[str, Any]:
        """Analyze which tables are affected if issues occur in the specified table"""
        try:
            # 0. Get schema for this table
            table_info = await self._get_table_info(db_connector, connection_id, table_name)
            schema = table_info['schema']
            
            # 1. Find dependencies (Foreign Keys where this table is the parent)
            # Use DB-agnostic query using KEY_COLUMN_USAGE
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type']
            database = connection['config']['database']
            
            if db_type == 'mysql':
                dep_query = f"""
                    SELECT 
                        TABLE_NAME as child_table, 
                        COLUMN_NAME as child_column,
                        REFERENCED_COLUMN_NAME as parent_column
                    FROM 
                        information_schema.KEY_COLUMN_USAGE
                    WHERE 
                        REFERENCED_TABLE_NAME = '{table_name}'
                        AND TABLE_SCHEMA = '{database}';
                """
            else:
                # PostgreSQL version using information_schema tables that always exist
                dep_query = f"""
                    SELECT 
                        tc.table_name as child_table, 
                        kcu.column_name as child_column,
                        ccu.column_name as parent_column
                    FROM 
                        information_schema.table_constraints AS tc 
                        JOIN information_schema.key_column_usage AS kcu
                          ON tc.constraint_name = kcu.constraint_name
                          AND tc.table_schema = kcu.table_schema
                        JOIN (
                            SELECT table_name, column_name, constraint_name, table_schema
                            FROM information_schema.key_column_usage
                        ) AS ccu
                          ON ccu.constraint_name = tc.constraint_name
                          AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY' 
                    AND ccu.table_name = '{table_name}'
                    AND ccu.table_schema = '{schema}';
                """
            dependencies = await db_connector.query(connection_id, dep_query)
            
            # 2. Map the ripple effect
            impact_path = []
            for dep in dependencies:
                impact_path.append({
                    "table": dep['child_table'],
                    "reason": f"Linked via {dep['child_column']} -> {table_name}.{dep['parent_column']}",
                    "severity": "Medium" # Default for first-level dependency
                })
                
            # 3. Generate plain English explanation
            summary = self._generate_impact_summary(table_name, impact_path)
            
            return {
                "origin_table": table_name,
                "affected_tables_count": len(impact_path),
                "impact_path": impact_path,
                "summary": summary,
                "risk_score": min(100, len(impact_path) * 20)
            }
            
        except Exception as e:
            logger.error(f"Root cause analysis failed for {table_name}: {e}")
            return {"error": str(e), "affected_tables_count": 0}

    async def _get_table_info(self, db_connector, connection_id: str, table_name: str) -> Dict[str, str]:
        """Get schema and metadata for a table"""
        check_query = f"""
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name = '{table_name}' 
            AND table_schema IN ('evolution', 'public')
            ORDER BY CASE WHEN table_schema = 'evolution' THEN 1 ELSE 2 END
            LIMIT 1
        """
        res = await db_connector.query(connection_id, check_query)
        if res:
            return {"schema": res[0]['table_schema']}
        return {"schema": "public"}

    def _generate_impact_summary(self, origin: str, impact_path: List[Dict]) -> str:
        """Generate plain English impact summary"""
        if not impact_path:
            return f"Issues in {origin} are isolated and unlikely to affect other parts of the system directly."
            
        affected_names = [d['table'] for d in impact_path]
        if len(affected_names) > 3:
            affected_str = f"{', '.join(affected_names[:3])} and {len(affected_names)-3} others"
        else:
            affected_str = ", ".join(affected_names)
            
        return f"A failure in {origin} could cause a ripple effect across {len(impact_path)} other tables, most notably affecting {affected_str}."

# Global instance
root_cause_analyzer = RootCauseAnalyzer()
