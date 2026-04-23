"""
File-Based Database Connector

Handles CSV and Excel (.xlsx/.xls) file uploads and exposes them as
queryable in-memory "databases" using pandas + DuckDB.

Each uploaded file becomes a connection with:
  - connection_id  : unique identifier (like other DB connectors)
  - db_type        : 'csv' | 'excel'
  - tables         : one table per sheet (Excel) or one table (CSV)

DuckDB lets us run real SQL against DataFrames without a server.
"""

import io
import os
import uuid
import logging
import asyncio
from typing import Any, Dict, List, Optional

import pandas as pd

try:
    import duckdb
    HAS_DUCKDB = True
except ImportError:
    HAS_DUCKDB = False

logger = logging.getLogger(__name__)

# In-memory store: connection_id -> FileConnection
_file_connections: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Public API — mirrors db_connector's interface so the rest of the app
# can treat file connections the same as real DB connections.
# ---------------------------------------------------------------------------

async def connect_file(
    file_bytes: bytes,
    filename: str,
    *,
    connection_id: Optional[str] = None,
) -> Dict[str, str]:
    """
    Parse a CSV or Excel file and register it as a queryable connection.

    Returns: { 'id': connection_id, 'type': 'csv' | 'excel' }
    """
    if not HAS_DUCKDB:
        raise ImportError(
            "duckdb is required for file-based connections. "
            "Install it with: pip install duckdb"
        )

    ext = os.path.splitext(filename)[1].lower()
    if ext == ".csv":
        db_type = "csv"
        frames = _parse_csv(file_bytes, filename)
    elif ext in (".xlsx", ".xls", ".xlsm", ".ods"):
        db_type = "excel"
        frames = _parse_excel(file_bytes, filename, ext)
    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported: .csv, .xlsx, .xls, .xlsm, .ods"
        )

    conn_id = connection_id or f"file_{uuid.uuid4().hex[:8]}"

    # Create a DuckDB in-memory connection and register every DataFrame
    duck = duckdb.connect(database=":memory:")
    for table_name, df in frames.items():
        # Sanitise column names (replace spaces/special chars with _)
        df.columns = [_sanitise_col(c) for c in df.columns]
        duck.register(table_name, df)
        logger.info(
            f"📄 Registered table '{table_name}' "
            f"({len(df)} rows × {len(df.columns)} cols) in {conn_id}"
        )

    _file_connections[conn_id] = {
        "id": conn_id,
        "type": db_type,
        "filename": filename,
        "duck": duck,
        "frames": frames,
        "config": {
            "host": "file://",
            "port": 0,
            "database": filename,
        },
        "_reconnect_config": None,  # not applicable
    }

    logger.info(f"✅ File connection created: {conn_id} ({filename})")
    return {"id": conn_id, "type": db_type}


async def query_file(connection_id: str, sql: str, params: tuple = ()):
    """
    Execute a SQL query against the DuckDB in-memory connection.
    Returns a list of dicts (same shape as db_connector.query).
    """
    conn = _get_connection(connection_id)
    duck: duckdb.DuckDBPyConnection = conn["duck"]

    try:
        if params:
            result = duck.execute(sql, list(params)).fetchdf()
        else:
            result = duck.execute(sql).fetchdf()

        return result.to_dict(orient="records")
    except Exception as e:
        logger.error(f"❌ File query error [{connection_id}]: {e}\nSQL: {sql}")
        raise


def get_connection(connection_id: str) -> Dict[str, Any]:
    return _get_connection(connection_id)


def list_connections() -> List[Dict[str, Any]]:
    return [
        {
            "id": c["id"],
            "type": c["type"],
            "host": "file://",
            "database": c["filename"],
        }
        for c in _file_connections.values()
    ]


async def close_connection(connection_id: str):
    if connection_id in _file_connections:
        try:
            _file_connections[connection_id]["duck"].close()
        except Exception:
            pass
        del _file_connections[connection_id]
        logger.info(f"🗑️ File connection closed: {connection_id}")


def get_tables(connection_id: str) -> Dict[str, pd.DataFrame]:
    """Return raw DataFrames keyed by table name."""
    return _get_connection(connection_id)["frames"]


# ---------------------------------------------------------------------------
# Schema introspection — used by SchemaAnalyzer
# ---------------------------------------------------------------------------

