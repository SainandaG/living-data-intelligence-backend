"""Audit log: replace DO-INSTEAD rules with a proper TRIGGER and add hash chaining.

PostgreSQL RULES have edge cases (bypassed by COPY, partitions, etc.).
A BEFORE trigger with RAISE EXCEPTION is the robust, standard approach.

Also adds:
  - prev_hash / current_hash columns for tamper-evident chaining
  - A DB function that computes SHA-256(prev_hash || row_data)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-06
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the fragile DO-INSTEAD rules added in 0005
    op.execute("DROP RULE IF EXISTS no_update_audit ON audit_log;")
    op.execute("DROP RULE IF EXISTS no_delete_audit ON audit_log;")

    # 2. Add hash-chaining columns
    op.execute("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS prev_hash TEXT;")
    op.execute("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS current_hash TEXT;")

    # 3. Function: compute SHA-256 chain hash
    #    SHA256( prev_hash || event_type || COALESCE(user_id,'') || ts )
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_compute_hash(
            p_prev_hash  TEXT,
            p_event_type TEXT,
            p_user_id    TEXT,
            p_ts         TEXT
        ) RETURNS TEXT
        LANGUAGE sql
        IMMUTABLE STRICT
        AS $$
            SELECT encode(
                digest(
                    COALESCE(p_prev_hash, 'GENESIS') ||
                    p_event_type ||
                    COALESCE(p_user_id, '') ||
                    p_ts,
                    'sha256'
                ),
                'hex'
            );
        $$;
    """)

    # 4. Trigger function: block UPDATE/DELETE and populate hash on INSERT
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_log_immutable()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        DECLARE
            v_prev_hash TEXT;
        BEGIN
            IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
                RAISE EXCEPTION
                    'audit_log is append-only: % operations are forbidden.',
                    TG_OP
                    USING ERRCODE = 'insufficient_privilege';
            END IF;

            -- INSERT path: compute hash chain
            SELECT current_hash INTO v_prev_hash
            FROM   audit_log
            ORDER  BY id DESC
            LIMIT  1;

            NEW.prev_hash    := COALESCE(v_prev_hash, 'GENESIS');
            NEW.current_hash := audit_compute_hash(
                NEW.prev_hash,
                NEW.event_type::TEXT,
                NEW.user_id,
                COALESCE(NEW.created_at::TEXT, NOW()::TEXT)
            );

            RETURN NEW;
        END;
        $$;
    """)

    # 5. Attach trigger – fires BEFORE INSERT, UPDATE, DELETE
    op.execute("DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_log;")
    op.execute("""
        CREATE TRIGGER trg_audit_immutable
        BEFORE INSERT OR UPDATE OR DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_log;")
    op.execute("DROP FUNCTION IF EXISTS audit_log_immutable();")
    op.execute("DROP FUNCTION IF EXISTS audit_compute_hash(TEXT, TEXT, TEXT, TEXT);")
    op.execute("ALTER TABLE audit_log DROP COLUMN IF EXISTS prev_hash;")
    op.execute("ALTER TABLE audit_log DROP COLUMN IF EXISTS current_hash;")
