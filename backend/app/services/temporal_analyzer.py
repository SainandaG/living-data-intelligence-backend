"""
Temporal Analyzer Service
Analyzes database patterns to reconstruct evolution timeline.
Part of the Database Evolution Playback (Temporal Genesis) system.
"""
import asyncio
import re
from datetime import datetime, timedelta, date
from typing import Dict, List, Any, Optional, Tuple
from app.services.db_connector import db_connector
from app.services.schema_analyzer import schema_analyzer

class TemporalAnalyzer:
    """
    Analyzes schemas and data patterns to detect how a database evolved.
    """
    
    def __init__(self):
        # Patterns to look for timestamp/date columns
        self.timestamp_patterns = [
            r'creat(ed|e)_at', r'register(ed)?_at', r'birth_date', 
            r'timestamp', r'date_added', r'recorded_at', r'joining_date',
            r'^created$', r'^timestamp$', r'^date$', r'^year$', r'^dob$',
            r'start_date', r'end_date', r'event_date'
        ]
        
        # Cache for analysis results
        self.evolution_results: Dict[str, Dict[str, Any]] = {}

    async def analyze_evolution(self, connection_id: str) -> Dict[str, Any]:
        """
        Full analysis of database evolution.
        1. Find birth dates for each table
        2. Detect growth patterns
        3. Identify major milestones
        """
        print(f"🎬 Starting Database Evolution Analysis for {connection_id}...")
        
        schema = schema_analyzer.get_analysis_result(connection_id)
        if not schema:
            schema = await schema_analyzer.analyze_schema(connection_id)
        
        table_timelines = []
        
        # Analyze each table
        tasks = []
        for table in schema.tables:
            print(f"Processing table: {table.name} (Schema: {table.schema_name})")
            tasks.append(self._analyze_table_evolution(connection_id, table))
            
        results = await asyncio.gather(*tasks)
        table_timelines = [r for r in results if r is not None]
        
        now_aware = datetime.now().astimezone()
        
        if not table_timelines:
            # CRITICAL FALLBACK: If no tables have temporal data, treat all as Genesis tables (born 1 year ago)
            print("⚠️ No temporal data found. Applying Genesis fallback to all tables.")
            genesis_date = now_aware - timedelta(days=365)
            for table in schema.tables:
                table_timelines.append({
                    "table_name": table.name,
                    "birth_date": genesis_date,
                    "timestamp_column": None,
                    "growth_velocity": table.row_count / 365,
                    "current_size": table.row_count,
                    "importance": self._calculate_importance(table),
                    "is_fallback": True
                })
            
        # Ensure all dates are aware for sorting/min
        for t in table_timelines:
            if t['birth_date'] and t['birth_date'].tzinfo is None:
                t['birth_date'] = t['birth_date'].replace(tzinfo=now_aware.tzinfo)

        # Sort by birth date
        table_timelines.sort(key=lambda x: x['birth_date'] or now_aware)
        
        # Normalize the timeline
        all_birth_dates = [t['birth_date'] for t in table_timelines if t['birth_date']]
        
        # TIME INTELLIGENCE: Start the timeline 30 days BEFORE the first table "birth" 
        # to show the 'Zeroth State' (Empty Space)
        real_start_date = min(all_birth_dates, default=now_aware - timedelta(days=365))
        start_date = real_start_date - timedelta(days=30)
        end_date = now_aware
        
        total_days = (end_date - start_date).days or 1
        
        evolution_data = {
            "connection_id": connection_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "real_birth_date": real_start_date.isoformat(),
            "total_days": total_days,
            "table_evolution": table_timelines,
            "milestones": self._detect_milestones(table_timelines)
        }
        
        self.evolution_results[connection_id] = evolution_data
        print(f"✅ Evolution analysis complete for {connection_id}. {len(table_timelines)} tables analyzed.")
        
        return evolution_data

    async def _analyze_table_evolution(self, connection_id: str, table: Any) -> Optional[Dict[str, Any]]:
        """Detect when a table was 'born' and how it grew."""
        timestamp_col = self._find_best_timestamp_column(table)
        
        birth_date = None
        growth_velocity = 0.0
        is_fallback = False
        
        # Schema-aware table reference
        if table.schema_name:
            table_ref = f'"{table.schema_name}"."{table.name}"'
        else:
            table_ref = f'"{table.name}"'

        if timestamp_col:
            # Special handling for 'year' column (integer)
            if timestamp_col.lower() == 'year':
                sql = f'SELECT MIN("{timestamp_col}") as birth_year FROM {table_ref}'
                try:
                    result = await db_connector.query(connection_id, sql)
                    if result and result[0]['birth_year']:
                        year = int(result[0]['birth_year'])
                        # Convert year to date (January 1st of that year)
                        birth_date = datetime(year, 1, 1).astimezone()
                except Exception as e:
                    print(f"⚠️ Failed to parse birth year for {table.name}: {e}")
            else:
                # Standard timestamp query
                sql = f'SELECT MIN("{timestamp_col}") as birth_date FROM {table_ref}'
                try:
                    result = await db_connector.query(connection_id, sql)
                    if result and isinstance(result, list) and len(result) > 0:
                        raw_date = result[0].get('birth_date')
                        if raw_date:
                            if isinstance(raw_date, str):
                                try:
                                    birth_date = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
                                except Exception:
                                    # Try common formats
                                    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y'):
                                        try:
                                            birth_date = datetime.strptime(raw_date, fmt)
                                            break
                                        except Exception: continue
                            elif isinstance(raw_date, (datetime, date)): 
                                birth_date = raw_date
                            
                            if birth_date and not isinstance(birth_date, datetime):
                                # If it's a date but not datetime
                                if hasattr(birth_date, 'year'):
                                    birth_date = datetime(birth_date.year, birth_date.month, birth_date.day)
                            
                            if birth_date and not birth_date.tzinfo:
                                birth_date = birth_date.replace(tzinfo=datetime.now().astimezone().tzinfo)
                except Exception as e:
                    print(f"⚠️ Failed to get birth date for {table.name}: {e}")
        
        if birth_date is None:
            # Fallback for tables without explicit timestamps: Born 1 year ago
            birth_date = datetime.now().astimezone() - timedelta(days=365)
            is_fallback = True
            
        # Growth velocity (records per day since birth)
        age_days = (datetime.now().astimezone() - birth_date).days or 1
        growth_velocity = table.row_count / age_days

        return {
            "table_name": table.name,
            "birth_date": birth_date,
            "timestamp_column": timestamp_col,
            "growth_velocity": growth_velocity,
            "current_size": table.row_count,
            "importance": self._calculate_importance(table),
            "is_fallback": is_fallback
        }

    def _find_best_timestamp_column(self, table: Any) -> Optional[str]:
        """Find the most reliable column for creation date."""
        for pattern in self.timestamp_patterns:
            for col in table.columns:
                if re.search(pattern, col.name, re.IGNORECASE):
                    # Prefer datetime/timestamp types
                    if 'timestamp' in col.type.lower() or 'date' in col.type.lower():
                        return col.name
        
        # Secondary check for any date-like names
        for col in table.columns:
            if 'date' in col.name.lower() or 'time' in col.name.lower():
                return col.name
                
        return None

    def _detect_milestones(self, timelines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify significant events on the timeline."""
        milestones = []
        
        # 1. Table creations
        for t in timelines:
            if t['birth_date']:
                milestones.append({
                    "date": t['birth_date'].isoformat(),
                    "type": "table_creation",
                    "title": f"Genesis: {t['table_name']}",
                    "description": f"The table '{t['table_name']}' received its first entry.",
                    "importance": t['importance']
                })
        
        # 2. Add major growth milestones (every 100k, 1M records etc if applicable)
        # 3. Add mass-evolution events (many tables born near same time)
        
        # Sort milestones by date
        milestones.sort(key=lambda x: x['date'])
        return milestones

    def _calculate_importance(self, table: Any) -> str:
        """Rate the importance of a table evolution event."""
        if table.row_count > 1000000: return "critical"
        if table.row_count > 100000: return "high"
        if table.row_count > 10000: return "medium"
        return "low"

    def get_result(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Get cached evolution result."""
        return self.evolution_results.get(connection_id)

# Global instance
temporal_analyzer = TemporalAnalyzer()
