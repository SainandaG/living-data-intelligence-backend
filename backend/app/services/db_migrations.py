import logging
from app.services.db_connector import db_connector

logger = logging.getLogger(__name__)

async def run_essential_migrations(connection_id: str):
    """
    Ensure critical platform tables exist on the primary database.
    This avoids "Catalog Error" failures during ML analysis or evolution tracking.
    """
    try:
        # 1. Ensure evolution schema exists
        await db_connector.execute(connection_id, "CREATE SCHEMA IF NOT EXISTS evolution")
        
        # 2. Ensure neural_snapshots table exists for persistent model lineage
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS evolution.neural_snapshots (
            snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id TEXT NOT NULL,
            table_name TEXT NOT NULL,
            family TEXT NOT NULL,
            algo TEXT NOT NULL,
            metrics JSONB DEFAULT '{}',
            artifact_path TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            tenant_id TEXT DEFAULT 'default'
        );
        """
        await db_connector.execute(connection_id, create_table_sql)
        
        # 3. Index for performance
        await db_connector.execute(connection_id, "CREATE INDEX IF NOT EXISTS idx_snapshots_run_id ON evolution.neural_snapshots(run_id)")
        await db_connector.execute(connection_id, "CREATE INDEX IF NOT EXISTS idx_snapshots_table ON evolution.neural_snapshots(table_name)")

        logger.info("✅ Essential database migrations completed for %s", connection_id)
    except Exception as e:
        logger.error("❌ Migration failed for %s: %s", connection_id, e)
