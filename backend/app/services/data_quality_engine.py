"""
Data Quality Engine
Dedicated service for comprehensive data quality monitoring
"""
from typing import Dict, List, Any, Optional
import re
import logging

logger = logging.getLogger(__name__)


class DataQualityEngine:
    """Monitor and score data quality"""
    
    def __init__(self):
        self.email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        self.phone_patterns = [
            re.compile(r'^\d{10}$'),  # 1234567890
            re.compile(r'^\(\d{3}\)\s?\d{3}-\d{4}$'),  # (123) 456-7890
            re.compile(r'^\d{3}-\d{3}-\d{4}$'),  # 123-456-7890
        ]
    
    async def calculate_quality_score(self, db_connector, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Calculate comprehensive data quality score (0-100)
        Factors: completeness, accuracy, consistency, timeliness
        """
        try:
            # Get sample data
            sample_data = await self._get_sample_data(db_connector, connection_id, table_name, limit=5000)
            columns = await self._get_column_info(db_connector, connection_id, table_name)
            
            if not sample_data or not columns:
                return {'score': 0, 'error': 'No data available'}
            
            # Calculate individual scores
            completeness_score = await self._score_completeness(sample_data, columns)
            accuracy_score = await self._score_accuracy(sample_data, columns)
            consistency_score = await self._score_consistency(sample_data, columns)
            timeliness_score = await self._score_timeliness(db_connector, connection_id, table_name, columns)
            
            # Weighted average
            overall_score = int(
                completeness_score * 0.4 +
                accuracy_score * 0.3 +
                consistency_score * 0.2 +
                timeliness_score * 0.1
            )
            
            return {
                'overall_score': overall_score,
                'completeness': completeness_score,
                'accuracy': accuracy_score,
                'consistency': consistency_score,
                'timeliness': timeliness_score,
                'breakdown': self._generate_breakdown(
                    completeness_score, accuracy_score, 
                    consistency_score, timeliness_score
                )
            }
            
        except Exception as e:
            logger.error(f"Error calculating quality score: {str(e)}")
            return {'score': 0, 'error': str(e)}
    
    async def _get_sample_data(self, db_connector, connection_id: str, table_name: str, limit: int) -> List[Dict]:
        """Get sample data"""
        try:
            query = f"SELECT * FROM {table_name} LIMIT {limit}"
            return await db_connector.query(connection_id, query)
        except:
            return []
    
    async def _get_column_info(self, db_connector, connection_id: str, table_name: str) -> List[Dict]:
        """Get column information"""
        try:
            query = f"""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = '{table_name}'
            """
            return await db_connector.query(connection_id, query)
        except:
            return []
    
    async def _score_completeness(self, sample_data: List[Dict], columns: List[Dict]) -> int:
        """Score based on missing data (0-100)"""
        total_cells = len(sample_data) * len(columns)
        non_null_cells = 0
        
        for row in sample_data:
            non_null_cells += sum(1 for v in row.values() if v is not None and str(v).strip() != '')
        
        completeness = (non_null_cells / total_cells * 100) if total_cells > 0 else 0
        return int(completeness)
    
    async def _score_accuracy(self, sample_data: List[Dict], columns: List[Dict]) -> int:
        """Score based on format validation (0-100)"""
        validation_results = []
        
        for col in columns:
            col_name = col['column_name']
            
            # Email validation
            if 'email' in col_name.lower():
                values = [row.get(col_name) for row in sample_data if row.get(col_name)]
                if values:
                    valid_count = sum(1 for v in values if self.email_pattern.match(str(v)))
                    accuracy = (valid_count / len(values)) * 100
                    validation_results.append(accuracy)
            
            # Phone validation
            elif 'phone' in col_name.lower():
                values = [row.get(col_name) for row in sample_data if row.get(col_name)]
                if values:
                    valid_count = sum(
                        1 for v in values 
                        if any(pattern.match(str(v).replace(' ', '')) for pattern in self.phone_patterns)
                    )
                    accuracy = (valid_count / len(values)) * 100
                    validation_results.append(accuracy)
        
        # If no validatable columns, assume 100%
        return int(statistics.mean(validation_results)) if validation_results else 100
    
    async def _score_consistency(self, sample_data: List[Dict], columns: List[Dict]) -> int:
        """Score based on format consistency (0-100)"""
        consistency_scores = []
        
        for col in columns:
            col_name = col['column_name']
            values = [str(row.get(col_name)) for row in sample_data if row.get(col_name)]
            
            if not values:
                continue
            
            # Check format consistency for text fields
            if col['data_type'] in ['character varying', 'text', 'varchar']:
                # Check capitalization consistency
                if len(values) > 10:
                    all_upper = sum(1 for v in values if v.isupper())
                    all_lower = sum(1 for v in values if v.islower())
                    all_title = sum(1 for v in values if v.istitle())
                    
                    max_consistent = max(all_upper, all_lower, all_title)
                    consistency = (max_consistent / len(values)) * 100
                    consistency_scores.append(consistency)
        
        return int(statistics.mean(consistency_scores)) if consistency_scores else 100
    
    async def _score_timeliness(self, db_connector, connection_id: str, table_name: str, columns: List[Dict]) -> int:
        """Score based on data freshness (0-100)"""
        # Find timestamp columns
        timestamp_cols = [
            col['column_name'] for col in columns 
            if col['data_type'] in ['timestamp', 'timestamp without time zone', 'date']
        ]
        
        if not timestamp_cols:
            return 100  # No timestamp, assume fresh
        
        try:
            # Check last update
            ts_col = timestamp_cols[0]
            query = f"SELECT MAX({ts_col}) as last_update FROM {table_name}"
            result = await db_connector.query(connection_id, query)
            
            if result and result[0].get('last_update'):
                # Score based on recency (100 if today, decreasing over time)
                # This is simplified - can be enhanced
                return 90  # Placeholder
            
            return 100
            
        except:
            return 100
    
    def _generate_breakdown(self, completeness: int, accuracy: int, 
                           consistency: int, timeliness: int) -> str:
        """Generate plain English breakdown"""
        parts = []
        
        if completeness < 80:
            parts.append(f"Completeness needs improvement ({completeness}/100)")
        if accuracy < 80:
            parts.append(f"Some format validation issues ({accuracy}/100)")
        if consistency < 70:
            parts.append(f"Data formatting is inconsistent ({consistency}/100)")
        
        if not parts:
            return "All quality metrics are good"
        
        return "; ".join(parts)
    
    async def detect_duplicates(self, db_connector, connection_id: str, table_name: str) -> Dict[str, Any]:
        """Detect duplicate records"""
        try:
            # Find potential ID columns
            columns = await self._get_column_info(db_connector, connection_id, table_name)
            id_cols = [col['column_name'] for col in columns if 'id' in col['column_name'].lower()]
            
            if not id_cols:
                return {'has_duplicates': False, 'message': 'No ID column found'}
            
            # Check for duplicates
            id_col = id_cols[0]
            query = f"""
                SELECT {id_col}, COUNT(*) as count
                FROM {table_name}
                GROUP BY {id_col}
                HAVING COUNT(*) > 1
                LIMIT 100
            """
            
            duplicates = await db_connector.query(connection_id, query)
            
            if duplicates:
                total_duplicates = sum(d['count'] - 1 for d in duplicates)
                return {
                    'has_duplicates': True,
                    'duplicate_count': total_duplicates,
                    'description': f"Found {total_duplicates} duplicate records based on {id_col}",
                    'severity': 'high' if total_duplicates > 100 else 'medium'
                }
            
            return {'has_duplicates': False}
            
        except Exception as e:
            logger.error(f"Error detecting duplicates: {str(e)}")
            return {'error': str(e)}
    
    async def detect_format_inconsistencies(self, db_connector, connection_id: str, 
                                           table_name: str) -> List[Dict[str, Any]]:
        """Find formatting issues in common fields"""
        issues = []
        
        try:
            sample_data = await self._get_sample_data(db_connector, connection_id, table_name, limit=1000)
            
            if not sample_data:
                return []
            
            # Check email formats
            for row in sample_data:
                for key, value in row.items():
                    if 'email' in key.lower() and value:
                        if not self.email_pattern.match(str(value)):
                            issues.append({
                                'type': 'invalid_email',
                                'column': key,
                                'value': str(value),
                                'description': f"Invalid email format: {value}"
                            })
                            break  # Only report first instance
            
            # Check phone formats
            for row in sample_data:
                for key, value in row.items():
                    if 'phone' in key.lower() and value:
                        valid = any(pattern.match(str(value).replace(' ', '')) for pattern in self.phone_patterns)
                        if not valid:
                            issues.append({
                                'type': 'invalid_phone',
                                'column': key,
                                'value': str(value),
                                'description': f"Non-standard phone format: {value}"
                            })
                            break
            
            return issues[:10]  # Limit to 10 examples
            
        except Exception as e:
            logger.error(f"Error detecting format issues: {str(e)}")
            return []


# Import statistics for consistency scoring
import statistics

# Global instance
data_quality_engine = DataQualityEngine()
