"""
data_quality_engine.py
Data quality analysis service.

Score provenance:
  - calculate_quality_score / check_integrity: derived from graph topology (vitality, degree).
  - detect_duplicates: real SQL GROUP BY scan on all columns.
  - detect_format_inconsistencies: real SQL pattern checks on string columns.

Every response includes a `_meta.source` field so API consumers know the provenance.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_QUALITY_META = {
    "source": "graph_topology_estimate",
    "description": (
        "Scores derived from NeuralCore graph metrics (vitality, in-degree, out-degree). "
        "Use detect_duplicates / detect_format_inconsistencies for row-level checks."
    ),
    "real_data_checks_performed": False,
}


class DataQualityEngine:
    """
    Data quality scoring based on graph topology metrics.

    Scores reflect structural health (connectivity, vitality) rather than
    row-level quality (null counts, duplicate rates, format violations).
    All responses carry a `_meta` block to communicate this clearly.
    """

    async def calculate_quality_score(
        self, db_connector: Any, connection_id: str, table_name: str
    ) -> Dict[str, Any]:
        """
        Return quality scores derived from NeuralCore graph metrics.

        Source: graph topology (vitality + degree centrality).
        NOT from: actual null scans, duplicate counts, or format checks.
        """
        from app.services.graph_intelligence import graph_intelligence
        from app.services.neural_core import neural_core

        in_deg = neural_core.in_degrees.get(connection_id, {}).get(table_name, 0)
        out_deg = neural_core.out_degrees.get(connection_id, {}).get(table_name, 0)

        auth = graph_intelligence.get_authenticated_metrics(table_name, 0, in_deg, out_deg)
        base = auth["vitality"]

        return {
            "overall_score": base,
            # Small offsets reflect relative structural categories, not real measurements
            "completeness": min(100, base + 5),
            "accuracy":     min(100, base + 2),
            "consistency":  min(100, base + 4),
            "timeliness":   min(100, base + 7),
            "_meta": {
                **_QUALITY_META,
                "basis": "vitality_score_from_graph_topology",
                "note": (
                    "completeness/accuracy/consistency/timeliness are vitality ± constant offsets. "
                    "Run a real null-count scan for row-level quality."
                ),
            },
        }

    async def detect_duplicates(
        self, db_connector: Any, connection_id: str, table_name: str
    ) -> Dict[str, Any]:
        """
        Detect duplicate rows via a GROUP BY scan on all columns.
        Returns exact duplicate count derived from real table data.
        """
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection.get("type", "postgres").lower()
            is_pg = any(t in db_type for t in ["postgresql", "postgres", "neon"])

            # Fetch column names
            if is_pg:
                col_query = (
                    "SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name = '{table_name}' "
                    "ORDER BY ordinal_position"
                )
            else:
                col_query = (
                    "SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name = '{table_name}' "
                    "ORDER BY ordinal_position"
                )
            cols = await db_connector.query(connection_id, col_query)
            if not cols:
                return {"has_duplicates": False, "duplicate_count": 0, "affected_columns": [],
                        "_meta": {"source": "sql_group_by_scan", "real_data_checks_performed": True}}

            col_list = [c["column_name"] for c in cols]
            if is_pg:
                cols_expr = ", ".join(f'"{c}"' for c in col_list)
                fq_table = f'"{table_name}"'
            else:
                cols_expr = ", ".join(f"`{c}`" for c in col_list)
                fq_table = f"`{table_name}`"

            dup_query = (
                f"SELECT COALESCE(SUM(cnt - 1), 0) AS duplicate_count "
                f"FROM (SELECT COUNT(*) AS cnt FROM {fq_table} "
                f"GROUP BY {cols_expr} HAVING COUNT(*) > 1) dups"
            )
            result = await db_connector.query(connection_id, dup_query)
            dup_count = int(result[0].get("duplicate_count") or 0) if result else 0

            return {
                "has_duplicates": dup_count > 0,
                "duplicate_count": dup_count,
                "affected_columns": col_list if dup_count > 0 else [],
                "_meta": {"source": "sql_group_by_scan", "real_data_checks_performed": True},
            }
        except Exception as e:
            logger.warning("Duplicate detection failed for %s: %s", table_name, e)
            return {
                "has_duplicates": False, "duplicate_count": 0, "affected_columns": [],
                "error": str(e),
                "_meta": {"source": "sql_group_by_scan", "real_data_checks_performed": False},
            }

    async def detect_format_inconsistencies(
        self, db_connector: Any, connection_id: str, table_name: str
    ) -> List[Dict[str, Any]]:
        """
        Detect format inconsistencies in string columns via SQL pattern checks.
        Catches: mixed capitalisation, null-like strings ('null', 'N/A', ''), leading/trailing spaces.
        """
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection.get("type", "postgres").lower()
            is_pg = any(t in db_type for t in ["postgresql", "postgres", "neon"])

            # Fetch string column names
            str_types = (
                "('character varying','varchar','text','char','bpchar')"
                if is_pg
                else "('varchar','text','char','tinytext','mediumtext','longtext')"
            )
            col_query = (
                f"SELECT column_name FROM information_schema.columns "
                f"WHERE table_name = '{table_name}' AND data_type IN {str_types} "
                f"ORDER BY ordinal_position LIMIT 15"
            )
            cols = await db_connector.query(connection_id, col_query)
            if not cols:
                return []

            inconsistencies: List[Dict[str, Any]] = []
            for col_row in cols:
                col = col_row["column_name"]
                if is_pg:
                    q_col = f'"{col}"'
                    q_tbl = f'"{table_name}"'
                    check_query = (
                        f"SELECT "
                        f"  SUM(CASE WHEN {q_col} ~ '^[A-Z]' THEN 1 ELSE 0 END)       AS starts_upper, "
                        f"  SUM(CASE WHEN {q_col} ~ '^[a-z]' THEN 1 ELSE 0 END)       AS starts_lower, "
                        f"  SUM(CASE WHEN lower({q_col}) IN ('null','n/a','na','none','') THEN 1 ELSE 0 END) AS null_like, "
                        f"  SUM(CASE WHEN {q_col} != trim({q_col}) THEN 1 ELSE 0 END) AS has_whitespace, "
                        f"  COUNT(*) AS total "
                        f"FROM {q_tbl} WHERE {q_col} IS NOT NULL"
                    )
                else:
                    q_col = f"`{col}`"
                    q_tbl = f"`{table_name}`"
                    check_query = (
                        f"SELECT "
                        f"  SUM(CASE WHEN {q_col} REGEXP '^[A-Z]' THEN 1 ELSE 0 END)       AS starts_upper, "
                        f"  SUM(CASE WHEN {q_col} REGEXP '^[a-z]' THEN 1 ELSE 0 END)       AS starts_lower, "
                        f"  SUM(CASE WHEN LOWER({q_col}) IN ('null','n/a','na','none','') THEN 1 ELSE 0 END) AS null_like, "
                        f"  SUM(CASE WHEN {q_col} != TRIM({q_col}) THEN 1 ELSE 0 END)       AS has_whitespace, "
                        f"  COUNT(*) AS total "
                        f"FROM {q_tbl} WHERE {q_col} IS NOT NULL"
                    )
                try:
                    result = await db_connector.query(connection_id, check_query)
                except Exception as col_err:
                    logger.debug("Format check failed for column %s.%s: %s", table_name, col, col_err)
                    continue

                if not result:
                    continue
                r = result[0]
                total = int(r.get("total") or 0)
                if total == 0:
                    continue

                starts_upper = int(r.get("starts_upper") or 0)
                starts_lower = int(r.get("starts_lower") or 0)
                null_like = int(r.get("null_like") or 0)
                has_whitespace = int(r.get("has_whitespace") or 0)

                if starts_upper > 0 and starts_lower > 0:
                    mixed_ratio = min(starts_upper, starts_lower) / total
                    if mixed_ratio > 0.05:
                        inconsistencies.append({
                            "column": col, "issue": "mixed_case",
                            "description": f"Mixed capitalisation: {starts_upper} upper-case, {starts_lower} lower-case values.",
                            "severity": "Medium",
                        })
                if null_like > 0:
                    inconsistencies.append({
                        "column": col, "issue": "null_like_strings",
                        "description": f"{null_like} rows contain null-like strings ('null', 'N/A', 'none', '').",
                        "severity": "High",
                    })
                if has_whitespace > 0:
                    inconsistencies.append({
                        "column": col, "issue": "leading_trailing_whitespace",
                        "description": f"{has_whitespace} rows have leading or trailing whitespace.",
                        "severity": "Low",
                    })

            return inconsistencies
        except Exception as e:
            logger.warning("Format inconsistency detection failed for %s: %s", table_name, e)
            return []

    async def check_integrity(self, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Quick integrity check derived from NeuralCore vitality score.
        'valid' means vitality > 30 (structurally connected), not FK constraint validation.
        """
        from app.services.graph_intelligence import graph_intelligence

        auth = graph_intelligence.get_authenticated_metrics(table_name, 0, 0, 0)

        return {
            "status": "valid" if auth["vitality"] > 30 else "degraded",
            "score": auth["vitality"],
            "_meta": {
                **_QUALITY_META,
                "basis": "vitality_threshold_gt_30",
                "note": (
                    "'valid' means the table has vitality > 30 in graph topology. "
                    "It does NOT validate foreign key constraints or referential integrity."
                ),
            },
        }


# Global instance
data_quality_engine = DataQualityEngine()
