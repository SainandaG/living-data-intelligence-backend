"""audit_log role column

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-05

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS role VARCHAR(50);")

def downgrade():
    op.execute("ALTER TABLE audit_log DROP COLUMN IF EXISTS role;")