def build_schema_for_file(connection_id: str):
    """
    Returns a dict that matches the structure SchemaAnalyzer expects,
    so existing schema-based features (graph view, AI analysis, etc.) work
    without modification.
    """
    from app.models.schemas import Schema, Table, Column, Relationship, ForeignKey

    conn = _get_connection(connection_id)
    frames: Dict[str, pd.DataFrame] = conn["frames"]

    tables = []
    relationships = []

    def _pk_candidates(table_name: str):
        """Generate all plausible PK column names for a table."""
        base = table_name.lower()
        # singular: strip trailing 's' (Orders→order, Customers→customer)
        singular = base.rstrip("s") if base.endswith("s") else base
        return {
            "id", "uuid",
            f"{base}_id", f"{base}id",
            f"{singular}_id", f"{singular}id",
        }

    def _fk_candidates(other_table: str):
        """Generate FK column names that would reference other_table."""
        base = other_table.lower()
        singular = base.rstrip("s") if base.endswith("s") else base
        return {
            f"{base}_id", f"{base}id",
            f"{singular}_id", f"{singular}id",
        }

    # 1. Pre-identify potential PKs for each table
    table_pks: Dict[str, list] = {}
    for table_name, df in frames.items():
        candidates = _pk_candidates(table_name)
        pks = [col for col in df.columns if col.lower() in candidates]
        # If nothing matched, take the first column that ends with '_id'
        if not pks:
            pks = [col for col in df.columns if col.lower().endswith("_id")][:1]
        table_pks[table_name] = pks

    # 2. Build Table objects
    for table_name, df in frames.items():
        columns = []
        numeric_cols = []
        pks = table_pks.get(table_name, [])

        for col_name, dtype in zip(df.columns, df.dtypes):
            sql_type = _pandas_dtype_to_sql(dtype)
            is_numeric = pd.api.types.is_numeric_dtype(dtype)
            if is_numeric:
                numeric_cols.append(col_name)

            is_pk = col_name in pks

            # Detect FKs by matching other tables' PK candidate names
            is_fk = False
            for other_table, other_pks in table_pks.items():
                if other_table == table_name:
                    continue

                if col_name.lower() in _fk_candidates(other_table):
                    is_fk = True
                    # Use actual detected PK if available, else guess
                    ref_col = other_pks[0] if other_pks else "id"
                    relationships.append(Relationship(
                        from_table=table_name,
                        to_table=other_table,
                        from_column=col_name,
                        to_column=ref_col,
                    ))
                    break

            columns.append(
                Column(
                    name=col_name,
                    type=sql_type,
                    nullable=True,
                    default=None,
                    max_length=None,
                    is_pk=is_pk,
                    is_fk=is_fk,
                )
            )

        tables.append(
            Table(
                name=table_name,
                schema_name=None,
                columns=columns,
                primary_keys=pks,
                foreign_keys=[
                    ForeignKey(column=r.from_column, referenced_table=r.to_table, referenced_column=r.to_column)
                    for r in relationships if r.from_table == table_name
                ],
                row_count=len(df),
                numeric_columns=numeric_cols,
                table_type="fact" if any(r.from_table == table_name for r in relationships) else "dimension",
                business_entity=table_name,
            )
        )

    return Schema(
        database=conn["filename"],
        tables=tables,
        relationships=relationships,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_connection(connection_id: str) -> Dict[str, Any]:
    if connection_id not in _file_connections:
        raise ValueError(
            f"File connection '{connection_id}' not found. "
            "Please upload a file first."
        )
    return _file_connections[connection_id]


def _parse_csv(file_bytes: bytes, filename: str) -> Dict[str, pd.DataFrame]:
    """Parse CSV bytes into a single-table dict."""
    try:
        df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1")

    # Use filename stem as table name
    table_name = _sanitise_identifier(os.path.splitext(filename)[0])
    return {table_name: df}


def _parse_excel(
    file_bytes: bytes, filename: str, ext: str
) -> Dict[str, pd.DataFrame]:
    """Parse Excel bytes; each sheet becomes a separate table."""
    engine_map = {
        ".xlsx": "openpyxl",
        ".xlsm": "openpyxl",
        ".xls": "xlrd",
        ".ods": "odf",
    }
    engine = engine_map.get(ext, "openpyxl")

    xl = pd.ExcelFile(io.BytesIO(file_bytes), engine=engine)
    frames: Dict[str, pd.DataFrame] = {}

    for sheet in xl.sheet_names:
        df = xl.parse(sheet)
        if df.empty:
            continue
        table_name = _sanitise_identifier(str(sheet))
        frames[table_name] = df

    if not frames:
        raise ValueError(f"No data found in '{filename}'.")

    return frames


def _sanitise_identifier(name: str) -> str:
    """Convert a string to a valid SQL identifier."""
    import re
    name = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip())
    if name and name[0].isdigit():
        name = f"t_{name}"
    return name or "data"


def _sanitise_col(name: str) -> str:
    """Sanitise a column name for use in DuckDB."""
    import re
    return re.sub(r"[^a-zA-Z0-9_]", "_", str(name).strip()) or "col"


def _pandas_dtype_to_sql(dtype) -> str:
    """Map a pandas dtype to a human-readable SQL type string."""
    if pd.api.types.is_integer_dtype(dtype):
        return "INTEGER"
    if pd.api.types.is_float_dtype(dtype):
        return "FLOAT"
    if pd.api.types.is_bool_dtype(dtype):
        return "BOOLEAN"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "TIMESTAMP"
    return "TEXT"


# Convenience: is this a file-backed connection?
def is_file_connection(connection_id: str) -> bool:
    return connection_id in _file_connections
