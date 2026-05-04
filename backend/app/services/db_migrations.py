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

        # 4. Ensure users table exists for authentication
        await db_connector.execute(connection_id, """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role VARCHAR(50) DEFAULT 'viewer',
            is_active BOOLEAN DEFAULT TRUE,
            two_factor_enabled BOOLEAN DEFAULT FALSE,
            two_factor_secret TEXT,
            tenant_id VARCHAR(50) DEFAULT 'default',
            last_global_logout_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """)

        # 5. Ensure audit_log table exists for administrative tracking
        await db_connector.execute(connection_id, """
        CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY,
            event_type VARCHAR(100) NOT NULL,
            user_id VARCHAR(255),
            session_id VARCHAR(100),
            tenant_id VARCHAR(50) DEFAULT 'default',
            resource_id VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """)

        # 6. Ensure column_policies table exists for redaction Lab
        await db_connector.execute(connection_id, """
        CREATE TABLE IF NOT EXISTS column_policies (
            id SERIAL PRIMARY KEY,
            connection_id TEXT NOT NULL,
            table_name TEXT NOT NULL,
            column_name TEXT NOT NULL,
            min_role VARCHAR(50) DEFAULT 'viewer',
            mask_strategy VARCHAR(50) DEFAULT 'redact',
            tenant_id VARCHAR(50) DEFAULT 'default',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(connection_id, table_name, column_name, tenant_id)
        )
        """)

        # 7. Ensure roles table exists for dynamic RBAC
        await db_connector.execute(connection_id, """
        CREATE TABLE IF NOT EXISTS roles (
            name VARCHAR(50) PRIMARY KEY,
            description TEXT,
            permissions JSONB DEFAULT '{}',
            level INTEGER DEFAULT 0,
            is_system_role BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            category VARCHAR(50) DEFAULT 'Custom',
            tenant_id VARCHAR(50) DEFAULT 'default'
        )
        """)

        # 8. Seed default roles (only inserts if they don't exist)
        default_roles = [
            ("viewer", "Read-only access", '{"dashboard": {"view": "viewer"}, "data": {"read": "viewer"}}', 10),
            ("editor", "Can edit and run simulations", '{"dashboard": {"view": "editor"}, "data": {"read": "editor"}, "simulation": {"run": "editor"}}', 20),
            ("analyst", "Can run ML analysis", '{"dashboard": {"view": "analyst"}, "data": {"read": "analyst"}, "ml": {"analyze": "analyst"}, "drilldown": {"view": "analyst"}, "multi_table": {"view": "analyst"}, "node_xray": {"view": "analyst"}, "agent": {"chat": "execute"}}', 30),
            ("admin", "Full platform control", '{}', 40),
            ("super_admin", "System administration", '{}', 100)
        ]
        
        for role_name, desc, perms, level in default_roles:
            await db_connector.execute(connection_id, f"""
                INSERT INTO roles (name, description, permissions, level, is_system_role, is_active, category, tenant_id) 
                VALUES ('{role_name}', '{desc}', '{perms}'::jsonb, {level}, TRUE, TRUE, 'System', 'default')
                ON CONFLICT (name) DO NOTHING
            """)

        # 9. Seed bootstrap admin user if users table is empty
        import os
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_hash = os.getenv("ADMIN_PASSWORD_HASH")
        
        if admin_email and admin_hash:
            user_count = await db_connector.query(connection_id, "SELECT COUNT(*) FROM users")
            if user_count and user_count[0]['count'] == 0:
                logger.info(" Seeding bootstrap admin user...")
                await db_connector.execute(connection_id, """
                    INSERT INTO users (email, hashed_password, role, is_active)
                    VALUES ($1, $2, 'super_admin', TRUE)
                """, admin_email, admin_hash)

        logger.info(" Essential database migrations completed for %s", connection_id)
    except Exception as e:
        logger.error(" Migration failed for %s: %s", connection_id, e)
