"""
Pattern Analyzer Service
Detects daily/weekly patterns, traffic spikes, and behavioral trends.
Enhanced with autocorrelation-based periodicity detection, trend decomposition,
and seasonality scoring.
"""
from typing import Dict, List, Any, Optional
import logging
import statistics

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Signal analysis helpers
# ---------------------------------------------------------------------------

def _autocorrelation(series: List[float], max_lag: int = 14) -> Dict[int, float]:
    """
    Compute normalized autocorrelation for lags 1..max_lag.
    Returns {lag: correlation} dict. Values near ±1 indicate strong periodicity.
    """
    n = len(series)
    if n < 4:
        return {}
    arr = np.array(series, dtype=float)
    arr -= arr.mean()
    denom = float(np.dot(arr, arr))
    if denom == 0:
        return {}
    result = {}
    for lag in range(1, min(max_lag + 1, n)):
        corr = float(np.dot(arr[lag:], arr[:-lag])) / denom
        result[lag] = round(corr, 4)
    return result


def _dominant_period(autocorr: Dict[int, float], min_corr: float = 0.3) -> Optional[int]:
    """Return the lag with the highest autocorrelation above min_corr, or None."""
    candidates = {lag: v for lag, v in autocorr.items() if v >= min_corr}
    if not candidates:
        return None
    return max(candidates, key=candidates.get)


def _seasonality_score(series: List[float]) -> float:
    """
    Score 0–1 indicating how seasonal/periodic the series is.
    Uses the max autocorrelation at lags 2–14.
    """
    if len(series) < 4:
        return 0.0
    ac = _autocorrelation(series, max_lag=min(14, len(series) - 1))
    if not ac:
        return 0.0
    return round(max(abs(v) for v in ac.values()), 4)


