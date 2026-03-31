"""
Root Cause Analyzer Service
Traces issues to their origin and maps impact paths between tables.
"""
from typing import Dict, List, Any
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
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type']
            config = connection.get('config', {})
            database = config.get('database', '')

            if db_type == 'mysql':
                dep_query = """
                    SELECT
                        TABLE_NAME as child_table,
                        COLUMN_NAME as child_column,
                        REFERENCED_COLUMN_NAME as parent_column
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE REFERENCED_TABLE_NAME = %s
                    AND TABLE_SCHEMA = %s
                """
                dependencies = await db_connector.query(connection_id, dep_query, (table_name, database))
            else:
                # PostgreSQL — use pg_constraint for reliability
                dep_query = """
                    SELECT
                        child_ns.nspname || '.' || child_cls.relname AS child_table,
                        child_att.attname AS child_column,
                        parent_att.attname AS parent_column
                    FROM pg_constraint con
                    JOIN pg_class child_cls ON child_cls.oid = con.conrelid
                    JOIN pg_namespace child_ns ON child_ns.oid = child_cls.relnamespace
                    JOIN pg_class parent_cls ON parent_cls.oid = con.confrelid
                    JOIN pg_namespace parent_ns ON parent_ns.oid = parent_cls.relnamespace
                    JOIN pg_attribute child_att ON child_att.attrelid = con.conrelid AND child_att.attnum = ANY(con.conkey)
                    JOIN pg_attribute parent_att ON parent_att.attrelid = con.confrelid AND parent_att.attnum = ANY(con.confkey)
                    WHERE con.contype = 'f'
                    AND parent_cls.relname = $1
                    AND parent_ns.nspname = $2
                """
                dependencies = await db_connector.query(connection_id, dep_query, (table_name, schema))

            # 2. Map the ripple effect
            impact_path = []
            for dep in dependencies:
                raw_child = dep.get('child_table', '')
                child_name = raw_child.split('.')[-1] if '.' in raw_child else raw_child
                impact_path.append({
                    "table": child_name,
                    "reason": f"Linked via {dep['child_column']} -> {table_name}.{dep['parent_column']}",
                    "severity": "Medium"
                })

            # 2.5 SOFT DEPENDENCY SCAN — parameterized, db-aware
            if not impact_path:
                is_mysql = db_type == 'mysql'
                param1 = "%s" if is_mysql else "$1"
                param2 = "%s" if is_mysql else "$2"

                t_query = f"SELECT table_name FROM information_schema.tables WHERE table_schema = {param1}"
                all_tables = await db_connector.query(connection_id, t_query, (schema if not is_mysql else database,))

                singular_name = table_name[:-1] if table_name.endswith('s') else table_name
                potential_fk = f"{singular_name}_id"

                for t in all_tables:
                    t_name = t['table_name']
                    if t_name == table_name:
                        continue
                    c_query = f"SELECT column_name FROM information_schema.columns WHERE table_name = {param1} AND column_name = {param2}"
                    c_res = await db_connector.query(connection_id, c_query, (t_name, potential_fk))
                    if c_res:
                        impact_path.append({
                            "table": t_name,
                            "reason": f"Latent Link: Column '{potential_fk}' implies relationship.",
                            "severity": "Low"
                        })
                        if len(impact_path) >= 3:
                            break

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
        try:
            connection = db_connector.get_connection(connection_id)
            is_mysql = connection['type'] == 'mysql'
        except Exception:
            is_mysql = False
        param = "%s" if is_mysql else "$1"
        check_query = f"""
            SELECT table_schema
            FROM information_schema.tables
            WHERE table_name = {param}
            AND table_schema IN ('evolution', 'public')
            ORDER BY CASE WHEN table_schema = 'evolution' THEN 1 ELSE 2 END
            LIMIT 1
        """
        res = await db_connector.query(connection_id, check_query, (table_name,))
        if res:
            return {"schema": res[0]['table_schema']}
        return {"schema": "public"}

    def _generate_impact_summary(self, origin: str, impact_path: List[Dict]) -> str:
        """Generate plain English impact summary with higher fidelity"""
        if not impact_path:
            return f"The current analysis indicates that {origin} is isolated. No direct downstream dependencies were detected in the immediate schema layer."
            
        # Filter out self or redundant links
        affected_names = [d['table'] for d in impact_path if d['table'] != origin]
        
        if not affected_names:
            return f"Issues in {origin} primarily affect its own internal data integrity, with no high-probability cascading risks to external tables."

        count = len(affected_names)
        if count > 3:
            affected_str = f"{', '.join(affected_names[:3])} and {count-3} other related tables"
        else:
            affected_str = ", ".join(affected_names)
            
        reasons = [d['reason'] for d in impact_path if 'Latent' not in d['reason']][:2]
        reason_str = f" via {', '.join(reasons)}" if reasons else " through internal data flows"

        summary = f"A failure in {origin} triggers a critical risk path affecting {affected_str}{reason_str}. "
        
        # Add dynamic proactive advice
        if count > 5:
            summary += "Immediate isolation of the transaction layer is recommended to prevent system-wide propagation."
        else:
            summary += "Monitoring of downstream foreign key constraints is suggested."
            
        return summary


# Global instance
root_cause_analyzer = RootCauseAnalyzer()
