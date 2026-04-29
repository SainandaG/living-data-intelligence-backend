"""
File Upload API

Endpoints for uploading CSV / Excel files and treating them as queryable
database connections — no server credentials needed.
"""
import logging
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from fastapi.responses import JSONResponse

from app.services.rbac_service import require_role

from app.services.file_connector import (
    connect_file,
    query_file,
    list_connections,
    close_connection,
    get_tables,
    build_schema_for_file,
    is_file_connection,
)
from app.services.schema_analyzer import schema_analyzer

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Upload & connect
# ---------------------------------------------------------------------------

@router.post("/upload", summary="Upload a CSV or Excel file as a database connection")
async def upload_file(file: UploadFile = File(...), _user: dict = Depends(require_role("editor"))) -> Dict[str, Any]:
    """
    Upload a CSV (.csv) or Excel (.xlsx / .xls / .xlsm / .ods) file.

    The file is loaded into an in-memory DuckDB database so it can be
    queried exactly like a real database connection.

    Returns a connection object with:
    - `connection_id` — use this in all subsequent API calls
    - `type`          — 'csv' or 'excel'
    - `tables`        — list of table names derived from the file
    - `row_counts`    — row count per table
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        filename = file.filename or "upload"
        result = await connect_file(content, filename)
        conn_id = result["id"]

        # Trigger schema analysis (so graph view, AI etc. works immediately)
        schema = build_schema_for_file(conn_id)
        schema_analyzer.analysis_results[conn_id] = schema

        tables_summary = {
            t.name: t.row_count for t in schema.tables
        }

        return {
            "success": True,
            "message": f"File '{filename}' loaded successfully.",
            "connection_id": conn_id,
            "type": result["type"],
            "filename": filename,
            "tables": list(tables_summary.keys()),
            "row_counts": tables_summary,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"File upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")


# ---------------------------------------------------------------------------
# Preview / query
# ---------------------------------------------------------------------------

@router.get(
    "/{connection_id}/preview",
    summary="Preview rows from a file-based table",
)
async def preview_table(
    connection_id: str,
    table: str = Query(..., description="Table name to preview"),
    limit: int = Query(100, ge=1, le=5000, description="Max rows to return"),
    _user: dict = Depends(require_role("viewer")),
) -> Dict[str, Any]:
    """Return the first N rows of a table from a file connection."""
    if not is_file_connection(connection_id):
        raise HTTPException(
            status_code=404,
            detail=f"File connection '{connection_id}' not found.",
        )
    try:
        rows = await query_file(
            connection_id,
            f'SELECT * FROM "{table}" LIMIT {limit}',
        )
        return {"table": table, "rows": rows, "count": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{connection_id}/query",
    summary="Run a SQL query against a file-based connection",
)
async def run_query(
    connection_id: str,
    body: Dict[str, Any],
    _user: dict = Depends(require_role("analyst")),
) -> Dict[str, Any]:
    """
    Execute arbitrary SQL against the file connection.

    Body: `{ "sql": "SELECT ..." }`
    """
    if not is_file_connection(connection_id):
        raise HTTPException(
            status_code=404,
            detail=f"File connection '{connection_id}' not found.",
        )
    sql = body.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="'sql' field is required.")

    try:
        rows = await query_file(connection_id, sql)
        return {"rows": rows, "count": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

@router.get(
    "/{connection_id}/schema",
    summary="Get schema (tables + columns) for a file connection",
)
async def get_schema(connection_id: str, _user: dict = Depends(require_role("viewer"))) -> Dict[str, Any]:
    """Return schema metadata (tables, columns, row counts)."""
    if not is_file_connection(connection_id):
        raise HTTPException(
            status_code=404,
            detail=f"File connection '{connection_id}' not found.",
        )
    schema = build_schema_for_file(connection_id)
    return schema.dict() if hasattr(schema, "dict") else schema.model_dump()


# ---------------------------------------------------------------------------
# List / disconnect
# ---------------------------------------------------------------------------

@router.get("/connections", summary="List all active file connections")
async def list_file_connections(_user: dict = Depends(require_role("viewer"))) -> List[Dict[str, Any]]:
    return list_connections()


@router.delete(
    "/{connection_id}",
    summary="Close and delete a file connection",
)
async def disconnect_file(connection_id: str, _user: dict = Depends(require_role("admin"))) -> Dict[str, Any]:
    if not is_file_connection(connection_id):
        raise HTTPException(
            status_code=404,
            detail=f"File connection '{connection_id}' not found.",
        )
    await close_connection(connection_id)
    return {"success": True, "message": f"Connection '{connection_id}' closed."}