def _linear_trend(series: List[float]) -> Dict[str, float]:
    """
    Fit a linear trend and return slope, intercept, and R².
    Positive slope = growth, negative = decline.
    """
    n = len(series)
    if n < 2:
        return {"slope": 0.0, "intercept": float(series[0]) if series else 0.0, "r_squared": 0.0}
    x = np.arange(n, dtype=float)
    y = np.array(series, dtype=float)
    coeffs = np.polyfit(x, y, 1)
    fitted = np.polyval(coeffs, x)
    ss_res = float(np.sum((y - fitted) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 1.0
    return {
        "slope": round(float(coeffs[0]), 4),
        "intercept": round(float(coeffs[1]), 4),
        "r_squared": round(r2, 4),
    }


class PatternAnalyzer:
    """
    Service for analyzing behavioral patterns and system usage trends.
    Enhanced with autocorrelation, trend decomposition, and seasonality scoring.
    """

    def __init__(self):
        self.pattern_cache = {}

    async def analyze_traffic_patterns(
        self, db_connector, connection_id: str, table_name: str
    ) -> Dict[str, Any]:
        """Detect daily and weekly traffic patterns for a specific table."""
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type'].lower()
            is_mysql = 'mysql' in db_type

            fq_table = await self._get_fq_table_name(db_connector, connection_id, table_name)

            schema_info = await self._get_timestamp_column(
                db_connector, connection_id, table_name, db_type
            )
            if not schema_info:
                return await self._analyze_structural_patterns(
                    db_connector, connection_id, fq_table, table_name
                )

            ts_col = schema_info['column_name']

            # Hourly patterns (last 7 days)
            if is_mysql:
                hourly_query = f"""
                    SELECT HOUR({ts_col}) as hour, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY hour ORDER BY hour
                """
            else:
                hourly_query = f"""
                    SELECT EXTRACT(HOUR FROM {ts_col}) as hour, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= NOW() - INTERVAL '7 days'
                    GROUP BY hour ORDER BY hour
                """
            hourly_results = await db_connector.query(connection_id, hourly_query)

            # Daily patterns (last 30 days)
            if is_mysql:
                daily_query = f"""
                    SELECT (DAYOFWEEK({ts_col}) - 1) as dow, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY dow ORDER BY dow
                """
            else:
                daily_query = f"""
                    SELECT EXTRACT(DOW FROM {ts_col}) as dow, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= NOW() - INTERVAL '30 days'
                    GROUP BY dow ORDER BY dow
                """
            daily_results = await db_connector.query(connection_id, daily_query)

            if not hourly_results and not daily_results:
                return await self._analyze_structural_patterns(
                    db_connector, connection_id, fq_table, table_name
                )

            hourly_data = {int(r['hour']): r['activity_count'] for r in hourly_results}
            daily_data = {int(r['dow']): r['activity_count'] for r in daily_results}

            peaks = self._identify_peaks(hourly_data, daily_data)

            # --- Enhanced analytics ---
            hourly_series = [hourly_data.get(h, 0) for h in range(24)]
            daily_series = [daily_data.get(d, 0) for d in range(7)]

            hourly_autocorr = _autocorrelation(hourly_series, max_lag=12)
            daily_autocorr = _autocorrelation(daily_series, max_lag=6)
            hourly_period = _dominant_period(hourly_autocorr)
            daily_period = _dominant_period(daily_autocorr)
            seasonality = _seasonality_score(hourly_series)
            trend = _linear_trend(hourly_series)

            return {
                "table_name": table_name,
                "has_patterns": True,
                "daily_cycle": hourly_data,
                "weekly_cycle": daily_data,
                "peaks": peaks,
                "summary": self._generate_pattern_summary(peaks, table_name),
                "analytics": {
                    "seasonality_score": seasonality,
                    "dominant_hourly_period": hourly_period,
                    "dominant_daily_period": daily_period,
                    "trend": trend,
                    "hourly_autocorrelation": hourly_autocorr,
                    "interpretation": self._interpret_analytics(
                        seasonality, hourly_period, trend
                    ),
                },
            }

        except Exception as e:
            logger.error(f"Pattern analysis failed for {table_name}: {e}")
            return {"error": str(e), "has_patterns": False}

    def _interpret_analytics(
        self,
        seasonality: float,
        dominant_period: Optional[int],
        trend: Dict[str, float],
    ) -> str:
        parts = []
        if seasonality > 0.6:
            parts.append(f"Strong periodic pattern detected (seasonality={seasonality:.2f})")
        elif seasonality > 0.3:
            parts.append(f"Moderate periodicity (seasonality={seasonality:.2f})")
        else:
            parts.append("No strong periodicity detected")

        if dominant_period:
            parts.append(f"dominant cycle every ~{dominant_period}h")

        slope = trend.get("slope", 0)
        r2 = trend.get("r_squared", 0)
        if r2 > 0.5:
            direction = "growing" if slope > 0 else "declining"
            parts.append(f"activity is {direction} (slope={slope:+.2f}/h, R²={r2:.2f})")

        return "; ".join(parts) + "."

    async def _analyze_structural_patterns(
        self, db_connector, connection_id: str, fq_table: str, table_name: str
    ) -> Dict[str, Any]:
        """Analyze ID distribution to create a structural fingerprint when dates are missing."""
        try:
            connection = db_connector.get_connection(connection_id)
            is_mysql_struct = 'mysql' in connection['type'].lower()
            _param = "%s" if is_mysql_struct else "$1"
            col_q = f"""
                SELECT column_name, data_type FROM information_schema.columns
                WHERE table_name = {_param}
                AND data_type IN ('integer', 'bigint', 'smallint', 'numeric',
                                  'character varying', 'text', 'uuid')
                ORDER BY CASE
                    WHEN data_type IN ('integer', 'bigint', 'smallint') THEN 1
                    WHEN column_name = 'id' THEN 2
                    ELSE 3
                END ASC LIMIT 1
            """
            cols = await db_connector.query(connection_id, col_q, (table_name,))
            if not cols:
                return {
                    "table_name": table_name,
                    "has_patterns": False,
                    "summary": "Static reference table. No analysis columns detected.",
                }

            id_col = cols[0]['column_name']
            dtype = cols[0]['data_type']
            is_mysql = connection['type'] == 'mysql'

            if dtype in ['integer', 'bigint', 'smallint', 'numeric']:
                bucket_expr = f"{id_col}"
            else:
                bucket_expr = f"CRC32({id_col})" if is_mysql else f"hashtext({id_col}::text)"

            mod_query = (
                f"SELECT ABS({bucket_expr}) % 24 as bucket, COUNT(*) as count "
                f"FROM {fq_table} GROUP BY 1 ORDER BY 1"
            )
            dow_query = (
                f"SELECT ABS({bucket_expr}) % 7 as bucket, COUNT(*) as count "
                f"FROM {fq_table} GROUP BY 1 ORDER BY 1"
            )

            mod_res = await db_connector.query(connection_id, mod_query)
            dow_res = await db_connector.query(connection_id, dow_query)

            hourly_data = {int(r['bucket']): r['count'] for r in mod_res}
            daily_data = {int(r['bucket']): r['count'] for r in dow_res}

            is_uniform = False
            hourly_series = [hourly_data.get(h, 0) for h in range(24)]
            if hourly_series and sum(hourly_series) > 0:
                avg = sum(hourly_series) / len(hourly_series)
                variance = statistics.stdev(hourly_series) if len(hourly_series) > 1 else 0
                is_uniform = variance < (avg * 0.2)

            seasonality = _seasonality_score(hourly_series)
            trend = _linear_trend(hourly_series)

            summary = "Structural Analysis: "
            summary += (
                "Data is evenly distributed (Sequential/Uniform generation)."
                if is_uniform
                else "Data shows distinct clustering (Batch/Import generation)."
            )

            return {
                "table_name": table_name,
                "has_patterns": True,
                "is_structural": True,
                "daily_cycle": hourly_data,
                "weekly_cycle": daily_data,
                "peaks": {"peak_hour": 12, "peak_day_name": "Structure"},
                "summary": summary,
                "analytics": {
                    "seasonality_score": seasonality,
                    "trend": trend,
                    "is_uniform_distribution": is_uniform,
                },
            }

        except Exception as e:
            logger.debug(f"Pattern analysis failed for {table_name}: {e}")
            return {"table_name": table_name, "has_patterns": False, "error": str(e)}

    async def _get_fq_table_name(
        self, db_connector, connection_id: str, table_name: str
    ) -> str:
        check_query = """
            SELECT table_schema
            FROM information_schema.tables
            WHERE LOWER(table_name) = LOWER($1)
            AND table_schema IN ('evolution', 'public')
            ORDER BY CASE WHEN table_schema = 'evolution' THEN 1 ELSE 2 END
            LIMIT 1
        """
        res = await db_connector.query(connection_id, check_query, (table_name,))
        if res:
            return f"{res[0]['table_schema']}.{table_name}"
        return table_name

    async def _get_timestamp_column(
        self,
        db_connector,
        connection_id: str,
        table_name: str,
        db_type: str = 'postgres',
    ) -> Optional[Dict]:
        if db_type == 'mysql':
            query = """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE LOWER(table_name) = LOWER(%s)
                AND data_type IN ('timestamp', 'datetime', 'date')
                ORDER BY CASE
                    WHEN LOWER(column_name) LIKE '%created%' THEN 1
                    WHEN LOWER(column_name) LIKE '%updated%' THEN 2
                    WHEN LOWER(column_name) LIKE '%reported%' THEN 3
                    WHEN LOWER(column_name) LIKE '%at%' THEN 4
                    ELSE 5
                END
                LIMIT 1
            """
        else:
            query = """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE LOWER(table_name) = LOWER($1)
                AND data_type IN ('timestamp', 'timestamp with time zone',
                                  'timestamp without time zone', 'date')
                ORDER BY CASE
                    WHEN column_name ILIKE '%created%' THEN 1
                    WHEN column_name ILIKE '%updated%' THEN 2
                    WHEN column_name ILIKE '%reported%' THEN 3
                    WHEN column_name ILIKE '%at%' THEN 4
                    ELSE 5
                END
                LIMIT 1
            """
        results = await db_connector.query(connection_id, query, (table_name,))
        return results[0] if results else None

    def _identify_peaks(
        self, hourly_data: Dict[int, int], daily_data: Dict[int, int]
    ) -> Dict[str, Any]:
        if not hourly_data or not daily_data:
            return {}

        peak_hour = max(hourly_data, key=hourly_data.get)
        peak_day = max(daily_data, key=daily_data.get)
        days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        return {
            "peak_hour": peak_hour,
            "peak_day_index": peak_day,
            "peak_day_name": days[int(peak_day)],
            "is_weekend_heavy": (
                daily_data.get(0, 0) + daily_data.get(6, 0) > sum(daily_data.values()) / 3
            ),
        }

    def _generate_pattern_summary(self, peaks: Dict, table_name: str) -> str:
        if not peaks:
            return "No clear usage patterns detected yet."
        summary = f"Activity in {table_name} peaks around {peaks['peak_hour']}:00. "
        summary += f"The busiest day is typically {peaks['peak_day_name']}. "
        if peaks.get('is_weekend_heavy'):
            summary += "Usage is significantly higher during weekends."
        else:
            summary += "This table shows a typical weekday-focused business pattern."
        return summary

    async def analyze_system_patterns(
        self, db_connector, connection_id: str
    ) -> Dict[str, Any]:
        """System-wide behavioral pattern by aggregating top table activity."""
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type'].lower()
            is_mysql = 'mysql' in db_type
            is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])

            if is_mysql:
                q = "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC LIMIT 3"
            elif is_pg:
                q = "SELECT relname as table_name FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 3"
            else:
                q = "SELECT table_name FROM information_schema.tables LIMIT 3"

            res = await db_connector.query(connection_id, q)
            if not res:
                return {"has_patterns": False, "summary": "No active tables found."}

            composite_hourly = {h: 0 for h in range(24)}
            composite_daily = {d: 0 for d in range(7)}
            tables_analyzed = []

            for r in res:
                t_name = r['table_name']
                p = await self.analyze_traffic_patterns(db_connector, connection_id, t_name)
                if p.get('has_patterns'):
                    tables_analyzed.append(t_name)
                    for h, count in p.get('daily_cycle', {}).items():
                        composite_hourly[int(h)] += count
                    for d, count in p.get('weekly_cycle', {}).items():
                        composite_daily[int(d)] += count

            peaks = self._identify_peaks(composite_hourly, composite_daily)

            # Aggregate analytics
            hourly_series = [composite_hourly[h] for h in range(24)]
            seasonality = _seasonality_score(hourly_series)
            trend = _linear_trend(hourly_series)
            autocorr = _autocorrelation(hourly_series, max_lag=12)
            dominant_period = _dominant_period(autocorr)

            return {
                "scope": "System Wide",
                "has_patterns": True,
                "composite_metrics": True,
                "sources": tables_analyzed,
                "daily_cycle": composite_hourly,
                "weekly_cycle": composite_daily,
                "peaks": peaks,
                "summary": (
                    f"System-wide activity peaks at {peaks.get('peak_hour', '?')}:00 on "
                    f"{peaks.get('peak_day_name', '?')}s. "
                    f"(Aggregated from {len(tables_analyzed)} core tables)"
                ),
                "analytics": {
                    "seasonality_score": seasonality,
                    "dominant_period_hours": dominant_period,
                    "trend": trend,
                    "interpretation": self._interpret_analytics(seasonality, dominant_period, trend),
                },
            }

        except Exception as e:
            logger.error(f"System pattern analysis failed: {e}")
            return {"error": str(e), "has_patterns": False}


# Global instance
pattern_analyzer = PatternAnalyzer()
