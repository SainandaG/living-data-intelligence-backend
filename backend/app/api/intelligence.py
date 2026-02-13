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

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.get("/health/{connection_id}")
async def get_health_overview(connection_id: str):
    """
    Dashboard 1: System Health Overview
    Returns: health_score, state, explanation, visual_config
    """
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
        
        return {
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
        nodes = []
        if schema:
            for t in schema.tables:
                coords = latent_space_service.calculate_latent_coordinates(t.__dict__, {}, [])
                nodes.append({**t.__dict__, **coords})

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
        
        return {
            'connection_id': connection_id,
            'anomalies': formatted_anomalies,
            'count': len(formatted_anomalies),
            'has_critical': any(a['severity'] == 'High' for a in formatted_anomalies)
        }
        
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
        nodes = []
        if schema:
            for t in schema.tables:
                coords = latent_space_service.calculate_latent_coordinates(t.__dict__, {}, [])
                nodes.append({**t.__dict__, **coords})

        intelligence_data = await intelligence_engine.project_current_state(connection_id, nodes)
        
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
    Unified Intelligence Hub - all dashboards data in one call
    Returns: health, anomalies, top_insights
    """
    try:
        # Get health overview
        health = await get_health_overview(connection_id)
        
        # Get anomalies
        anomalies = await get_current_anomalies(connection_id)
        
        return {
            'connection_id': connection_id,
            'health': health,
            'anomalies': anomalies,
            'timestamp': datetime.now().isoformat()
        }
        
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
        
        # If no history, generate some baseline points to avoid empty chart
        if not history:
            now = datetime.now()
            history = []
            for i in range(24):
                ts = (now - timedelta(hours=23-i)).isoformat()
                history.append({
                    'timestamp': ts,
                    'score': 100,
                    'state': 'healthy'
                })
        
        return {
            'connection_id': connection_id,
            'history': [
                {
                    'time': h['timestamp'],
                    'score': h['score']
                } for h in history
            ]
        }
    except Exception as e:
        logger.error(f"Error getting health history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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



