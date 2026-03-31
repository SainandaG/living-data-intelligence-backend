"""
Data Sampler Tool — fetches row samples from the primary table.
Also handles engineer_features and compute_metric step aliases.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict, List

logger = logging.getLogger(__name__)


class DataSamplerTool:
    name = "sample_data"

    async def execute(
        self, params: Dict[str, Any], memory: Any, connection_id: str
    ) -> AsyncGenerator[Dict, None]:
        table = params.get("table") or memory.get("primary_table")
        if not table:
            yield {"type": "error", "text": "No table resolved. Run inspect_schema first."}
            return

        limit = int(params.get("limit", 2000))
        limit = min(limit, 5000)

        yield {"type": "status", "text": f"Sampling up to {limit:,} rows from '{table}'..."}

        try:
            from app.services.db_connector import db_connector

            conn = db_connector.get_connection(connection_id)
            db_type = conn.get("type", "postgres").lower()
            qt = lambda n: f"`{n}`" if "mysql" in db_type else f'"{n}"'

            query = f"SELECT * FROM {qt(table)} LIMIT {limit}"
            rows = await db_connector.query(connection_id, query)
            rows = rows or []

            if not rows:
                yield {"type": "error", "text": f"Table '{table}' returned 0 rows."}
                return

            # Profile columns
            import pandas as pd
            df = pd.DataFrame(rows)
            profile = _profile_dataframe(df)

            memory.set("sampled_table", table, source="sample_data")
            memory.set("sample_rows", rows[:200], source="sample_data")    # keep 200 for context
            memory.set("column_profile", profile, source="sample_data")
            memory.set("feature_cols",
                       profile["numeric_cols"] + profile["categorical_cols"],
                       source="sample_data")

            yield {
                "type":    "result",
                "text":    f"Sampled {len(rows):,} rows from '{table}'. {profile['numeric_count']} numeric · {profile['categorical_count']} categorical columns.",
                "data":    {"table": table, "row_count": len(rows), "profile": profile},
                "summary": f"{len(rows):,} rows · {len(df.columns)} columns",
            }

        except Exception as exc:
            logger.error("data_sampler failed: %s", exc, exc_info=True)
            yield {"type": "error", "text": f"Data sampling failed: {exc}"}


def _profile_dataframe(df: Any) -> Dict:
    import pandas as pd
    import numpy as np

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category", "bool"]).columns.tolist()
    date_cols = [c for c in df.columns if "date" in c.lower() or "time" in c.lower() or "ts" == c.lower()]

    null_pct = (df.isnull().mean() * 100).round(1).to_dict()

    return {
        "numeric_cols":       numeric_cols[:20],
        "categorical_cols":   categorical_cols[:20],
        "date_cols":          date_cols[:5],
        "numeric_count":      len(numeric_cols),
        "categorical_count":  len(categorical_cols),
        "null_pct":           {k: v for k, v in null_pct.items() if v > 0},
        "shape":              list(df.shape),
    }
