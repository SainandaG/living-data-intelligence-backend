"""
Node X-Ray API — Aggregated deep analytics for a single table node.
Powers the Node X-Ray overlay in the 3D Latent Space view.
"""
from fastapi import APIRouter, HTTPException
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/node-xray/{connection_id}/{table_name}")
async def get_node_xray(connection_id: str, table_name: str):
    """
    Returns comprehensive analytics for a single table node — 
    the kind of deep analysis a data analyst would normally do manually.
    
    Aggregates: column profiling, quality score, growth forecast,
    correlations, sample records, AND transaction timeline into one response.
    """
    from app.services.db_connector import db_connector
    from app.services.data_intelligence_analyzer import data_intelligence_analyzer
    from app.services.predictive_engine import predictive_engine
    from app.services.drill_down import drill_down_service

    # Verify connection exists
    try:
        db_connector.get_connection(connection_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Database connection not found.")

    # Run all analyses in parallel for speed
    results = await asyncio.gather(
        _safe(data_intelligence_analyzer.analyze_table_data(db_connector, connection_id, table_name)),
        _safe(data_intelligence_analyzer.find_correlations(db_connector, connection_id, table_name)),
        _safe(predictive_engine.forecast_table_growth(db_connector, connection_id, table_name)),
        _safe(drill_down_service.get_table_sample(connection_id, table_name, 5)),
        _safe(_get_transaction_timeline(db_connector, connection_id, table_name)),
        return_exceptions=True
    )

    profile_data = results[0] if not isinstance(results[0], Exception) else {}
    correlations = results[1] if not isinstance(results[1], Exception) else []
    growth = results[2] if not isinstance(results[2], Exception) else {}
    samples = results[3] if not isinstance(results[3], Exception) else {}
    timeline = results[4] if not isinstance(results[4], Exception) else {}

    # Merge forecast projection into timeline for combined chart
    forecast_data = growth.get("forecast", [])
    history_data = timeline.get("history", [])

    return {
        "table_name": table_name,
        "connection_id": connection_id,
        # Column profiling (types, null %, unique counts, min/max/avg, top values)
        "column_stats": profile_data.get("column_stats", {}),
        # Data quality score (0-100)
        "quality_score": profile_data.get("data_quality_score", 0),
        # Row count
        "row_count": profile_data.get("row_count", 0),
        # Plain-English summary
        "summary": profile_data.get("summary", ""),
        # Growth trend info
        "growth": {
            "rate_percent": growth.get("growth_percentage_30d", 0),
            "projected_30d": growth.get("predicted_size_30d", 0),
            "current_size": growth.get("current_size", 0),
            "risk_level": growth.get("risk_level", "Unknown"),
            "summary": growth.get("summary", ""),
        },
        # Transaction Timeline — historical daily counts (last 30 days)
        "timeline": {
            "has_timestamp": timeline.get("has_timestamp", False),
            "timestamp_column": timeline.get("timestamp_column", None),
            "history": history_data,           # [{date, count}, ...]
            "forecast": forecast_data,         # [{date, predicted_count}, ...]
            "total_recent_7d": timeline.get("total_recent_7d", 0),
            "total_previous_7d": timeline.get("total_previous_7d", 0),
            "weekly_change_pct": timeline.get("weekly_change_pct", 0),
        },
        # Column correlations
        "correlations": correlations if isinstance(correlations, list) else [],
        # Sample records
        "samples": {
            "columns": samples.get("columns", []),
            "records": samples.get("records", []),
        },
    }


async def _get_transaction_timeline(db_connector, connection_id: str, table_name: str):
    """
    Get daily transaction counts for the last 30 days — the 'when what happened' data.
    Returns historical daily counts for charting.
    """
    try:
        connection = db_connector.get_connection(connection_id)
        db_type = connection['type'].lower()
        is_mysql = 'mysql' in db_type
        is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])

        # 1. Find timestamp column
        if is_mysql:
            ts_query = f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = '{table_name}'
                AND data_type IN ('timestamp', 'datetime', 'date')
                LIMIT 1
            """
        else:
            ts_query = f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = '{table_name}'
                AND data_type IN ('timestamp', 'timestamp with time zone', 'timestamp without time zone', 'date')
                ORDER BY CASE 
                    WHEN column_name ILIKE '%created%' THEN 1
                    WHEN column_name ILIKE '%updated%' THEN 2
                    WHEN column_name ILIKE '%reported%' THEN 3
                    WHEN column_name ILIKE '%at%' THEN 4
                    ELSE 5 
                END
                LIMIT 1
            """

        cols = await db_connector.query(connection_id, ts_query)
        if not cols:
            return {"has_timestamp": False, "history": []}

        ts_col = cols[0]['column_name']

        # 2. Get daily counts for last 30 days
        fq_table = table_name
        if is_pg:
            # Try to get schema-qualified name
            schema_query = f"""
                SELECT table_schema FROM information_schema.tables 
                WHERE table_name = '{table_name}' LIMIT 1
            """
            schema_res = await db_connector.query(connection_id, schema_query)
            if schema_res:
                schema = schema_res[0]['table_schema']
                fq_table = f'"{schema}"."{table_name}"'
            else:
                fq_table = f'"{table_name}"'

        if is_mysql:
            history_query = f"""
                SELECT DATE({ts_col}) as date, COUNT(*) as count
                FROM {fq_table}
                WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE({ts_col})
                ORDER BY date ASC
            """
        else:
            history_query = f"""
                SELECT DATE({ts_col}) as date, COUNT(*) as count
                FROM {fq_table}
                WHERE {ts_col} >= NOW() - INTERVAL '30 days'
                GROUP BY DATE({ts_col})
                ORDER BY date ASC
            """

        history = await db_connector.query(connection_id, history_query)

        # Format dates as strings
        formatted = []
        for row in history:
            d = row.get('date')
            if d:
                formatted.append({
                    "date": str(d)[:10],
                    "count": row.get('count', 0)
                })

        # Calculate weekly comparison
        recent_7d = sum(r['count'] for r in formatted[-7:]) if len(formatted) >= 7 else sum(r['count'] for r in formatted)
        prev_7d = sum(r['count'] for r in formatted[-14:-7]) if len(formatted) >= 14 else 0
        weekly_pct = round(((recent_7d - prev_7d) / prev_7d * 100), 1) if prev_7d > 0 else 0

        return {
            "has_timestamp": True,
            "timestamp_column": ts_col,
            "history": formatted,
            "total_recent_7d": recent_7d,
            "total_previous_7d": prev_7d,
            "weekly_change_pct": weekly_pct,
        }

    except Exception as e:
        logger.warning(f"Transaction timeline query failed: {e}")
        return {"has_timestamp": False, "history": [], "error": str(e)}


async def _safe(coro):
    """Wrap a coroutine to return {} on failure instead of crashing the whole gather."""
    try:
        return await coro
    except Exception as e:
        logger.warning(f"Node X-Ray sub-query failed: {e}")
        return {}
