"""APEX platform additions — audit log table and RBAC role column.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Audit log ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id          BIGSERIAL PRIMARY KEY,
            event_type  TEXT NOT NULL,
            user_id     TEXT,
            session_id  TEXT,
            tenant_id   TEXT NOT NULL DEFAULT 'default',
            resource_id TEXT,
            metadata    JSONB,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_tenant     ON audit_log(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_created    ON audit_log(created_at DESC)")

    # ── Tenant table for multi-tenancy ────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS tenants (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            plan        TEXT NOT NULL DEFAULT 'free',
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # Insert default tenant so FK constraints don't block dev usage
    op.execute("""
        INSERT INTO tenants (id, name, plan)
        VALUES ('default', 'Default Tenant', 'free')
        ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tenants")
    op.execute("DROP TABLE IF EXISTS audit_log")
