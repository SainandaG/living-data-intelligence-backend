"""Unify password column name to hashed_password across all environments.

Migration 0001 created the column as `password_hash`.
The register endpoint and seed script both write to `hashed_password`.
This migration renames the column so everything is consistent.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-06
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename password_hash → hashed_password if it exists under the old name
    # Uses DO $$ block so it's safe to run even if already renamed
    op.execute("""
        DO $$
        BEGIN
            -- Only rename if old column exists and new one does NOT
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'password_hash'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'hashed_password'
            ) THEN
                ALTER TABLE users RENAME COLUMN password_hash TO hashed_password;
                RAISE NOTICE 'Renamed password_hash → hashed_password';
            ELSE
                RAISE NOTICE 'Column already unified or hashed_password already exists — skipping rename';
            END IF;
        END
        $$;
    """)

    # Also add any missing columns the register endpoint expects
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'APPROVED';")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_captured BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS biometric_login_enabled BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pending BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT TRUE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_global_logout_at TIMESTAMPTZ;")


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'hashed_password'
            ) THEN
                ALTER TABLE users RENAME COLUMN hashed_password TO password_hash;
            END IF;
        END
        $$;
    """)
