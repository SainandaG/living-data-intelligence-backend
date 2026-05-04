"""
Recommendation Engine Service
Generates actionable recommendations based on system health and intelligence.
"""
import logging
import json
from app.services.db_connector import db_connector
from app.services.chat_service import chat_service

logger = logging.getLogger(__name__)

class RecommendationEngine:
    """Service for translating intelligence findings into actionable business tasks"""
    
    def __init__(self):
        pass
        

    async def _wezu_battery_recommendations(self, connection_id: str) -> list:
        """Generate WEZU-specific battery health and temperature recommendations."""
        recs = []
        try:
            res = await db_connector.query(connection_id,
                "SELECT AVG(soh_percentage) as avg_soh, AVG(temperature) as avg_temp FROM batteries")
            if res and res[0].get('avg_soh') is not None:
                avg_soh = float(res[0]['avg_soh'])
                avg_temp = float(res[0]['avg_temp'] or 25.0)
                if avg_soh < 90.0:
                    recs.append({
                        "category": "Maintenance",
                        "urgency": "High" if avg_soh < 80 else "Medium",
                        "title": "Module Augmentation Needed",
                        "description": f"Average State of Health (SoH) has dropped to {avg_soh:.1f}%. Capacity is degrading.",
                        "solution": "Schedule replacement for bottom 10% performing modules.",
                        "action": "Order Replacements",
                        "benefit": "Restores fleet energy capacity."
                    })
                if avg_temp > 40.0:
                    recs.append({
                        "category": "Risk", "urgency": "High",
                        "title": "Cooling System Alert",
                        "description": f"Average battery temperature is {avg_temp:.1f}C, exceeding optimal range.",
                        "solution": "Inspect coolant pumps and radiator fans. Check for air intake blockages.",
                        "action": "Dispatch Field Tech",
                        "benefit": "Prevents thermal runaway risks."
                    })
        except Exception as e:
            logger.warning(f"Failed to fetch battery recommendations: {e}")
        return recs

    async def _ai_recommendations(self, intelligence_data: dict) -> list:
        """Try to generate AI-powered recommendations; returns empty list on any failure."""
        try:
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
Based on the EXACT statistics below, generate 3-4 prioritized architectural recommendations.
Be specific  reference actual column names, null percentages, or growth trends from the data.

DATA CONTEXT:
{json.dumps(context, indent=2)}

Return ONLY a JSON list, each item with: title, category, urgency, description, solution, action, benefit."""
            response = await chat_service.generate_response(prompt, "recommendation_context")
            import re
            json_match = re.search(r'\[\s*\{.*\}\s*\]', response['response'], re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
        except Exception as e:
            logger.error(f"AI recommendation generation failed: {e}")
        return []

    def _rule_based_recommendations(self, intelligence_data: dict) -> list:
        """Produce rule-based recommendations covering health, anomalies, quality, and growth."""
        recs = []
        health_data = intelligence_data.get('health_overview', {})
        health_score = health_data.get('score', 100)
        state = health_data.get('state', 'healthy')
        anomalies = intelligence_data.get('anomalies', [])

        if state == 'anomalous' or health_score < 40:
            recs.append({"category": "Performance", "urgency": "High", "title": "Immediate Resource Review",
                "description": f"System health is critical ({health_score}/100).",
                "solution": "Architectural audit required. Check for runaway queries or connection pooling issues.",
                "action": "Open Metrics Explorer", "benefit": "Prevents potential system downtime."})

        if anomalies:
            critical_anom = [a for a in anomalies if a.get('severity') == 'High']
            if critical_anom:
                recs.append({"category": "Risk", "urgency": "High",
                    "title": f"Investigate {critical_anom[0]['metric']} Spike",
                    "description": critical_anom[0]['explanation'],
                    "solution": f"Apply rate limiting to the affected {critical_anom[0]['metric']} flow.",
                    "action": "Trace Root Cause", "benefit": "Identifies source of instability."})
            else:
                recs.append({"category": "Pattern", "urgency": "Medium", "title": "Unusual Activity Detected",
                    "description": f"Identified {len(anomalies)} moderate deviations from baseline.",
                    "solution": "Monitor the trend closely. Consider adjusting detection thresholds.",
                    "action": "Review Anomalies", "benefit": "Early detection of emerging issues."})

        quality_score = intelligence_data.get('data_quality', {}).get('overall_score', 100)
        if quality_score < 80:
            recs.append({"category": "Data Quality", "urgency": "Medium", "title": "Optimize Data Integrity",
                "description": f"Data quality score is {quality_score}%.",
                "solution": "Implement stricter schema validation. Run batch deduplication and automated cleaning.",
                "action": "Run Quality Scan", "benefit": "Improves AI analysis accuracy."})

        growth_data = intelligence_data.get('growth_forecast', {})
        if growth_data.get('risk_level') == 'High' or growth_data.get('growth_percentage_30d', 0) > 50:
            recs.append({"category": "Growth", "urgency": "Medium", "title": "Infrastructure Scalability Plan",
                "description": f"Rapid data growth ({growth_data.get('growth_percentage_30d', 0)}% monthly) detected.",
                "solution": "Evaluate table partitioning and cold storage for older logs.",
                "action": "Configure Partitioning", "benefit": "Ensures long-term performance stability."})

        defaults = [
            {"category": "Optimization", "urgency": "Low", "title": "Routine Vacuum & Analyze",
             "description": "Maintain statistic accuracy for the query planner.",
             "solution": "Schedule VACUUM ANALYZE during the next low-traffic window.",
             "action": "Schedule Maintenance", "benefit": "Optimizes query execution plans."},
            {"category": "Security", "urgency": "Low", "title": "Access Policy Audit",
             "description": "Standard governance review cycle.",
             "solution": "Review RBAC grants. Enforce Least Privilege principle.",
             "action": "View Permissions", "benefit": "Reduces unauthorized data exposure risk."},
            {"category": "Resilience", "urgency": "Low", "title": "Backup Integrity Check",
             "description": "Verify restorability of recent snapshots.",
             "solution": "Perform a test restore to a staging environment.",
             "action": "Verify Backups", "benefit": "Guarantees business continuity."},
        ]
        while len(recs) < 3:
            recs.append(defaults[len(recs) % len(defaults)])
        return recs

    async def generate_recommendations(self, intelligence_data: dict) -> list:
        """Generate prioritized recommendations: WEZU-specific  AI  rule-based fallback."""
        table_name = intelligence_data.get('table_name', '')
        connection_id = intelligence_data.get('connection_id')

        if table_name == 'batteries' and connection_id:
            wezu_recs = await self._wezu_battery_recommendations(connection_id)
            if wezu_recs:
                return wezu_recs

        if chat_service.has_ai:
            ai_recs = await self._ai_recommendations(intelligence_data)
            if ai_recs:
                return ai_recs

        return self._rule_based_recommendations(intelligence_data)


# Global instance
recommendation_engine = RecommendationEngine()
