"""
Data Intelligence Analyzer
Performs deep analysis on actual table data to extract business insights
"""
from typing import Dict, List, Any, Optional
import statistics
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class DataIntelligenceAnalyzer:
    """Deep data analysis for business intelligence"""
    
    def __init__(self):
        self.cache = {}  # Simple cache for analysis results
        self.cache_ttl = 3600  # 1 hour cache
    
    async def analyze_table_data(self, db_connector, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Comprehensive statistical analysis of table data
        Returns business-friendly insights
        """
        cache_key = f"{connection_id}_{table_name}_analysis"
        
        # Check cache
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if (datetime.now() - timestamp).seconds < self.cache_ttl:
                return cached_data
        
        try:
            # Get table metadata
            row_count = await self._get_row_count(db_connector, connection_id, table_name)
            columns = await self._get_column_info(db_connector, connection_id, table_name)
            
            # Analyze sample data (limit for performance)
            sample_data = await self._get_sample_data(db_connector, connection_id, table_name, limit=10000)
            
            # Statistical analysis
            column_stats = await self._analyze_columns(sample_data, columns)
            
            # Data quality score
            quality_score = await self._calculate_quality_score(sample_data, columns)
            
            # Growth analysis (if timestamp column exists)
            growth_info = await self._analyze_growth(db_connector, connection_id, table_name, columns)
            
            # Generate plain English summary
            summary = self._generate_summary(table_name, row_count, column_stats, quality_score, growth_info)
            
            result = {
                'table_name': table_name,
                'row_count': row_count,
                'column_count': len(columns),
                'column_stats': column_stats,
                'data_quality_score': quality_score,
                'growth_info': growth_info,
                'summary': summary,
                'analyzed_at': datetime.now().isoformat()
            }
            
            # Cache result
            self.cache[cache_key] = (result, datetime.now())
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing table {table_name}: {str(e)}")
            return {
                'error': str(e),
                'table_name': table_name,
                'summary': f"Unable to analyze {table_name} table at this time."
            }
    
    async def _get_row_count(self, db_connector, connection_id: str, table_name: str) -> int:
        """Get total row count"""
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type'].lower()
            is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            q_table = f'"{table_name}"' if is_pg else f'`{table_name}`'
            query = f"SELECT COUNT(*) as count FROM {q_table}"
            result = await db_connector.query(connection_id, query)
            return result[0]['count'] if result else 0
        except:
            return 0
    
    async def _get_column_info(self, db_connector, connection_id: str, table_name: str) -> List[Dict]:
        """Get column information"""
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type'].lower()
            is_mysql = 'mysql' in db_type
            
            if is_mysql:
                query = f"""
                    SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, IS_NULLABLE as is_nullable
                    FROM information_schema.columns
                    WHERE TABLE_NAME = '{table_name}'
                    AND TABLE_SCHEMA = DATABASE()
                    ORDER BY ORDINAL_POSITION
                """
            else: # PostgreSQL/Default
                query = f"""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = '{table_name}'
                    ORDER BY ordinal_position
                """
            return await db_connector.query(connection_id, query)
        except:
            return []
    
    async def _get_sample_data(self, db_connector, connection_id: str, table_name: str, limit: int = 10000) -> List[Dict]:
        """Get sample data for analysis"""
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type'].lower()
            is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            q_table = f'"{table_name}"' if is_pg else f'`{table_name}`'
            query = f"SELECT * FROM {q_table} LIMIT {limit}"
            return await db_connector.query(connection_id, query)
        except:
            return []
    
    async def _analyze_columns(self, sample_data: List[Dict], columns: List[Dict]) -> Dict[str, Any]:
        """Analyze each column's data"""
        if not sample_data:
            return {}
        
        stats = {}
        total_rows = len(sample_data)
        
        for col_info in columns:
            col_name = col_info['column_name']
            col_type = col_info['data_type']
            
            # Extract column values
            values = [row.get(col_name) for row in sample_data if row.get(col_name) is not None]
            null_count = total_rows - len(values)
            
            col_stats = {
                'data_type': col_type,
                'null_count': null_count,
                'null_percentage': round((null_count / total_rows) * 100, 1) if total_rows > 0 else 0,
                'unique_count': len(set(values)) if values else 0
            }
            
            # Numeric analysis
            if col_type in ['integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint']:
                try:
                    numeric_values = [float(v) for v in values if v is not None]
                    if numeric_values:
                        col_stats.update({
                            'min': min(numeric_values),
                            'max': max(numeric_values),
                            'avg': round(statistics.mean(numeric_values), 2),
                            'median': round(statistics.median(numeric_values), 2)
                        })
                except:
                    pass
            
            # Text analysis
            elif col_type in ['character varying', 'text', 'varchar', 'char']:
                if values:
                    # Most common values
                    value_counts = {}
                    for v in values:
                        value_counts[v] = value_counts.get(v, 0) + 1
                    
                    top_values = sorted(value_counts.items(), key=lambda x: x[1], reverse=True)[:5]
                    col_stats['most_common'] = [{'value': v, 'count': c} for v, c in top_values]
            
            stats[col_name] = col_stats
        
        return stats
    
    async def _calculate_quality_score(self, sample_data: List[Dict], columns: List[Dict]) -> int:
        """Calculate data quality score (0-100)"""
        if not sample_data or not columns:
            return 0
        
        total_rows = len(sample_data)
        total_cells = total_rows * len(columns)
        
        # Count non-null cells
        non_null_cells = 0
        for row in sample_data:
            non_null_cells += sum(1 for v in row.values() if v is not None)
        
        # Completeness score (main factor)
        completeness = (non_null_cells / total_cells * 100) if total_cells > 0 else 0
        
        # Simple quality score (can be enhanced with more checks)
        quality_score = int(completeness)
        
        return min(100, max(0, quality_score))
    
    async def _analyze_growth(self, db_connector, connection_id: str, table_name: str, columns: List[Dict]) -> Dict[str, Any]:
        """Analyze growth trends if timestamp column exists"""
        # Find timestamp columns
        timestamp_cols = [
            col['column_name'] for col in columns 
            if col['data_type'] in ['timestamp', 'timestamp without time zone', 'timestamp with time zone', 'date']
        ]
        
        if not timestamp_cols:
            return {'has_timestamp': False}
        
        try:
            # Use first timestamp column (usually created_at)
            ts_col = timestamp_cols[0]
            db_type = conn_info['type'].lower()
            is_mysql = 'mysql' in db_type
            is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            
            q_table = f'"{table_name}"' if is_pg else f'`{table_name}`'
            
            # Get counts for last 30 days (DB agnostic)
            if is_mysql:
                query = f"""
                    SELECT 
                        DATE({ts_col}) as date,
                        COUNT(*) as count
                    FROM {q_table}
                    WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY DATE({ts_col})
                    ORDER BY date DESC
                    LIMIT 30
                """
            else:
                query = f"""
                    SELECT 
                        DATE({ts_col}) as date,
                        COUNT(*) as count
                    FROM {q_table}
                    WHERE {ts_col} >= NOW() - INTERVAL '30 days'
                    GROUP BY DATE({ts_col})
                    ORDER BY date DESC
                    LIMIT 30
                """
            
            results = await db_connector.query(connection_id, query)
            
            if results and len(results) >= 2:
                # Calculate growth
                recent_count = sum(r['count'] for r in results[:7])  # Last 7 days
                previous_count = sum(r['count'] for r in results[7:14])  # Previous 7 days
                
                if previous_count > 0:
                    growth_rate = ((recent_count - previous_count) / previous_count) * 100
                    
                    return {
                        'has_timestamp': True,
                        'timestamp_column': ts_col,
                        'growth_rate_weekly': round(growth_rate, 1),
                        'trend': 'growing' if growth_rate > 5 else 'declining' if growth_rate < -5 else 'stable',
                        'recent_activity': recent_count
                    }
            
            return {'has_timestamp': True, 'timestamp_column': ts_col, 'insufficient_data': True}
            
        except Exception as e:
            logger.error(f"Error analyzing growth: {str(e)}")
            return {'has_timestamp': True, 'error': str(e)}
    
    def _generate_summary(self, table_name: str, row_count: int, column_stats: Dict, 
                         quality_score: int, growth_info: Dict) -> str:
        """Generate plain English summary"""
        summary_parts = []
        
        # Row count
        summary_parts.append(f"This table contains {row_count:,} records")
        
        # Growth
        if growth_info.get('has_timestamp') and 'growth_rate_weekly' in growth_info:
            rate = growth_info['growth_rate_weekly']
            trend = growth_info['trend']
            
            if trend == 'growing':
                summary_parts.append(f"and is growing {abs(rate):.1f}% weekly")
            elif trend == 'declining':
                summary_parts.append(f"and is declining {abs(rate):.1f}% weekly")
            else:
                summary_parts.append("with stable activity")
        
        summary = '. '.join(summary_parts) + '.'
        
        # Data quality
        if quality_score >= 90:
            summary += f" Data quality is excellent ({quality_score}/100)."
        elif quality_score >= 70:
            summary += f" Data quality is good ({quality_score}/100), but some improvements are possible."
        else:
            summary += f" Data quality needs attention ({quality_score}/100)."
        
        # Highlight issues
        issues = []
        for col_name, stats in column_stats.items():
            if stats['null_percentage'] > 20:
                issues.append(f"{stats['null_percentage']:.0f}% missing {col_name}")
        
        if issues:
            summary += f" Issues found: {', '.join(issues[:3])}."
        
        return summary
    
    async def detect_data_quality_issues(self, db_connector, connection_id: str, table_name: str) -> List[Dict[str, Any]]:
        """Identify specific data quality problems"""
        issues = []
        
        try:
            # Get analysis
            analysis = await self.analyze_table_data(db_connector, connection_id, table_name)
            column_stats = analysis.get('column_stats', {})
            
            # Check for high null percentages
            for col_name, stats in column_stats.items():
                null_pct = stats.get('null_percentage', 0)
                if null_pct > 10:
                    severity = 'high' if null_pct > 30 else 'medium' if null_pct > 20 else 'low'
                    issues.append({
                        'type': 'missing_data',
                        'severity': severity,
                        'column': col_name,
                        'description': f"{null_pct:.1f}% of {col_name} values are missing",
                        'recommendation': f"Collect {col_name} data from users or set default values"
                    })
            
            # Check for low uniqueness (potential duplicates)
            row_count = analysis.get('row_count', 0)
            for col_name, stats in column_stats.items():
                unique_count = stats.get('unique_count', 0)
                if row_count > 0 and unique_count > 0:
                    uniqueness = (unique_count / row_count) * 100
                    
                    # If column looks like it should be unique but isn't
                    if 'id' in col_name.lower() and uniqueness < 95:
                        issues.append({
                            'type': 'duplicate_data',
                            'severity': 'high',
                            'column': col_name,
                            'description': f"Only {uniqueness:.1f}% unique values in {col_name} (expected 100%)",
                            'recommendation': f"Investigate and remove duplicate {col_name} values"
                        })
            
            return issues
            
        except Exception as e:
            logger.error(f"Error detecting quality issues: {str(e)}")
            return []
    
    async def find_correlations(self, db_connector, connection_id: str, table_name: str) -> List[Dict[str, Any]]:
        """Find correlations between numeric columns"""
        correlations = []
        
        try:
            # Get sample data
            sample_data = await self._get_sample_data(db_connector, connection_id, table_name, limit=5000)
            
            if not sample_data:
                return []
            
            # Find numeric columns
            numeric_cols = []
            for key in sample_data[0].keys():
                values = [row.get(key) for row in sample_data if row.get(key) is not None]
                try:
                    # Try to convert to float
                    numeric_values = [float(v) for v in values[:100]]
                    if len(numeric_values) > 10:
                        numeric_cols.append(key)
                except:
                    pass
            
            # Calculate correlations between pairs
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i+1:]:
                    try:
                        # Extract paired values
                        pairs = []
                        for row in sample_data:
                            v1, v2 = row.get(col1), row.get(col2)
                            if v1 is not None and v2 is not None:
                                try:
                                    pairs.append((float(v1), float(v2)))
                                except:
                                    pass
                        
                        if len(pairs) > 10:
                            # Simple correlation calculation
                            correlation = self._calculate_correlation(pairs)
                            
                            if abs(correlation) > 0.5:  # Only report significant correlations
                                strength = 'strong' if abs(correlation) > 0.7 else 'moderate'
                                
                                correlations.append({
                                    'column1': col1,
                                    'column2': col2,
                                    'correlation': round(correlation, 2),
                                    'strength': strength,
                                    'description': self._explain_correlation(col1, col2, correlation)
                                })
                    except:
                        pass
            
            return correlations
            
        except Exception as e:
            logger.error(f"Error finding correlations: {str(e)}")
            return []
    
    def _calculate_correlation(self, pairs: List[tuple]) -> float:
        """Calculate Pearson correlation coefficient"""
        if len(pairs) < 2:
            return 0.0
        
        x_values = [p[0] for p in pairs]
        y_values = [p[1] for p in pairs]
        
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(y_values)
        
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in pairs)
        
        x_variance = sum((x - x_mean) ** 2 for x in x_values)
        y_variance = sum((y - y_mean) ** 2 for y in y_values)
        
        denominator = (x_variance * y_variance) ** 0.5
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    def _explain_correlation(self, col1: str, col2: str, correlation: float) -> str:
        """Generate plain English explanation of correlation"""
        direction = "increases" if correlation > 0 else "decreases"
        strength = "strongly" if abs(correlation) > 0.7 else "moderately"
        
        return f"When {col1} increases, {col2} {strength} {direction}"


# Global instance
data_intelligence_analyzer = DataIntelligenceAnalyzer()
