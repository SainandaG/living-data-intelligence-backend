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
            id SERIAL PRIMARY KEY,
            connection_id TEXT NOT NULL,
            snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            neural_data JSONB DEFAULT '{}',
            core_metrics JSONB DEFAULT '{}'
        );
        """
        await db_connector.execute(connection_id, create_table_sql)
        
        # 3. Index for performance
        await db_connector.execute(connection_id, "CREATE INDEX IF NOT EXISTS idx_snapshots_conn_id ON evolution.neural_snapshots(connection_id)")

        logger.info("✅ Essential database migrations completed for %s", connection_id)
    except Exception as e:
        logger.error("❌ Migration failed for %s: %s", connection_id, e)
