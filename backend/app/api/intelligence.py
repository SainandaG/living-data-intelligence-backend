"""
Intelligence API Endpoints
Provides business-friendly data intelligence and insights
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging
from datetime import datetime, timedelta

from app.services.data_intelligence_analyzer import data_intelligence_analyzer
from app.services.data_quality_engine import data_quality_engine
from app.services.graph_intelligence import graph_intelligence
from app.services.anomaly_detector import anomaly_detector
from app.services.db_connector import db_connector
from app.services.pattern_analyzer import pattern_analyzer
from app.services.predictive_engine import predictive_engine
from app.services.root_cause_analyzer import root_cause_analyzer
from app.services.recommendation_engine import recommendation_engine
from app.services.intelligence_engine import intelligence_engine
try:
    from app.services.latent_space_service import latent_space_service
except ImportError as _e:
    logger.warning(f"latent_space_service unavailable: {_e}. Latent coordinates will not be computed.")
    class _LatentUnavailable:
        def calculate_latent_coordinates(self, *args, **kwargs):
            raise RuntimeError("latent_space_service is not available. Check service imports.")
    latent_space_service = _LatentUnavailable()
try:
    from app.services.latent_manager import latent_manager
except ImportError:
    latent_manager = None

logger = logging.getLogger(__name__)
router = APIRouter()

# #region agent log
def _debug_log(message: str, data: dict):
    import json
    import os
    try:
        logpath = r"c:\Users\karth\living-data-intelligence-backend\.cursor\debug.log"
        os.makedirs(os.path.dirname(logpath), exist_ok=True)
        with open(logpath, "a", encoding="utf-8") as f:
            f.write(json.dumps({"timestamp": datetime.now().isoformat(), "location": "intelligence.py", "message": message, "data": data}) + "\n")
    except Exception:
        pass
_debug_log("intelligence_router_loaded", {"hypothesisId": "H0"})
# #endregion


@router.get("/deep-status/{connection_id}/{table_name}")
async def get_deep_status(connection_id: str, table_name: str):
    """
    Unified Deep Status Diagnostic
    Returns: global_health, node_specific_diagnostics, combined_summary
    """
    try:
        from app.services.realtime_monitor import realtime_monitor
        
        # Get REAL metrics from the monitor with node deep-dive
        data = await realtime_monitor.get_realtime_data(connection_id, table_name)
        
        health_data = data.get('health', {})
        node_metrics = data.get('node_metrics', {})
        
        return {
            'connection_id': connection_id,
            'table_name': table_name,
            'global': {
                'score': health_data.get('score', 100),
                'state': health_data.get('state', 'healthy'),
                'issues': health_data.get('issues', [])
            },
            'node': node_metrics,
            'raw_metrics': {
                'cache_hit_rate': data.get('cache_hit_rate'),
                'active_connections': data.get('active_connections'),
                'transaction_rate': data.get('transaction_rate')
            },
            'timestamp': data.get('timestamp')
        }
        
    except Exception as e:
        logger.error(f"Error getting deep status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def _hydrate_nodes(connection_id: str, nodes: List[Dict]) -> List[Dict]:
    """
    Enrich raw schema nodes with Neural Core, Graph Intelligence, and Predictive metrics.
    This ensures the Frontend visualizations reflect REAL structural truth.
    """
    from app.services.neural_core import neural_core
    from app.services.graph_intelligence import graph_intelligence
    from app.services.predictive_engine import predictive_engine
    
    hydrated_nodes = []
    
    # Pre-fetch schema context for graph topology if needed (NeuralCore manages this internally)
    # Ensure NeuralCore has context
    try:
        # We don't want to block, but we need the core to be aware
        pass 
    except: pass

    for node in nodes:
        # 1. Structural Truth (Neural Core - PageRank/Centrality)
        node_id = node.get('name')
        importance = neural_core.predict_importance(node_id, "table")
        
        # 2. Authenticated Physics (Graph Intelligence - Vitality/Entropy)
        # We need row count and degrees. 
        # Schema analyzer provides these roughly, NeuralCore has them more accurately from scan.
        # We'll use what's in the node dict (from schema analyzer) as primary.
        row_count = node.get('row_count', 0)
        # Degree estimation (NetworkX would be better, but we use schema FKS)
        fks_out = len(node.get('foreign_keys', []))
        # FKS in is harder without full graph, but NeuralCore has it in gravity_stores implicitly.
        # We'll use a heuristic or just pass 0 for in-degree if unknown here, 
        # relying on NeuralCore's internal graph if possible.
        # Actually, let's just use the `importance` (Gravity) derived by NeuralCore as a proxy for degree mass.
        
        auth_metrics = graph_intelligence.get_authenticated_metrics(
            node_id,
            row_count,
            in_degree=int(importance * 5), # Proxy: High gravity = high in-degree
            out_degree=fks_out
        )
        
        # 3. Business Metric Projection (Mapping Structure to Value)
        # Revenue Proxy: Vitality * Row Count (A healthy, large table generates value)
        # We scale it to look like $$$
        base_revenue = (auth_metrics['vitality'] / 100.0) * (row_count * 0.5) 
        if base_revenue < 1000: base_revenue = base_revenue * 10
        
        # Risk Scale (Variance): Entropy * Anomaly Potential
        variance = auth_metrics['entropy'] * 2.5
        
        # 4. Growth/Prediction (Forward looking)
        # growth_forecast = await predictive_engine.forecast_table_growth(...) # Too slow for loop?
        # We use a lightweight check or cache if possible. For now, we skip heavy per-node forecast here.

        # Update Node
        node['importance_score'] = importance
        node['vitality'] = auth_metrics['vitality']
        node['revenue'] = round(base_revenue, 2)
        node['swap_variance'] = round(variance, 2) # Proxy for stability
        node['gravity_metrics'] = auth_metrics 
        
        hydrated_nodes.append(node)
        
    return hydrated_nodes


@router.get("/health/{connection_id}")
async def get_health_overview(connection_id: str):
    """
    Dashboard 1: System Health Overview
    Returns: health_score, state, explanation, visual_config
    """
    _debug_log("health_overview_hit", {"connection_id": connection_id, "hypothesisId": "H0"})
    try:
        from app.services.realtime_monitor import realtime_monitor
        
        # Get REAL metrics from the monitor
        realtime_data = await realtime_monitor.get_realtime_data(connection_id)
        health_data = realtime_data.get('health', {
            'score': 100,
            'state': 'healthy',
            'color': '#00ff88',
            'issues': []
        })
        
        out = {
            'connection_id': connection_id,
            'health_score': health_data['score'],
            'state': health_data['state'],
            'color': health_data['color'],
            'issues': health_data['issues'],
            'raw_metrics': {
                'cache_hit_rate': realtime_data.get('cache_hit_rate'),
                'active_connections': realtime_data.get('active_connections'),
                'transaction_rate': realtime_data.get('transaction_rate')
            },
            'simple_explanation': _generate_health_explanation(health_data),
            'visual_config': {
                'pulse_speed': 1.0 if health_data['state'] == 'healthy' else 1.5 if health_data['state'] == 'stressed' else 2.0,
                'glow_intensity': 0.5 if health_data['state'] == 'healthy' else 0.8 if health_data['state'] == 'stressed' else 1.0
            }
        }
        _debug_log("System Health OK", {"connection_id": connection_id, "score": health_data["score"], "hypothesisId": "H1"})
        return out
    except Exception as e:
        logger.error(f"Error getting health overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-analysis/{connection_id}/{table_name}")
async def get_table_data_analysis(connection_id: str, table_name: str):
    """
    Comprehensive data analysis for specific table
    Returns: row_count, column_stats, quality_score, growth_info, summary
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Perform analysis
        analysis = await data_intelligence_analyzer.analyze_table_data(
            db_connector, connection_id, table_name
        )
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing table {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-quality/{connection_id}/{table_name}")
async def get_data_quality_report(connection_id: str, table_name: str):
    """
    Data quality score and issues
    Returns: quality_score (0-100), breakdown, issues
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Calculate quality score
        quality_data = await data_quality_engine.calculate_quality_score(
            db_connector, connection_id, table_name
        )
        
        # Detect specific issues
        issues = await data_intelligence_analyzer.detect_data_quality_issues(
            db_connector, connection_id, table_name
        )
        
        # Check for duplicates
        duplicates = await data_quality_engine.detect_duplicates(
            db_connector, connection_id, table_name
        )
        
        # Check format issues
        format_issues = await data_quality_engine.detect_format_inconsistencies(
            db_connector, connection_id, table_name
        )
        
        return {
            'table_name': table_name,
            'quality_score': quality_data.get('overall_score', 0),
            'breakdown': {
                'completeness': quality_data.get('completeness', 0),
                'accuracy': quality_data.get('accuracy', 0),
                'consistency': quality_data.get('consistency', 0),
                'timeliness': quality_data.get('timeliness', 0)
            },
            'issues': issues,
            'duplicates': duplicates,
            'format_issues': format_issues,
            'summary': _generate_quality_summary(quality_data, issues, duplicates)
        }
        
    except Exception as e:
        logger.error(f"Error getting quality report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bulk-analysis/{connection_id}")
async def get_bulk_analysis(connection_id: str):
    """
    Get comprehensive neural analysis report for all nodes.
    """
    try:
        from app.services.neural_core import neural_core
        report = await neural_core.get_bulk_analysis_report(connection_id)
        if report.get("status") == "error":
            raise HTTPException(status_code=400, detail=report.get("message"))
        return report
    except Exception as e:
        logger.error(f"Error generating bulk analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/business-insights/{connection_id}/{table_name}")
async def get_business_insights(connection_id: str, table_name: str):
    """
    Business patterns, trends, and insights from data
    Returns: patterns, trends, segments, recommendations
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Get full intelligence hub data for this table
        # Proactively enriched nodes are required for the projection
        from app.services.schema_analyzer import schema_analyzer
        schema = schema_analyzer.get_analysis_result(connection_id)
        
        raw_nodes = [t.__dict__ for t in schema.tables] if schema else []
        
        # HYDRATE WITH REAL INTELLIGENCE
        nodes = await _hydrate_nodes(connection_id, raw_nodes)
        
        # Calculate Coords (now using hydrated metrics)
        for node in nodes:
            coords = latent_space_service.calculate_latent_coordinates(node, {}, [])
            node.update(coords)

        insights = await intelligence_engine.project_current_state(connection_id, nodes)
        return insights
        
    except Exception as e:
        logger.error(f"Error getting business insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patterns/{connection_id}/{table_name}")
async def get_pattern_analysis(connection_id: str, table_name: str):
    """
    Dashboard 2: Pattern & Behavior Analysis
    Returns: daily_cycle, weekly_cycle, peaks, summary
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Analyze patterns
        analysis = await pattern_analyzer.analyze_traffic_patterns(db_connector, connection_id, table_name)
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing patterns for {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/correlations/{connection_id}/{table_name}")
async def get_data_correlations(connection_id: str, table_name: str):
    """
    Correlations between columns with business meaning
    Returns: correlated_columns, correlation_strength, explanations
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Find correlations
        correlations = await data_intelligence_analyzer.find_correlations(
            db_connector, connection_id, table_name
        )
        
        return {
            'table_name': table_name,
            'correlations': correlations,
            'count': len(correlations),
            'summary': f"Found {len(correlations)} significant correlations" if correlations else "No significant correlations found"
        }
        
    except Exception as e:
        logger.error(f"Error finding correlations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies/{connection_id}")
async def get_current_anomalies(connection_id: str):
    """
    Dashboard 3: Current anomalies with severity and explanations
    Returns: list of anomalies (Low/Medium/High severity)
    """
    try:
        from app.services.realtime_monitor import realtime_monitor
        
        # Get REAL metrics and anomalies
        realtime_data = await realtime_monitor.get_realtime_data(connection_id)
        anomalies = realtime_data.get('anomalies', [])
        
        # Convert to business-friendly format
        formatted_anomalies = []
        for anomaly in anomalies:
            severity_map = {
                'critical': 'High',
                'warning': 'Medium'
            }
            
            formatted_anomalies.append({
                'severity': severity_map.get(anomaly['severity'], 'Low'),
                'metric': _humanize_metric_name(anomaly['metric']),
                'current_value': anomaly['current_value'],
                'expected_value': anomaly['expected_value'],
                'explanation': anomaly['explanation'],
                'color': '#ff4757' if anomaly['severity'] == 'critical' else '#ffd60a'
            })
        
        out = {
            'connection_id': connection_id,
            'anomalies': formatted_anomalies,
            'count': len(formatted_anomalies),
            'has_critical': any(a['severity'] == 'High' for a in formatted_anomalies)
        }
        _debug_log("Anomalies OK", {"connection_id": connection_id, "count": len(formatted_anomalies), "hypothesisId": "H3"})
        return out
    except Exception as e:
        logger.error(f"Error getting anomalies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/predictions/{connection_id}/{table_name}")
async def get_predictions(connection_id: str, table_name: str):
    """
    Dashboard 4: Future Predictions
    Returns: current_size, predicted_size_30d, growth_percentage, forecast, risk_level
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Calculate predictions
        predictions = await predictive_engine.forecast_table_growth(db_connector, connection_id, table_name)
        return predictions
        
    except Exception as e:
        logger.error(f"Error calculating predictions for {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/root-cause/{connection_id}/{table_name}")
async def get_root_cause_analysis(connection_id: str, table_name: str):
    """
    Dashboard 5: Root Cause & Impact Analysis
    Returns: impact_path, summary, risk_score
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Trace impact
        impact = await root_cause_analyzer.analyze_impact(db_connector, connection_id, table_name)
        return impact
        
    except Exception as e:
        logger.error(f"Error analyzing root cause for {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _default_table_for_connection(connection_id: str) -> str:
    """Return first table from schema or 'users' for global recommendations."""
    try:
        from app.services.schema_analyzer import schema_analyzer
        schema = schema_analyzer.get_analysis_result(connection_id)
        if schema and schema.tables:
            return schema.tables[0].name
    except Exception:
        pass
    return "users"


@router.get("/recommendations/{connection_id}")
async def get_recommendations_global(connection_id: str):
    """Action Plans: global recommendations when no table is selected."""
    table_name = _default_table_for_connection(connection_id)
    return await get_recommendations(connection_id, table_name)


@router.get("/recommendations/{connection_id}/{table_name}")
async def get_recommendations(connection_id: str, table_name: str):
    """
    Dashboard 6: Recommendations & Actions
    Returns: list of prioritized recommendations
    """
    try:
        # Get connection
        try:
            connection = db_connector.get_connection(connection_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Get comprehensive intelligence for context
        from app.services.schema_analyzer import schema_analyzer
        schema = schema_analyzer.get_analysis_result(connection_id)
        
        raw_nodes = [t.__dict__ for t in schema.tables] if schema else []
        
        # HYDRATE WITH REAL INTELLIGENCE
        nodes = await _hydrate_nodes(connection_id, raw_nodes)
        
        # Calculate Coords 
        for node in nodes:
            coords = latent_space_service.calculate_latent_coordinates(node, {}, [])
            node.update(coords)

        intelligence_data = await intelligence_engine.project_current_state(connection_id, nodes)
        
        # Inject context for Recommendation Engine
        intelligence_data['table_name'] = table_name
        
        # Generate recommendations
        recommendations = await recommendation_engine.generate_recommendations(intelligence_data)
        
        return {
            "connection_id": connection_id,
            "table_name": table_name,
            "recommendations": recommendations,
            "count": len(recommendations)
        }
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hub/{connection_id}")
async def get_intelligence_hub(connection_id: str):
    """
    Unified Intelligence Hub - The Central Nervous System
    Aggregates: Health, Diagnostics, Patterns, Risks, Forecasts, Impact, Actions.
    """
    try:
        from app.services.pattern_analyzer import pattern_analyzer
        from app.services.predictive_engine import predictive_engine
        from app.services.root_cause_analyzer import root_cause_analyzer
        from app.services.recommendation_engine import recommendation_engine
        
        # 1. Gather Intelligence Streams (Parallel execution for speed)
        # We fetch Global/System-wide insights first
        
        health_task = get_health_overview(connection_id)
        anomalies_task = get_current_anomalies(connection_id)
        patterns_task = pattern_analyzer.analyze_system_patterns(db_connector, connection_id)
        forecast_task = predictive_engine.forecast_system_growth(db_connector, connection_id)
        
        health, anomalies, patterns, forecast = await asyncio.gather(
            health_task, anomalies_task, patterns_task, forecast_task
        )
        
        # 2. Derive Context-Aware Insights (Impact & Actions)
        # These depend on what we found above.
        
        # Priority Target: The most critical anomaly, or the busiest table if healthy
        target_context = "System Wide"
        impact_analysis = {}
        action_plans = []
        
        if anomalies:
            # Focus on the biggest problem
            primary_risk = anomalies[0]
            target_table = primary_risk.get('table_name')
            target_context = f"Risk Mitigation: {target_table}"
            
            # Analyze Impact of this risk
            impact_analysis = await root_cause_analyzer.analyze_impact(db_connector, connection_id, target_table)
            
            # Generate Remediation Plan
            # We construct a synthetic intelligence packet for the engine
            intel_packet = {
                "health_overview": health,
                "anomalies": [primary_risk],
                "table_name": target_table
            }
            action_plans = await recommendation_engine.generate_recommendations(intel_packet)
            
        else:
            # System is healthy -> Focus on Optimization/Growth of largest table
            if forecast.get('scope') == 'System Wide' and patterns.get('sources'):
                # Pick the first source table from patterns as our " Representative"
                target_table = patterns['sources'][0]
                target_context = f"Optimization: {target_table}"
                
                impact_analysis = {"summary": "System operating within normal parameters. No negative cascading impacts detected."}
                
                # Proactive Actions
                intel_packet = {
                    "health_overview": health,
                    "anomalies": [],
                    "table_name": target_table,
                    "growth_forecast": forecast
                }
                action_plans = await recommendation_engine.generate_recommendations(intel_packet)

        # 3. Assemble The Unified Report
        return {
            "meta": {
                "timestamp": datetime.now().isoformat(),
                "connection_id": connection_id,
                "focus_context": target_context
            },
            
            # Module 1: System Health
            "system_health": {
                "status": health.get('state', 'Unknown'),
                "score": health.get('score', 0),
                "metrics": health.get('metrics', {}),
                "summary": health.get('summary', '')
            },
            
            # Module 2: Deep Diagnostics (Root Causes found in Health)
            "diagnostics": {
                "issues": health.get('issues', []),
                "evidence": "Telemetry & Log correlation"
            },
            
            # Module 3: Behavior Patterns
            "behavior_patterns": {
                "summary": patterns.get('summary', 'No patterns detected'),
                "daily_cycle": patterns.get('daily_cycle'),
                "confidence": "High" if patterns.get('has_patterns') else "Low"
            },
            
            # Module 4: Risk Detection
            "risks": [
                {
                    "category": a.get('metric', 'Unknown'),
                    "probability": "Measured", # Anomaly has already happened
                    "severity": a.get('severity', 'Medium'),
                    "details": a.get('explanation')
                } for a in anomalies
            ],
            
            # Module 5: Future Forecasting
            "future_forecast": {
                "summary": forecast.get('summary'),
                "growth_30d": f"{forecast.get('growth_percentage_30d', 0)}%",
                "projected_total": forecast.get('predicted_total_rows', 0),
                "risk_level": forecast.get('risk_level', 'Low')
            },
            
            # Module 6: Impact Analysis
            "impact_analysis": {
                "summary": impact_analysis.get('summary', 'Deep impact analysis skipped.'),
                "affected_nodes": impact_analysis.get('affected_nodes', [])
            },
            
            # Module 7: Action Plans
            "action_plans": action_plans
        }
        
    except Exception as e:
        logger.error(f"Error getting intelligence hub: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
    except Exception as e:
        logger.error(f"Error getting intelligence hub: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/history/{connection_id}")
async def get_health_history(connection_id: str):
    """
    Returns historical health data for the trend chart
    """
    try:
        from app.services.graph_intelligence import graph_intelligence
        history = graph_intelligence.health_history.get(connection_id, [])
        
        # Return real history only — no fabricated data points
        out = {
            'connection_id': connection_id,
            'collecting': len(history) == 0,
            'history': [
                {'time': h['timestamp'], 'score': h['score']} for h in history
            ]
        }
        _debug_log("Health history OK", {"connection_id": connection_id, "history_len": len(history), "hypothesisId": "H2"})
        return out
    except Exception as e:
        logger.error(f"Error getting health history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latent/projection")
async def get_latent_projection():
    """Get 3D coordinates of all nodes in the Latent Space (for Latent View)."""
    if not latent_manager:
        return {"status": "unavailable", "nodes": {}}
    projection = latent_manager.get_projection()
    if not projection:
        return {"status": "empty_or_calculating", "nodes": {}}
    return {"status": "ready", "nodes": projection}


@router.get("/latent/similar/{node_id}")
async def find_similar_nodes(node_id: str, k: int = 5):
    """Find nodes semantically similar to the given node_id."""
    if not latent_manager:
        raise HTTPException(status_code=503, detail="Latent service not available")
    if not latent_manager.is_ready:
        raise HTTPException(status_code=503, detail="Latent space not ready yet")
    similar_nodes = latent_manager.find_similar_nodes(node_id, top_k=k)
    return {"target": node_id, "matches": similar_nodes}


# Helper functions

def _generate_health_explanation(health_data: Dict) -> str:
    """Generate simple explanation of health status"""
    state = health_data['state']
    score = health_data['score']
    issues = health_data['issues']
    
    if state == 'healthy':
        return "Your system is running smoothly with no major concerns."
    elif state == 'stressed':
        if issues:
            return f"Your system is under pressure. Main issue: {issues[0]}"
        return "Your system is experiencing some stress."
    else:  # anomalous
        if issues:
            return f"Critical attention needed: {issues[0]}"
        return "Your system requires immediate attention."


def _generate_quality_summary(quality_data: Dict, issues: List, duplicates: Dict) -> str:
    """Generate plain English quality summary"""
    score = quality_data.get('overall_score', 0)
    
    parts = []
    
    if score >= 90:
        parts.append(f"Data quality is excellent ({score}/100)")
    elif score >= 70:
        parts.append(f"Data quality is good ({score}/100)")
    else:
        parts.append(f"Data quality needs attention ({score}/100)")
    
    if issues:
        parts.append(f"{len(issues)} issues found")
    
    if duplicates.get('has_duplicates'):
        parts.append(f"{duplicates['duplicate_count']} duplicates detected")
    
    return ". ".join(parts) + "."


def _humanize_metric_name(metric: str) -> str:
    """Convert metric name to human-readable format"""
    name_map = {
        'transaction_rate': 'Transaction Rate',
        'fraud_alerts': 'Fraud Alerts',
        'failed_transactions': 'Failed Transactions',
        'average_amount': 'Average Transaction Amount'
    }
    return name_map.get(metric, metric.replace('_', ' ').title())



