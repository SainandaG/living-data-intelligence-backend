"""
Multi-Table Inspector API
Powers the cross-table drill-down inspector in the 3D galaxy view.

Flow:
  Level 1 → GET /multi-table/schema        → table metadata + FK links between selected tables
  Level 2 → GET /multi-table/rows          → top 50 rows + search for a selected table
  Level 3 → GET /multi-table/row-detail    → full cross-table metrics for one selected row
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
import logging
import asyncio
import time

logger = logging.getLogger(__name__)
router = APIRouter()

_cache: Dict[str, tuple] = {}
_TTL = 90  # seconds


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry[0] < _TTL:
        return entry[1]
    return None


def _cache_set(key: str, val):
    _cache[key] = (time.time(), val)


# ── Level 1: Schema + FK relationships between selected tables ────────────────

@router.get("/multi-table/schema/{connection_id}")
async def get_multi_table_schema(
    connection_id: str,
    tables: str = Query(..., description="Comma-separated table names"),
):
    """
    Returns metadata and FK→PK links for the selected tables.
    Used to build Level 1 (table cluster) scene and detect which tables
    are connected via FK relationships.
    """
    from app.services.db_connector import db_connector
    from app.services.schema_analyzer import schema_analyzer

    table_list = [t.strip() for t in tables.split(",") if t.strip()]
    if not table_list:
        raise HTTPException(status_code=400, detail="No tables provided")

    logger.info(f"Multi-table schema request for connection {connection_id}, tables: {table_list}")

    cache_key = f"schema::{connection_id}::{'|'.join(sorted(table_list))}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        try:
            schema = await schema_analyzer.get_schema(connection_id)
        except AttributeError:
            schema = await schema_analyzer.analyze_schema(connection_id)

        table_set = set(table_list)
        result_tables = []

        for tbl in schema.tables:
            if tbl.name not in table_set:
                continue

            # Columns with type info
            columns = []
            for col in (tbl.columns or []):
                columns.append({
                    "name": col.name,
                    "type": col.type,
                    "is_pk": col.is_pk,
                    "is_fk": col.is_fk,
                })

            # FK links only to other selected tables
            fk_links = []
            for fk in (tbl.foreign_keys or []):
                if fk.referenced_table in table_set:
                    fk_links.append({
                        "column": fk.column,
                        "referenced_table": fk.referenced_table,
                        "referenced_column": fk.referenced_column,
                    })

            # Get row count
            try:
                safe_name = db_connector.quote_identifier(connection_id, tbl.name)
                rows = await db_connector.query(
                    connection_id,
                    f'SELECT COUNT(*) AS cnt FROM {safe_name};'
                )
                row_count = int(rows[0].get("cnt", 0)) if rows else 0
            except Exception:
                row_count = 0

            result_tables.append({
                "name": tbl.name,
                "row_count": row_count,
                "columns": columns,
                "fk_links": fk_links,   # links to OTHER selected tables only
            })

        # Build connection map between selected tables
        connections = []
        for tbl in result_tables:
            for link in tbl["fk_links"]:
                connections.append({
                    "from_table": tbl["name"],
                    "from_column": link["column"],
                    "to_table": link["referenced_table"],
                    "to_column": link["referenced_column"],
                })

        result = {
            "tables": result_tables,
            "connections": connections,   # FK→PK relationships between selected tables
        }
        _cache_set(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"multi-table schema failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Level 2: Row ring — top 50 + search ──────────────────────────────────────

@router.get("/multi-table/rows/{connection_id}/{table_name}")
async def get_table_rows(
    connection_id: str,
    table_name: str,
    search: Optional[str] = Query(None, description="Filter rows by value"),
    linked_table: Optional[str] = Query(None, description="Related table to count activity from"),
    fk_column: Optional[str] = Query(None, description="FK column in linked_table pointing to this table"),
    pk_column: Optional[str] = Query(None, description="PK column of this table"),
    limit: int = Query(100, description="Number of rows to fetch"),
    offset: int = Query(0, description="Number of rows to skip"),
):
    """
    Returns rows for the inner ring of the Level 2 scene.
    - Default: top 100 rows ordered by activity (FK reference count desc)
    - With search: filter rows matching the search term across text columns
    - Node size is proportional to activity_count (how many linked rows)
    """
    from app.services.db_connector import db_connector
    from app.services.schema_analyzer import schema_analyzer

    cache_key = f"rows::{connection_id}::{table_name}::{search}::{linked_table}::{fk_column}::{pk_column}::{limit}::{offset}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        try:
            schema = await schema_analyzer.get_schema(connection_id)
        except AttributeError:
            schema = await schema_analyzer.analyze_schema(connection_id)

        # Find this table's schema
        tbl_schema = next((t for t in schema.tables if t.name == table_name), None)
        if not tbl_schema:
            raise HTTPException(status_code=404, detail=f"Table {table_name} not found")

        cols = tbl_schema.columns or []

        # Auto-detect pk if not provided
        if not pk_column:
            pk_col_obj = next((c for c in cols if c.is_pk), None)
            pk_column = pk_col_obj.name if pk_col_obj else (cols[0].name if cols else "id")

        # Find best display column (first non-pk text/varchar column)
        display_col = None
        for c in cols:
            if not c.is_pk and c.type and any(t in c.type.lower() for t in ["char", "text", "varchar", "name"]):
                display_col = c.name
                break
        if not display_col:
            display_col = pk_column

        safe_table = db_connector.quote_identifier(connection_id, table_name)
        safe_pk = db_connector.quote_identifier(connection_id, pk_column)
        safe_disp = db_connector.quote_identifier(connection_id, display_col)

        search_filter = ""
        query_params = []
        if search:
            search_filter = f"WHERE CAST(t.{safe_disp} AS TEXT) ILIKE %s OR CAST(t.{safe_pk} AS TEXT) ILIKE %s"
            query_params = [f"%{search}%", f"%{search}%"]
            fallback_filter = f"WHERE CAST({safe_disp} AS TEXT) ILIKE %s OR CAST({safe_pk} AS TEXT) ILIKE %s"
        else:
            fallback_filter = ""

        # Build activity count subquery if linked table provided
        activity_sql = None
        if linked_table and fk_column:
            safe_linked = db_connector.quote_identifier(connection_id, linked_table)
            safe_fk = db_connector.quote_identifier(connection_id, fk_column)
            activity_sql = f"""
                SELECT
                    t.{safe_pk} AS pk_val,
                    t.{safe_disp} AS display_val,
                    COUNT(l.{safe_fk}) AS activity_count
                FROM {safe_table} t
                LEFT JOIN {safe_linked} l ON CAST(l.{safe_fk} AS TEXT) = CAST(t.{safe_pk} AS TEXT)
                {search_filter}
                GROUP BY t.{safe_pk}, t.{safe_disp}
                ORDER BY activity_count DESC
                LIMIT {int(limit)} OFFSET {int(offset)};
            """

        # Fallback query (No Join)
        fallback_sql = f"""
            SELECT
                {safe_pk} AS pk_val,
                {safe_disp} AS display_val,
                0 AS activity_count
            FROM {safe_table}
            {fallback_filter}
            ORDER BY {safe_pk}
            LIMIT {int(limit)} OFFSET {int(offset)};
        """

        try:
            # Try activity query first if applicable
            sql_to_run = activity_sql if activity_sql else fallback_sql
            rows = await db_connector.query(connection_id, sql_to_run, tuple(query_params))
        except Exception as e:
            logger.warning(f"Activity query failed for {table_name}, falling back: {e}")
            rows = await db_connector.query(connection_id, fallback_sql, tuple(query_params))

        # Compute max activity for % sizing
        max_activity = max((int(r.get("activity_count", 0)) for r in rows), default=1) or 1

        result_rows = []
        for r in rows:
            pk_val = str(r.get("pk_val", ""))
            disp_val = str(r.get("display_val", pk_val))
            activity = int(r.get("activity_count", 0))
            pct = round(activity / max_activity * 100, 1)
            # Label combines pk + display if they differ
            label = f"{pk_val}. {disp_val}" if disp_val != pk_val else pk_val
            result_rows.append({
                "pk_val": pk_val,
                "display_val": disp_val,
                "label": label,
                "activity_count": activity,
                "activity_pct": pct,  # 0–100, drives node size
            })

        # Also get total count for this table to help frontend pagination
        total_rows = 0
        try:
            count_sql = f"SELECT COUNT(*) as total FROM {safe_table} {fallback_filter if not search else search_filter.replace('t.', '')}"
            count_res = await db_connector.query(connection_id, count_sql, tuple(query_params))
            total_rows = count_res[0]['total'] if count_res else 0
        except: pass

        result = {
            "table": table_name,
            "pk_column": pk_column,
            "display_column": display_col,
            "rows": result_rows,
            "total_shown": len(result_rows),
            "total_count": total_rows,
            "limit": limit,
            "offset": offset
        }
        _cache_set(cache_key, result)
        return result


    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/multi-table/row-detail/{connection_id}/{table_name}/{pk_values}")
async def get_row_detail(
    connection_id: str,
    table_name: str,
    pk_values: str,
    pk_column: str = Query(...),
    linked_tables: str = Query("", description="Comma-separated linked table names"),
):
    """
    For one or MORE selected rows (e.g. products A, B, and C):
    - Returns aggregated related rows from linked tables (inner ring)
    - For each linked table: combined count of matching rows + sum of all numeric columns
    - Percentage distribution across all linked rows (drives node size)

    This is the Level 3 metric ring scene data.
    """
    from app.services.db_connector import db_connector
    from app.services.schema_analyzer import schema_analyzer

    linked_list = [t.strip() for t in linked_tables.split(",") if t.strip()]
    pk_list = [p.strip() for p in pk_values.split(",") if p.strip()]
    
    if not pk_list:
        raise HTTPException(status_code=400, detail="No PK values provided")

    cache_key = f"rowdetail::{connection_id}::{table_name}::{pk_values}::{pk_column}::{'|'.join(sorted(linked_list))}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        try:
            schema = await schema_analyzer.get_schema(connection_id)
        except AttributeError:
            schema = await schema_analyzer.analyze_schema(connection_id)

        # Get columns for the source row (display fields)
        src_schema = next((t for t in schema.tables if t.name == table_name), None)
        if not src_schema:
            raise HTTPException(status_code=404, detail=f"Table {table_name} not found")

        safe_src_table = db_connector.quote_identifier(connection_id, table_name)
        safe_src_pk = db_connector.quote_identifier(connection_id, pk_column)

        # Prepare SQL placeholders for IN clause
        pk_placeholders = ", ".join(["%s"] * len(pk_list))

        # Fetch the actual row data for all selected PKs
        src_row_sql = f'SELECT * FROM {safe_src_table} WHERE CAST({safe_src_pk} AS TEXT) IN ({pk_placeholders});'
        src_all_rows = await db_connector.query(connection_id, src_row_sql, tuple(pk_list))
        src_representative = src_all_rows[0] if src_all_rows else {}

        # Identify numeric columns in source table for pivoting
        src_numeric_cols = [
            c.name for c in (src_schema.columns or [])
            if c.type and any(t in c.type.lower() for t in [
                "int", "float", "decimal", "numeric", "double", "real", "money", "bigint"
            ])
        ]

        # Calculate "local" distribution for source columns across selected records
        # This allows selecting 'batteries > quantity_damaged' even for the batteries table itself
        src_distribution = {}
        for row in src_all_rows:
            pv = str(row.get(pk_column, ""))
            metrics = {"records": 1.0}
            for nc in src_numeric_cols:
                metrics[nc] = float(row.get(nc) or 0)
            src_distribution[pv] = metrics

        # Build linked table metrics in parallel
        async def _analyze_linked_table(linked_name: str):
            linked_schema = next((t for t in schema.tables if t.name == linked_name), None)
            if not linked_schema:
                return None

            # Find FK column pointing to our table
            fk_col = None
            for fk in (linked_schema.foreign_keys or []):
                if fk.referenced_table == table_name and fk.referenced_column == pk_column:
                    fk_col = fk.column
                    break

            if not fk_col:
                for fk in (linked_schema.foreign_keys or []):
                    if fk.referenced_table == table_name:
                        fk_col = fk.column
                        break

            if not fk_col:
                return None

            numeric_cols = [
                c.name for c in (linked_schema.columns or [])
                if c.type and any(t in c.type.lower() for t in [
                    "int", "float", "decimal", "numeric", "double", "real", "money", "bigint"
                ])
            ]

            safe_linked = db_connector.quote_identifier(connection_id, linked_name)
            safe_fk = db_connector.quote_identifier(connection_id, fk_col)

            # Aggregation query using IN clause for multi-selection support
            agg_parts = [f"COUNT(*) AS row_count"]
            for nc in numeric_cols[:8]:
                safe_nc = db_connector.quote_identifier(connection_id, nc)
                agg_parts.append(f"SUM({safe_nc}) AS sum_{nc.lower().replace(' ','_')}")
                agg_parts.append(f"AVG({safe_nc}) AS avg_{nc.lower().replace(' ','_')}")

            # Aggregation query using GROUP BY for per-record breakdown
            agg_sql = f"""
                SELECT CAST({safe_fk} AS TEXT) AS pk_val, {', '.join(agg_parts)}
                FROM {safe_linked}
                WHERE CAST({safe_fk} AS TEXT) IN ({pk_placeholders})
                GROUP BY {safe_fk};
            """
            agg_rows = await db_connector.query(connection_id, agg_sql, tuple(pk_list))
            
            # Map aggregated results per PK
            pk_distribution = {}
            total_row_count = 0
            
            # Totals for the whole table (across selected PKs)
            table_totals = {"records": 0}
            for nc in numeric_cols[:8]:
                table_totals[nc] = 0.0

            for row in agg_rows:
                pv = str(row.get("pk_val", ""))
                rc = int(row.get("row_count", 0))
                total_row_count += rc
                table_totals["records"] += rc
                
                metrics = {"records": float(rc)}
                for nc in numeric_cols[:8]:
                    key = f"sum_{nc.lower().replace(' ','_')}"
                    val = float(row.get(key) or 0)
                    metrics[nc] = val
                    table_totals[nc] += val
                
                pk_distribution[pv] = metrics
            
            # Build standard metric_nodes for the overall table stats
            metric_nodes = []
            metric_nodes.append({
                "column": "records",
                "metric": "frequency",
                "value": float(table_totals["records"]),
                "label": "Frequency",
            })

            for nc in numeric_cols[:8]:
                metric_nodes.append({
                    "column": nc,
                    "metric": "sum",
                    "value": round(table_totals[nc], 2),
                    "label": f"Σ {nc}",
                })

            return {
                "table": linked_name,
                "fk_column": fk_col,
                "row_count": total_row_count,
                "metric_nodes": metric_nodes,
                "pk_distribution": pk_distribution, # New breakdown field
            }

        linked_results_raw = await asyncio.gather(*[_analyze_linked_table(lt) for lt in linked_list])
        linked_results = [r for r in linked_results_raw if r is not None]

        # Gather all available columns for the sidebar
        final_available = ["records"]
        for nc in src_numeric_cols:
            if nc != "records":
                final_available.append(nc)
        
        for r in linked_results:
            t_name = r["table"]
            for m in r["metric_nodes"]:
                if m["column"] != "records":
                    final_available.append(f"{t_name} > {m['column']}")
        final_available = sorted(list(set(final_available)))

        # Calculate percentage share for each available column across all tables
        # This drives the visual scale (pct) in the 3D scene
        for col_key in final_available:
            total_for_col = 0
            if col_key == "records" or " > " not in col_key:
                # Local or global standard metric
                col_name = col_key
                total_for_col = sum(
                    next((m["value"] for m in r["metric_nodes"] if m["column"] == col_name), 0)
                    for r in linked_results
                ) or 1
                for r in linked_results:
                    for m in r["metric_nodes"]:
                        if m["column"] == col_name:
                            m["pct"] = round(m["value"] / total_for_col * 100, 1)
            else:
                # Specific Table > Column metric
                t_target, col_name = col_key.split(" > ")
                # Find the total for this column SPECIFICALLY in its target table
                # (Since it doesn't exist in others, the total is just that table's value)
                for r in linked_results:
                    if r["table"] == t_target:
                        target_m = next((m for m in r["metric_nodes"] if m["column"] == col_name), None)
                        if target_m:
                            target_m["pct"] = 100.0 # It owns 100% of its own specific metric share

        result = {
            "table": table_name,
            "pk_column": pk_column,
            "pk_values": pk_values,
            "is_multi": len(pk_list) > 1,
            "selection_count": len(pk_list),
            "pk_list": pk_list,
            "row_data": {str(k): str(v) for k, v in src_representative.items()},
            "linked_tables": linked_results,
            "source_distribution": src_distribution,
            "available_columns": final_available,
        }
        _cache_set(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"row-detail failed for {table_name}.{pk_values}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
