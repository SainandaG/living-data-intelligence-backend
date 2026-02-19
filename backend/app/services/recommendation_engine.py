"""
Recommendation Engine Service
Generates actionable recommendations based on system health and intelligence.
"""
from typing import Dict, List, Any, Optional
import logging
import json
import asyncio
from app.services.db_connector import db_connector
from app.services.chat_service import chat_service

logger = logging.getLogger(__name__)

class RecommendationEngine:
    """Service for translating intelligence findings into actionable business tasks"""
    
    def __init__(self):
        pass
        
    async def generate_recommendations(self, intelligence_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate a list of prioritized recommendations based on diverse intelligence data"""
        recommendations = []
        
        # 0. WEZU DOMAIN SPECIFIC LOGIC
        # Targeted checks for Energy/Grid infrastructure
        table_name = intelligence_data.get('table_name', '')
        connection_id = intelligence_data.get('connection_id')
        
        if table_name == 'batteries' and connection_id:
            try:
                # Direct health check for batteries
                # We need to know if columns exist, but we established they likely do if we are here
                # Use a safe query
                q = "SELECT AVG(soh_percentage) as avg_soh, AVG(temperature) as avg_temp FROM batteries"
                # Fallback for old schema if needed? We fixed realtime_monitor, assuming schema is consistent or query handles it.
                # Actually, let's just try/except the query
                res = await db_connector.query(connection_id, q)
                if res and res[0].get('avg_soh') is not None:
                    avg_soh = float(res[0]['avg_soh'])
                    avg_temp = float(res[0]['avg_temp'] or 25.0)
                    
                    if avg_soh < 90.0:
                         recommendations.append({
                            "category": "Maintenance",
                            "urgency": "High" if avg_soh < 80 else "Medium",
                            "title": "Module Augmentation Needed",
                            "description": f"Average State of Health (SoH) has dropped to {avg_soh:.1f}%. Capacity is degrading.",
                            "solution": "Schedule replacement for bottom 10% performing modules to restore pack capacity.",
                            "action": "Order Replacements",
                            "benefit": "Restores fleet energy capacity."
                        })
                    
                    if avg_temp > 40.0:
                         recommendations.append({
                            "category": "Risk",
                            "urgency": "High",
                            "title": "Cooling System Alert",
                            "description": f"Average battery temperature is {avg_temp:.1f}┬░C, exceeding optimal range.",
                            "solution": "Inspect coolant pumps and radiator fans. Check for air intake blockages.",
                            "action": "Dispatch Field Tech",
                            "benefit": "Prevents thermal runaway risks."
                        })
            except Exception as e:
                logger.warning(f"Failed to fetch battery recommendations: {e}")
        
        # Try to use AI for high-level business recommendations if available
        if chat_service.has_ai:

            try:
                # Prepare a hyper-specific context for the AI
                context = {
                    "table_name": intelligence_data.get('table_name'),
                    "health_score": intelligence_data.get('health_overview', {}).get('health_score'),
                    "state": intelligence_data.get('health_overview', {}).get('state'),
                    "anomalies": intelligence_data.get('anomalies', []),
                    "data_profile": {
                        "column_stats": intelligence_data.get('data_analysis', {}).get('column_stats'),
                        "quality_score": intelligence_data.get('data_analysis', {}).get('quality_score'),
                    },
                    "growth": intelligence_data.get('growth_forecast', {}),
                    "impact": intelligence_data.get('structural_impact', {}),
                    "patterns": intelligence_data.get('business_patterns', {})
                }
                
                prompt = f"""You are a Database Architect analyzing the "{context['table_name']}" table. 
                Based on the EXACT database statistics below, generate 3-4 prioritized HIGH-LEVEL architectural solutions. 
                BE SPECIFIC: Reference actual column names, null percentages, or growth trends found in the DATA.
                Avoid generic advice.
                
                DATA CONTEXT:
                {json.dumps(context, indent=2)}
                
                Format each recommendation as a JSON object in a list. 
                EXAMPLE JSON:
                [
                  {{
                    "title": "Optimize 'user_id' Indexing",
                    "category": "Performance",
                    "urgency": "High",
                    "description": "High row count (1.2M) and frequent scans on 'user_id' detected.",
                    "solution": "The 'user_id' column has 0% nulls but high cardinality. Implement a B-Tree index to speed up join operations.",
                    "action": "Configure Partitioning",
                    "benefit": "Reduction in query latency by ~60%."
                  }}
                ]

                Return ONLY the JSON list.
                """
                
                response = await chat_service.generate_response(prompt, "recommendation_context")
                # Extract JSON from response
                import re
                json_match = re.search(r'\[\s*\{.*\}\s*\]', response['response'], re.DOTALL)
                if json_match:
                    ai_recommendations = json.loads(json_match.group(0))
                    return ai_recommendations
            except Exception as e:
                logger.error(f"AI recommendation generation failed: {e}")
                # Fallback to rule-based
        
        # Rule-based fallback (original logic)
        recommendations = []
        
        health_data = intelligence_data.get('health_overview', {})
        health_score = health_data.get('score', 100)
        state = health_data.get('state', 'healthy')
        anomalies = intelligence_data.get('anomalies', [])
        
        # 1. Critical Performance/Health
        if state == 'anomalous' or health_score < 40:
            recommendations.append({
                "category": "Performance",
                "urgency": "High",
                "title": "Immediate Resource Review",
                "description": f"System health is critical ({health_score}/100) due to multiple anomalies and high failure rates.",
                "solution": "High-level architectural audit required. Check for runaway queries, connection pooling issues, or underlying infrastructure instability.",
                "action": "Open Metrics Explorer",
                "benefit": "Prevents potential system downtime."
            })
        
        # 2. Anomaly Response
        if anomalies:
            critical_anom = [a for a in anomalies if a.get('severity') == 'High']
            if critical_anom:
                recommendations.append({
                    "category": "Risk",
                    "urgency": "High",
                    "title": f"Investigate {critical_anom[0]['metric']} Spike",
                    "description": critical_anom[0]['explanation'],
                    "solution": f"Apply rate limiting or circuit breaker patterns to the affected {critical_anom[0]['metric']} flow. Verify if recent code deployments or database configuration changes triggered this spike.",
                    "action": "Trace Root Cause",
                    "benefit": "Identifies the source of system instability."
                })
            else:
                recommendations.append({
                    "category": "Pattern",
                    "urgency": "Medium",
                    "title": "Unusual Activity Detected",
                    "description": f"Identified {len(anomalies)} moderate deviations from baseline behavior.",
                    "solution": "Monitor the trend closely. If deviations persist, consider adjusting detection thresholds or scaling resources for the flagged metrics.",
                    "action": "Review Anomalies",
                    "benefit": "Early detection of emerging issues."
                })

        # 3. Data Quality
        quality_score = intelligence_data.get('data_quality', {}).get('overall_score', 100)
        if quality_score < 80:
            recommendations.append({
                "category": "Data Quality",
                "urgency": "Medium",
                "title": "Optimize Data Integrity",
                "description": f"Data quality score is {quality_score}%. Missing values or duplicates detected in key columns.",
                "solution": "Implement stricter schema validation at the application layer. Consider running a batch deduplication process and establishing automated data cleaning scripts.",
                "action": "Run Quality Scan",
                "benefit": "Improves AI analysis accuracy and business reporting."
            })
            
        # 4. Growth Risks
        growth_data = intelligence_data.get('growth_forecast', {})
        if growth_data.get('risk_level') == 'High' or growth_data.get('growth_percentage_30d', 0) > 50:
            recommendations.append({
                "category": "Growth",
                "urgency": "Medium",
                "title": "Infrastructure Scalability Plan",
                "description": f"Rapid data growth ({growth_data.get('growth_percentage_30d', 0)}% monthly) detected. Storage reaching limits.",
                "solution": "Architect a horizontal scaling strategy. Evaluate table partitioning by date or region, and consider moving older logs/history to cold storage to maintain performance.",
                "action": "Configure Partitioning",
                "benefit": "Ensures long-term performance stability."
            })
            
        # Default / Proactive Maintenance Protocol
        # Ensure we ALWAYS have actionable intelligence (The "Working Properly" requirement)
        if len(recommendations) < 3:
            # 1. Efficiency Action
            recommendations.append({
                "category": "Optimization",
                "urgency": "Low",
                "title": "Routine Vacuum & Analyze",
                "description": "Maintain statistic accuracy for the query planner.",
                "solution": "Schedule a VACUUM ANALYZE (or equivalent) during the next low-traffic window to reclaim storage and update data distribution stats.",
                "action": "Schedule Maintenance",
                "benefit": "Optimizes query execution plans."
            })
            
            # 2. Security Action
            recommendations.append({
                "category": "Security",
                "urgency": "Low",
                "title": "Access Policy Audit",
                "description": "Standard governance review cycle.",
                "solution": "Review role-based access control (RBAC) grants for this table. Ensure 'Least Privilege' principle is enforced.",
                "action": "View Permissions",
                "benefit": "Reduces unauthorized data exposure risk."
            })
            
            # 3. Reliability Action
            recommendations.append({
                "category": "Resilience",
                "urgency": "Low",
                "title": "Backup Integrity Check",
                "description": "Verify restorability of recent snapshots.",
                "solution": "Perform a test restore of this table to a staging environment to validate data consistency and RTO objectives.",
                "action": "Verify Backups",
                "benefit": "Guarantees business continuity."
            })
            
        return recommendations

# Global instance
recommendation_engine = RecommendationEngine()
