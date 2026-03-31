"""
Agent Memory — per-session in-memory store for facts, schema findings,
and past ML results. Persisted as JSON alongside the session log.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

SESSIONS_DIR = Path(os.getenv("AGENT_SESSIONS_DIR", "data/agent_sessions"))


@dataclass
class MemoryFact:
    key:       str
    value:     Any
    source:    str          # tool name that produced this fact
    ts:        float = field(default_factory=time.time)


class AgentMemory:
    """
    Key-value fact store for a single agent session.

    Facts are written after each tool execution so they can be referenced
    by downstream steps and survive session resume.
    """

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._facts: Dict[str, MemoryFact] = {}
        self._path = SESSIONS_DIR / f"{session_id}.json"
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        self._load()

    # ── Public API ────────────────────────────────────────────────────────────

    def set(self, key: str, value: Any, source: str = "unknown") -> None:
        self._facts[key] = MemoryFact(key=key, value=value, source=source)
        self._persist()

    def get(self, key: str, default: Any = None) -> Any:
        fact = self._facts.get(key)
        return fact.value if fact else default

    def all_facts(self) -> Dict[str, Any]:
        return {k: f.value for k, f in self._facts.items()}

    def context_for_llm(self, max_chars: int = 1500) -> str:
        """Compact string representation of key facts for LLM context injection."""
        lines = []
        for k, f in self._facts.items():
            val = json.dumps(f.value)[:200]
            lines.append(f"  {k}: {val}")
        text = "\n".join(lines)
        return text[:max_chars]

    def clear(self) -> None:
        self._facts.clear()
        self._persist()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _persist(self) -> None:
        try:
            data = {k: asdict(f) for k, f in self._facts.items()}
            with open(self._path, "w", encoding="utf-8") as fh:
                json.dump(data, fh)
        except Exception as exc:
            logger.debug("memory persist failed: %s", exc)

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            with open(self._path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            for k, v in data.items():
                self._facts[k] = MemoryFact(**v)
        except Exception as exc:
            logger.debug("memory load failed: %s", exc)
