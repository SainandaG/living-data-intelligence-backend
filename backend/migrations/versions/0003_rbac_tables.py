"""RBAC tables — permissions, role-permission mappings, user overrides, column policies.

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-27
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Permissions catalogue ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS permissions (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource    TEXT NOT NULL,
            action      TEXT NOT NULL,
            tenant_id   TEXT NOT NULL DEFAULT 'default'
        )
    """)

    # ── Role → Permission mapping ─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            role            TEXT NOT NULL,
            permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role, permission_id)
        )
    """)

    # ── Per-user permission overrides (allow / deny) ──────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_permission_overrides (
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            effect          TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
            PRIMARY KEY (user_id, permission_id)
        )
    """)

    # ── Column-level masking policies ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS column_policies (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            connection_id   TEXT NOT NULL,
            table_name      TEXT NOT NULL,
            column_name     TEXT NOT NULL,
            min_role        TEXT NOT NULL DEFAULT 'viewer',
            mask_strategy   TEXT NOT NULL DEFAULT 'none'
                            CHECK (mask_strategy IN ('none', 'hash', 'redact', 'partial', 'null')),
            tenant_id       TEXT NOT NULL DEFAULT 'default',
            UNIQUE (connection_id, table_name, column_name, tenant_id)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_permissions_tenant      ON permissions(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_column_policies_conn    ON column_policies(connection_id, tenant_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS column_policies")
    op.execute("DROP TABLE IF EXISTS user_permission_overrides")
    op.execute("DROP TABLE IF EXISTS role_permissions")
    op.execute("DROP TABLE IF EXISTS permissions")
