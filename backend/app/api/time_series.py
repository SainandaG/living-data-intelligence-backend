"""
Time Series 3D Analysis API
Groups entity (ID) creation counts by date and table, for 3D bar visualization.
"""
from fastapi import APIRouter, HTTPException, Depends
from app.services.rbac_service import require_role
import asyncio
import logging
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter()

_DATE_TYPE_HINTS = ("date", "timestamp", "datetime")
_DATE_NAME_HINTS = ("_at", "_date", "created", "updated")

_GRANULARITY_FREQ = {"day": "D", "week": "W", "month": "M"}


def _guess_date_column(columns: list) -> str | None:
    """Pick the most likely creation-date column from a table's schema columns."""
    for col in columns:
        col_type = (getattr(col, "type", "") or "").lower()
        col_name = (getattr(col, "name", "") or "").lower()
        if any(hint in col_type for hint in _DATE_TYPE_HINTS) or any(hint in col_name for hint in _DATE_NAME_HINTS):
            return getattr(col, "name", None)
    return None


@router.get("/analytics/time-series-3d/{connection_id}")
async def get_time_series_3d(
    connection_id: str,
    granularity: str = "day",
    _user: dict = Depends(require_role("viewer")),
):
    """
    For every table with a detectable date column, count how many rows were
    created per time bucket. Returns points shaped for a table x time x count
    3D bar chart, plus the global min/max date across all tables.
    """
    if granularity not in _GRANULARITY_FREQ:
        raise HTTPException(status_code=400, detail=f"granularity must be one of {list(_GRANULARITY_FREQ)}")

    from app.services.db_connector import db_connector
    from app.services.schema_analyzer import schema_analyzer

    try:
        schema = await schema_analyzer.get_schema(connection_id)
    except AttributeError:
        schema = await schema_analyzer.analyze_schema(connection_id)

    async def _query_one_table(table):
        date_col = _guess_date_column(table.columns or [])
        if not date_col:
            return table.name, None, "no_date_column"

        safe_table = f'"{table.name}"'
        safe_col = f'"{date_col}"'
        sql = f"SELECT {safe_col} AS created_at FROM {safe_table} WHERE {safe_col} IS NOT NULL;"

        try:
            rows = await db_connector.query(connection_id, sql)
        except Exception as e:
            logger.warning(f"time-series-3d: skipping {table.name}, query failed: {e}")
            return table.name, None, "query_failed"

        if not rows:
            return table.name, None, None

        df = pd.DataFrame(rows)
        # Normalize to tz-naive UTC so tables with mixed tz-aware/tz-naive date
        # columns can still be compared/merged against each other.
        df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce", utc=True).dt.tz_localize(None)
        df = df.dropna(subset=["created_at"])
        if df.empty:
            return table.name, None, None

        return table.name, df["created_at"], None

    results = await asyncio.gather(*[_query_one_table(t) for t in schema.tables])

    points = []
    skipped_tables = []
    all_dates: list = []

    for table_name, dates, skip_reason in results:
        if skip_reason:
            skipped_tables.append(table_name)
            continue
        if dates is None:
            continue

        all_dates.append(dates.min())
        all_dates.append(dates.max())

        bucketed = dates.dt.to_period(_GRANULARITY_FREQ[granularity])
        counts = bucketed.value_counts().sort_index()
        for period, count in counts.items():
            points.append({
                "time_z": str(period.start_time.date()),
                "table_x": table_name,
                "count_y": int(count),
            })

    return {
        "connection_id": connection_id,
        "granularity": granularity,
        "min_date": str(min(all_dates).date()) if all_dates else None,
        "max_date": str(max(all_dates).date()) if all_dates else None,
        "points": points,
        "skipped_tables": skipped_tables,
    }
