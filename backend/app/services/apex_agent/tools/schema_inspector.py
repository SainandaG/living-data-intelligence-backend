"""
Schema Inspector Tool  reads live schema and resolves entity types.
Also handles resolve_entity step aliases.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict

logger = logging.getLogger(__name__)

ENTITY_PATTERNS: Dict[str, list[str]] = {
    "customer":     ["user", "customer", "client", "account", "member", "subscriber"],
    "order":        ["order", "purchase", "transaction", "sale", "invoice"],
    "product":      ["product", "item", "sku", "catalog", "inventory"],
    "event":        ["event", "log", "activity", "action", "click", "session"],
    "subscription": ["subscription", "plan", "contract", "renewal"],
    "payment":      ["payment", "charge", "billing", "refund"],
    "employee":     ["employee", "staff", "hr", "worker"],
    "machine":      ["device", "machine", "sensor", "equipment", "asset"],
}


class SchemaInspectorTool:
    name = "inspect_schema"

    async def execute(
        self, params: Dict[str, Any], memory: Any, connection_id: str
    ) -> AsyncGenerator[Dict, None]:
        yield {"type": "status", "text": "Inspecting database schema..."}

        try:
            from app.services.schema_analyzer import schema_analyzer
            schema = schema_analyzer.get_analysis_result(connection_id)

            if not schema:
                yield {"type": "status", "text": "Schema not cached  triggering analysis..."}
                schema = await schema_analyzer.analyze_schema(connection_id)

            tables = []
            entity_map: Dict[str, str] = {}

            raw_tables = schema.tables if hasattr(schema, "tables") else []
            for t in raw_tables:
                name = t.name if hasattr(t, "name") else str(t)
                row_count = t.row_count if hasattr(t, "row_count") else 0
                cols = [c.name if hasattr(c, "name") else str(c)
                        for c in (t.columns if hasattr(t, "columns") else [])]
                entity_type = _detect_entity(name)
                entity_map[name] = entity_type
                tables.append({
                    "name":        name,
                    "row_count":   row_count,
                    "columns":     cols[:20],
                    "entity_type": entity_type,
                })

            relationships = []
            raw_rels = schema.relationships if hasattr(schema, "relationships") else []
            for r in raw_rels:
                relationships.append({
                    "from":   getattr(r, "from_table", ""),
                    "to":     getattr(r, "to_table", ""),
                    "via":    getattr(r, "join_column", ""),
                    "type":   getattr(r, "relationship_type", "references"),
                })

            result = {
                "tables":        tables,
                "relationships": relationships,
                "entity_map":    entity_map,
                "table_count":   len(tables),
            }

            # Store key facts in memory
            memory.set("schema_tables", tables, source="inspect_schema")
            memory.set("entity_map", entity_map, source="inspect_schema")
            memory.set("relationships", relationships, source="inspect_schema")

            # Pick best candidate table for downstream ML
            best_table = _pick_best_table(tables)
            if best_table:
                memory.set("primary_table", best_table["name"], source="inspect_schema")
                memory.set("primary_table_cols", best_table["columns"], source="inspect_schema")

            n = len(tables)
            entity_types = list(set(entity_map.values()))
            yield {
                "type":    "result",
                "text":    f"Found {n} tables. Entity types detected: {', '.join(entity_types)}.",
                "data":    result,
                "summary": f"{n} tables  {len(relationships)} relationships  entities: {', '.join(entity_types[:5])}",
            }

        except Exception as exc:
            logger.error("schema_inspector failed: %s", exc, exc_info=True)
            yield {"type": "error", "text": f"Schema inspection failed: {exc}"}


def _detect_entity(table_name: str) -> str:
    lower = table_name.lower()
    for entity_type, patterns in ENTITY_PATTERNS.items():
        if any(p in lower for p in patterns):
            return entity_type
    return "unknown"


def _pick_best_table(tables: list) -> Dict | None:
    """Prefer tables that look like facts with lots of rows."""
    scored = []
    for t in tables:
        score = 0
        name = t["name"].lower()
        score += min(t.get("row_count", 0) / 1000, 10)     # up to +10 for rows
        score += len(t.get("columns", [])) * 0.1             # more columns = richer
        if any(w in name for w in ["order", "transaction", "event", "sale"]):
            score += 5
        scored.append((score, t))
    scored.sort(key=lambda x: -x[0])
    return scored[0][1] if scored else None

