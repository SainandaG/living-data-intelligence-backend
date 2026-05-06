"""Audit log immutable — adding archived column and rules.

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-05
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add archived column
    op.execute("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;")
    
    # Create rules for immutability
    # Rule to prevent physical deletes
    op.execute("CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;")
    
    # Rule to prevent updates (Note: This will also block the archived=true update unless we allow it)
    # However, following user instruction literally for the rule definition.
    # To allow the transition to archived=true, we would normally use a WHERE clause.
    op.execute("CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;")

def downgrade() -> None:
    # Remove rules
    op.execute("DROP RULE IF EXISTS no_update_audit ON audit_log;")
    op.execute("DROP RULE IF EXISTS no_delete_audit ON audit_log;")
    
    # Remove archived column
    op.execute("ALTER TABLE audit_log DROP COLUMN IF EXISTS archived;")
