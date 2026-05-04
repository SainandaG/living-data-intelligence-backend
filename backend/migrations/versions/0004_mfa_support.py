"""MFA support — adding mfa_secret and mfa_enabled to users table.

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-02
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add columns to users table
    op.execute("""
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
        ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE
    """)

def downgrade() -> None:
    # Remove columns from users table
    op.execute("""
        ALTER TABLE users 
        DROP COLUMN IF EXISTS mfa_secret,
        DROP COLUMN IF EXISTS mfa_enabled
    """)
