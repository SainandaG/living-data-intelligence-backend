"""
Intelligence Engine Orchestrator
The central brain that unifies all intelligence services and formats data for dashboards.
"""
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime

# Import specialized services
from app.services.graph_intelligence import graph_intelligence
from app.services.anomaly_detector import anomaly_detector
from app.services.data_intelligence_analyzer import data_intelligence_analyzer
from app.services.data_quality_engine import data_quality_engine
from app.services.pattern_analyzer import pattern_analyzer
from app.services.predictive_engine import predictive_engine
from app.services.root_cause_analyzer import root_cause_analyzer
from app.services.recommendation_engine import recommendation_engine

logger = logging.getLogger(__name__)

class IntelligenceEngine:
    """Unified access point for all system intelligence and business insights"""
    
    def __init__(self):
        pass
        
    async def get_comprehensive_intelligence(self, db_connector, connection_id: str, table_name: Optional[str] = None) -> Dict[str, Any]:
        """Collect and unify data from all intelligence services for a high-level overview"""
        try:
            # 1. System Health
            from app.services.realtime_monitor import realtime_monitor
            realtime_data = await realtime_monitor.get_realtime_data(connection_id)
            metrics = realtime_data.get('data', {})
            health = realtime_data.get('health', {'score': 100, 'state': 'healthy'})
            
            # 2. Anomalies
            anomalies = realtime_data.get('anomalies', [])
            
            # 3. Data Insights (if table specified)
            data_analysis = {}
            if table_name:
                data_analysis = await data_intelligence_analyzer.analyze_table_data(db_connector, connection_id, table_name)
                quality = await data_quality_engine.calculate_quality_score(db_connector, connection_id, table_name)
                patterns = await pattern_analyzer.analyze_traffic_patterns(db_connector, connection_id, table_name)
                forecast = await predictive_engine.forecast_table_growth(db_connector, connection_id, table_name)
                impact = await root_cause_analyzer.analyze_impact(db_connector, connection_id, table_name)
                
                # Format specialized insights
                data_analysis.update({
                    "quality_metrics": quality,
                    "behavioral_patterns": patterns,
                    "growth_forecast": forecast,
                    "structural_impact": impact
                })
            
            # 4. Generate Recommendations
            # Prepare contextual data for the recommendation engine
            context = {
                "table_name": table_name,
                "health_overview": health,
                "anomalies": anomalies,
                "data_analysis": {
                    "summary": data_analysis.get('summary'),
                    "column_stats": data_analysis.get('column_stats'),
                    "quality_score": data_analysis.get('data_quality_score'),
                },
                "growth_forecast": data_analysis.get('growth_forecast', {}),
                "structural_impact": impact,
                "business_patterns": patterns
            }
            recommendations = await recommendation_engine.generate_recommendations(context)
            
            return {
                "connection_id": connection_id,
                "timestamp": datetime.now().isoformat(),
                "health": health,
                "anomalies": anomalies,
                "data_insights": data_analysis,
                "recommendations": recommendations,
                "summary": self._generate_global_summary(health, anomalies, recommendations)
            }
            
        except Exception as e:
            logger.error(f"Failed to gather comprehensive intelligence: {e}")
            return {"error": str(e), "status": "partial_failure"}

    def _generate_global_summary(self, health: Dict, anomalies: List, recommendations: List) -> str:
        """Create a holistic plain English summary of the system state"""
        score = health.get('score', 0)
        state = health.get('state', 'unknown')
        
        summary = f"System health is currently {score}/100 ({state}). "
        
        if anomalies:
            summary += f"We've detected {len(anomalies)} unusual patterns that require review. "
        else:
            summary += "No critical anomalies are currently affecting the system. "
            
        if recommendations:
            top_rec = recommendations[0]
            summary += f"Priority recommendation: {top_rec['title']}."
            
        return summary

# Global instance
intelligence_engine = IntelligenceEngine()
