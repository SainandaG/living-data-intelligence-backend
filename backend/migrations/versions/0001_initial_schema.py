"""Initial schema — core tables for Living Data Intelligence backend.

Captures the tables that the application creates/assumes at runtime.
All DDL is idempotent (IF NOT EXISTS) so this can be re-run safely.

Revision ID: 0001
Revises:
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Users / Auth ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email       TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role        TEXT NOT NULL DEFAULT 'viewer',
            tenant_id   TEXT NOT NULL DEFAULT 'default',
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── Database connections ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS connections (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        TEXT NOT NULL,
            db_type     TEXT NOT NULL,
            host        TEXT NOT NULL,
            port        INTEGER NOT NULL DEFAULT 5432,
            db_name     TEXT NOT NULL,
            username    TEXT NOT NULL,
            password_enc TEXT NOT NULL,
            tenant_id   TEXT NOT NULL DEFAULT 'default',
            owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_tested TIMESTAMPTZ
        )
    """)

    # ── ML experiment runs ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ml_runs (
            run_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experiment   TEXT NOT NULL,
            algo         TEXT NOT NULL,
            family       TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'running',
            metrics      JSONB,
            params       JSONB,
            feature_importances JSONB,
            tenant_id    TEXT NOT NULL DEFAULT 'default',
            connection_id TEXT,
            started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at  TIMESTAMPTZ
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_ml_runs_experiment ON ml_runs(experiment, tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ml_runs_status    ON ml_runs(status)")

    # ── Decisions / Alerts ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS decisions (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title       TEXT NOT NULL,
            description TEXT,
            severity    TEXT NOT NULL DEFAULT 'info',
            status      TEXT NOT NULL DEFAULT 'pending',
            source_type TEXT NOT NULL DEFAULT 'manual',
            connection_id TEXT,
            tenant_id   TEXT NOT NULL DEFAULT 'default',
            confidence  REAL NOT NULL DEFAULT 1.0,
            findings    JSONB NOT NULL DEFAULT '[]',
            recommended_actions JSONB NOT NULL DEFAULT '[]',
            action_types JSONB NOT NULL DEFAULT '[]',
            requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            resolved_at TIMESTAMPTZ,
            resolved_by TEXT
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_decisions_tenant   ON decisions(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_decisions_severity ON decisions(severity)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_decisions_status   ON decisions(status)")

    # ── Agent sessions ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_sessions (
            session_id   UUID PRIMARY KEY,
            query        TEXT NOT NULL,
            intent       TEXT,
            step_count   INTEGER NOT NULL DEFAULT 0,
            status       TEXT NOT NULL DEFAULT 'running',
            tenant_id    TEXT NOT NULL DEFAULT 'default',
            user_id      TEXT,
            connection_id TEXT,
            memory       JSONB,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant ON agent_sessions(tenant_id)")

    # ── Investigation workspaces ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title         TEXT NOT NULL,
            connection_id TEXT,
            session_id    UUID,
            tenant_id     TEXT NOT NULL DEFAULT 'default',
            user_id       TEXT,
            canvas_state  JSONB NOT NULL DEFAULT '{}',
            evidence_chain JSONB NOT NULL DEFAULT '[]',
            status        TEXT NOT NULL DEFAULT 'open',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workspaces")
    op.execute("DROP TABLE IF EXISTS agent_sessions")
    op.execute("DROP TABLE IF EXISTS decisions")
    op.execute("DROP TABLE IF EXISTS ml_runs")
    op.execute("DROP TABLE IF EXISTS connections")
    op.execute("DROP TABLE IF EXISTS users")
