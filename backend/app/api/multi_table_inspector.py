"""
Multi-Table Inspector API
Powers the cross-table drill-down inspector in the 3D galaxy view.

Flow:
  Level 1  GET /multi-table/schema         table metadata + FK links between selected tables
  Level 2  GET /multi-table/rows           top 50 rows + search for a selected table
  Level 3  GET /multi-table/row-detail     full cross-table metrics for one selected row
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, List, Optional
import logging
import asyncio
import time

from app.services.rbac_service import require_role

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


#  Level 1: Schema + FK relationships between selected tables 

@router.get("/multi-table/schema/{connection_id}")
async def get_multi_table_schema(
    connection_id: str,
    tables: str = Query(..., description="Comma-separated table names"),
    _user: dict = Depends(require_role("viewer")),
):
    """
    Returns metadata and FKPK links for the selected tables.
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
            "connections": connections,   # FKPK relationships between selected tables
        }
        _cache_set(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"multi-table schema failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


#  Level 2: Row ring  top 50 + search 

@router.get("/multi-table/rows/{connection_id}/{table_name}")
async def get_table_rows(
    connection_id: str,
    table_name: str,
    search: Optional[str] = Query(None, description="Filter rows by value"),
    linked_table: Optional[str] = Query(None, description="Related table to count activity from"),
    fk_column: Optional[str] = Query(None, description="FK column in linked_table pointing to this table"),
    pk_column: Optional[str] = Query(None, description="PK column of this table"),
    limit: int = Query(40, description="Number of rows to fetch"),
    offset: int = Query(0, description="Number of rows to skip"),
    _user: dict = Depends(require_role("viewer")),
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
        col_names = {c.name for c in cols}

        # Validate pk_column  frontend may send a generic name like 'id' that doesn't exist.
        # Always check against real schema; override if the column is missing.
        if not pk_column or pk_column not in col_names:
            pk_col_obj = next((c for c in cols if c.is_pk), None)
            if pk_column and pk_column not in col_names:
                logger.warning(
                    f"pk_column='{pk_column}' not found in {table_name} "
                    f"(available: {sorted(col_names)[:8]}). Auto-detecting from schema."
                )
            pk_column = (pk_col_obj.name if pk_col_obj else (cols[0].name if cols else "id"))

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

        # Build activity count subquery if linked table(s) provided
        activity_sql = None
        table_totals = {}  # table_name -> global_total
        linked_names = [t.strip() for t in (linked_table or "").split(",") if t.strip()]
        fk_cols = [c.strip() for c in (fk_column or "").split(",") if c.strip()]

        if linked_names and fk_cols:
            # 1. First, calculate GLOBAL total weight for each linked table for percentage denominators
            for (lt_name, fk_col) in zip(linked_names, fk_cols):
                safe_linked = db_connector.quote_identifier(connection_id, lt_name)
                safe_fk = db_connector.quote_identifier(connection_id, fk_col)
                
                # Weight detection
                agg_field = "1"
                lt_schema = next((t for t in schema.tables if t.name == lt_name), None)
                if lt_schema:
                    for kw in ['cycles', 'energy', 'amount', 'quantity', 'value', 'weight']:
                        if any(c.name.lower() == kw for c in lt_schema.columns):
                            agg_field = db_connector.quote_identifier(connection_id, kw)
                            break
                
                where_clause = f"WHERE CAST({safe_fk} AS TEXT) IN (SELECT CAST({safe_pk} AS TEXT) FROM {safe_table})"
                if search:
                    where_clause += f" AND CAST({safe_fk} AS TEXT) IN (SELECT CAST({safe_pk} AS TEXT) FROM {safe_table} {fallback_filter})"
                
                try:
                    total_q = f"SELECT SUM(CAST({agg_field} AS DOUBLE PRECISION)) as total FROM {safe_linked} {where_clause};"
                    logger.info(f"Denominator Query [{lt_name}]: {total_q} with params {query_params}")
                    total_res = await db_connector.query(connection_id, total_q, tuple(query_params))
                    table_totals[lt_name] = float(total_res[0].get("total") or 1.0)
                    logger.info(f"Calculated Relationship Total for {lt_name}: {table_totals[lt_name]}")
                except Exception as e:
                    logger.warning(f"Total calc failed for {lt_name}: {e}")
                    table_totals[lt_name] = 1.0

            # 2. Main query for the record ring with multiple table aggregations
            selects = []
            joins = []
            for i, (lt_name, fk_col) in enumerate(zip(linked_names, fk_cols)):
                safe_linked = db_connector.quote_identifier(connection_id, lt_name)
                safe_fk = db_connector.quote_identifier(connection_id, fk_col)
                
                # Re-detect weight field for this specific join
                agg_field = "1"
                lt_schema = next((t for t in schema.tables if t.name == lt_name), None)
                if lt_schema:
                    for kw in ['cycles', 'energy', 'amount', 'quantity', 'value', 'weight']:
                        if any(c.name.lower() == kw for c in lt_schema.columns):
                            agg_field = db_connector.quote_identifier(connection_id, kw)
                            break
                
                # Define aggregation for this specific linked table
                agg_func = f"SUM(CAST(l{i}.{agg_field} AS DOUBLE PRECISION))" if agg_field != "1" else f"COUNT(l{i}.{safe_fk})"
                selects.append(f"COALESCE({agg_func}, 0) AS act_{i}")
                joins.append(f"LEFT JOIN {safe_linked} l{i} ON CAST(l{i}.{safe_fk} AS TEXT) = CAST(t.{safe_pk} AS TEXT)")

            # Use raw aggregate expressions in the total expression as well (aliases not allowed in same SELECT level)
            agg_exprs = []
            for i, (lt_name, fk_col) in enumerate(zip(linked_names, fk_cols)):
                lt_schema = next((t for t in schema.tables if t.name == lt_name), None)
                curr_agg = "1"
                if lt_schema:
                    for kw in ['cycles', 'energy', 'amount', 'quantity', 'value', 'weight']:
                        if any(c.name.lower() == kw for c in lt_schema.columns):
                            curr_agg = db_connector.quote_identifier(connection_id, kw)
                            break
                agg_func = f"SUM(CAST(l{i}.{curr_agg} AS DOUBLE PRECISION))" if curr_agg != "1" else f"COUNT(l{i}.{db_connector.quote_identifier(connection_id, fk_col)})"
                agg_exprs.append(f"COALESCE({agg_func}, 0)")

            total_expr = " + ".join(agg_exprs)
            activity_sql = f"""
                SELECT
                    t.{safe_pk} AS pk_val,
                    t.{safe_disp} AS display_val,
                    {', '.join(selects)},
                    ({total_expr}) AS total_activity
                FROM {safe_table} t
                { ' '.join(joins) }
                {search_filter}
                GROUP BY t.{safe_pk}, t.{safe_disp}
                ORDER BY total_activity DESC
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
            try:
                rows = await db_connector.query(connection_id, fallback_sql, tuple(query_params))
            except Exception as e2:
                logger.error(f"Fallback query also failed for {table_name}: {e2}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Could not fetch rows for '{table_name}': {e2}")

        # Compute max activity for % sizing
        max_activity = max((float(r.get("total_activity", 0)) for r in rows), default=1) or 1

        result_rows = []
        for r in rows:
            pk_val = str(r.get("pk_val", ""))
            disp_val = str(r.get("display_val", pk_val))
            
            # Breakdown per table
            breakdown = {}
            total_act = 0
            if linked_names:
                for i, lt_name in enumerate(linked_names):
                    act = float(r.get(f"act_{i}", 0))
                    total_act += act
                    denominator = table_totals.get(lt_name, 1.0)
                    breakdown[lt_name] = {
                        "count": act,
                        "pct": round(act / max(denominator, 1.0) * 100, 1)
                    }

            # Label combines pk + display if they differ
            label = f"{pk_val}. {disp_val}" if disp_val != pk_val else pk_val
            result_rows.append({
                "pk_val": pk_val,
                "display_val": disp_val,
                "label": label,
                "activity_count": total_act,
                "activity_breakdown": breakdown,
                # Compatibility: first table pct as activity_pct
                "activity_pct": breakdown[linked_names[0]]["pct"] if breakdown and linked_names else 0,
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
    _user: dict = Depends(require_role("viewer")),
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

    linked_list = sorted(list(set(t.strip() for t in linked_tables.split(",") if t.strip())))
    pk_list = [p.strip() for p in pk_values.split(",") if p.strip()]
    
    if not pk_list:
        raise HTTPException(status_code=400, detail="No PK values provided")

    cache_key = f"rowdetail::{connection_id}::{table_name}::{pk_values}::{pk_column}::{'|'.join(sorted(linked_list))}"
    try:
        logger.info(f"Fetching row-detail for table: {table_name}, PKs: {pk_list[:5]}...")
        try:
            schema = await schema_analyzer.get_schema(connection_id)
        except AttributeError:
            schema = await schema_analyzer.analyze_schema(connection_id)
        
        if not schema or not hasattr(schema, "tables"):
            logger.error(f"Failed to retrieve schema for connection {connection_id}")
            raise HTTPException(status_code=500, detail="Schema intelligence unavailable for this connection")

        # Find source table schema
        src_schema = next((t for t in schema.tables if t.name == table_name), None)
        if not src_schema:
            raise HTTPException(status_code=404, detail=f"Table {table_name} not found in schema")

        # Validate pk_column  frontend may send a generic name like 'id' that doesn't exist.
        col_names = [c.name for c in (src_schema.columns or [])]
        if not pk_column or pk_column not in col_names:
            pk_col_obj = next((c for c in (src_schema.columns or []) if c.is_pk), None)
            if pk_column and pk_column not in col_names:
                logger.warning(
                    f"pk_column='{pk_column}' not found in {table_name} "
                    f"(available: {sorted(col_names)[:8]}). Auto-detecting from schema."
                )
            pk_column = (pk_col_obj.name if pk_col_obj else (src_schema.columns[0].name if src_schema.columns else "id"))

        safe_src_table = db_connector.quote_identifier(connection_id, table_name)
        safe_src_pk = db_connector.quote_identifier(connection_id, pk_column)

        # Prepare SQL placeholders for IN clause
        pk_placeholders = ", ".join(["%s"] * len(pk_list))

        # Fetch the actual row data for all selected PKs
        src_row_sql = f'SELECT * FROM {safe_src_table} WHERE CAST({safe_src_pk} AS TEXT) IN ({pk_placeholders});'
        logger.debug(f"Source row SQL: {src_row_sql} with params {pk_list}")
        src_all_rows = await db_connector.query(connection_id, src_row_sql, tuple(pk_list))
        src_representative = src_all_rows[0] if src_all_rows else {}
        logger.info(f"Fetched {len(src_all_rows)} source rows for PKs {pk_list[:3]}...")

        # Identify numeric columns in source table for pivoting
        src_numeric_cols = [
            c.name for c in (src_schema.columns or [])
            if c.type and any(t in c.type.lower() for t in [
                "int", "float", "decimal", "numeric", "double", "real", "money", "bigint"
            ])
        ][:12] # Limit to 12 numeric columns to prevent SQL/UI bloat

        # Calculate "local" distribution for source columns across selected records
        src_distribution = {}
        for row in src_all_rows:
            pv = str(row.get(pk_column, ""))
            metrics = {"records": 1.0}
            for nc in src_numeric_cols:
                try:
                    val = row.get(nc)
                    metrics[nc] = float(val) if val is not None else 0.0
                except (ValueError, TypeError):
                    metrics[nc] = 0.0
            src_distribution[pv] = metrics

        # Fetch Grand Totals for the Source Table (Denominators)
        src_totals = {"records": 0}
        src_total_sql = f"SELECT COUNT(*) as row_count"
        for nc in src_numeric_cols:
            if nc != "records":
                safe_nc = db_connector.quote_identifier(connection_id, nc)
                src_total_sql += f", SUM({safe_nc}) as sum_{nc.lower().replace(' ','_')}"
        src_total_sql += f" FROM {safe_src_table};"
        
        src_total_rows = await db_connector.query(connection_id, src_total_sql)
        if src_total_rows:
            tr = src_total_rows[0]
            src_totals["records"] = float(tr.get("row_count") or 1)
            for nc in src_numeric_cols:
                if nc != "records":
                    key = f"sum_{nc.lower().replace(' ','_')}"
                    src_totals[nc] = float(tr.get(key) or 1) # Fallback to 1 to avoid div by zero

        # Build linked table metrics in parallel
        async def _analyze_linked_table(linked_name: str):
            try:
                linked_schema = next((t for t in schema.tables if t.name == linked_name), None)
                if not linked_schema:
                    return None

                # Find relationship between our source table and this linked table
                # Case A: Linked table has FK to our table (One-to-Many, e.g. Customer -> Orders)
                # Case B: Our table has FK to linked table (Many-to-One, e.g. Order -> Customer)
                
                fk_col = None      # The column in the LINKED table we'll use for filtering
                src_key_col = None # The column in the SOURCE table we'll use in the subquery
                
                # Try Case A first: Linked table points to us
                for fk in (linked_schema.foreign_keys or []):
                    if fk.referenced_table == table_name:
                        fk_col = fk.column
                        src_key_col = fk.referenced_column
                        break
                
                # If not found, try Case B: We point to linked table
                if not fk_col:
                    for fk in (src_schema.foreign_keys or []):
                        if fk.referenced_table == linked_name:
                            fk_col = fk.referenced_column
                            src_key_col = fk.column
                            break
                
                # If still no relationship found, try heuristic name match (for file connections)
                if not fk_col:
                    linked_pks = [c.name for c in (linked_schema.columns or []) if c.is_pk]
                    if linked_pks:
                        pk_of_linked = linked_pks[0]
                        src_cols = [c.name for c in (src_schema.columns or [])]
                        if pk_of_linked in src_cols:
                            fk_col = pk_of_linked
                            src_key_col = pk_of_linked

                if not fk_col or not src_key_col:
                    logger.debug(f"No clear relationship found between {table_name} and {linked_name}")
                    return None

                numeric_cols = [
                    c.name for c in (linked_schema.columns or [])
                    if c.type and any(t in c.type.lower() for t in [
                        "int", "float", "decimal", "numeric", "double", "real", "money", "bigint"
                    ])
                ]

                safe_linked = db_connector.quote_identifier(connection_id, linked_name)
                safe_fk = db_connector.quote_identifier(connection_id, fk_col)
                safe_src_key = db_connector.quote_identifier(connection_id, src_key_col)

                # Get the actual values for the source key columns for the selected PKs
                # We need these for the agg_sql IN clause
                src_key_values = [str(row.get(src_key_col)) for row in src_all_rows if row.get(src_key_col) is not None]
                if not src_key_values:
                    return None
                
                key_placeholders = ", ".join(["%s"] * len(src_key_values))

                # 1. Selection Aggregation (What is selected)
                agg_parts = [f"COUNT(*) AS row_count"]
                for nc in numeric_cols[:8]:
                    safe_nc = db_connector.quote_identifier(connection_id, nc)
                    agg_parts.append(f"SUM({safe_nc}) AS sum_{nc.lower().replace(' ','_')}")
                    agg_parts.append(f"AVG({safe_nc}) AS avg_{nc.lower().replace(' ','_')}")

                agg_sql = f"""
                    SELECT CAST({safe_fk} AS TEXT) AS join_key, {', '.join(agg_parts)}
                    FROM {safe_linked}
                    WHERE CAST({safe_fk} AS TEXT) IN ({key_placeholders})
                    GROUP BY CAST({safe_fk} AS TEXT);
                """
                logger.debug(f"Agg SQL for {linked_name}: {agg_sql}")
                agg_rows = await db_connector.query(connection_id, agg_sql, tuple(src_key_values))
                
                # 2. Grand Totals (Entire database context - The Denominator)
                # This should be the sum of all linked records reachable from the source table's full population
                grand_total_sql = f"SELECT COUNT(*) AS total_count"
                for nc in numeric_cols[:8]:
                    safe_nc = db_connector.quote_identifier(connection_id, nc)
                    grand_total_sql += f", SUM({safe_nc}) AS grand_sum_{nc.lower().replace(' ','_')}"
                
                grand_total_sql += f"""
                    FROM {safe_linked} 
                    WHERE CAST({safe_fk} AS TEXT) IN (
                        SELECT DISTINCT CAST({safe_src_key} AS TEXT) FROM {safe_src_table}
                    );
                """
                logger.info(f"Grand Total Query [{linked_name}]: {grand_total_sql}")
                
                grand_results = await db_connector.query(connection_id, grand_total_sql)
                grand_data = grand_results[0] if grand_results else {}
                logger.info(f"Relationship Grand Total for {linked_name}: {grand_data}")

                pk_distribution = {}
                total_selection_rows = 0
                
                # We need to map the join_key back to the original source PKs
                # Since multiple source rows might have the same join_key (e.g. multiple orders for one customer)
                for src_row in src_all_rows:
                    spk = str(src_row.get(pk_column))
                    skv = str(src_row.get(src_key_col))
                    
                    # Find the agg row that matches this source key value
                    matching_agg = next((r for r in agg_rows if str(r.get("join_key")) == skv), None)
                    if matching_agg:
                        rc = int(matching_agg.get("row_count", 0))
                        total_selection_rows += rc
                        
                        metrics = {"records": float(rc)}
                        for nc in numeric_cols[:8]:
                            key = f"sum_{nc.lower().replace(' ','_')}"
                            try:
                                val = matching_agg.get(key)
                                metrics[nc] = float(val) if val is not None else 0.0
                            except (ValueError, TypeError):
                                metrics[nc] = 0.0
                        pk_distribution[spk] = metrics
                
                # Build standard metric_nodes using GRAND TOTALS
                metric_nodes = []
                metric_nodes.append({
                    "column": "records",
                    "metric": "frequency",
                    "value": float(grand_data.get("total_count") or total_selection_rows or 1),
                    "label": "Frequency",
                })

                for nc in numeric_cols[:8]:
                    key = f"grand_sum_{nc.lower().replace(' ','_')}"
                    try:
                        g_val = float(grand_data.get(key) or 1)
                    except (ValueError, TypeError):
                        g_val = 1.0
                    metric_nodes.append({
                        "column": nc,
                        "metric": "sum",
                        "value": round(g_val, 2),
                        "label": f" {nc}",
                    })

                return {
                    "uid": f"{linked_name}::{fk_col}",
                    "table": linked_name,
                    "fk_column": fk_col,
                    "row_count": total_selection_rows,
                    "metric_nodes": metric_nodes,
                    "pk_distribution": pk_distribution,
                }
            except Exception as e:
                logger.warning(f"Analysis failed for {linked_name}: {e}", exc_info=True)
                return None

        logger.info(f"Starting linked table analysis for {len(linked_list)} tables: {linked_list}")
        # Add timeout protection for individual table aggregations
        linked_results_raw = await asyncio.gather(*[_analyze_linked_table(lt) for lt in linked_list])
        linked_results = [r for r in linked_results_raw if r is not None]
        logger.info(f"Successfully analyzed {len(linked_results)} linked tables.")

        # Gather all available columns
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
            "source_totals": src_totals,
            "available_columns": final_available,
        }
        _cache_set(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"row-detail failed for {table_name}.{pk_values}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
