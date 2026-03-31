"""
Database Connector

Manages async connection pools for PostgreSQL and MySQL databases, with identifier validation and parameterized query execution.
"""
import logging
import asyncpg
import aiomysql
from pymongo import MongoClient
from typing import Dict, Any, List
import asyncio
import time
import os
logger = logging.getLogger(__name__)

class DatabaseConnector:
    def __init__(self):
        logger.info(f"⚙️ DatabaseConnector initialized at {id(self)}")
        self.connections: Dict[str, Dict[str, Any]] = {}
        self.locks: Dict[str, asyncio.Lock] = {} # Locks for non-pooled DBs
        self.connection_counter = 0

    def validate_identifier(self, identifier: str) -> str:
        """Validate an identifier (table or column) to prevent SQL injection."""
        if not identifier:
            return identifier
        import re
        # Allow alphanumeric, underscores, and dots (schema.table)
        if not re.match(r'^[a-zA-Z0-9_\.]+$', str(identifier)):
            raise ValueError(f"Invalid identifier (possible SQL injection): {identifier}")
        return identifier

    def quote_identifier(self, connection_id: str, identifier: str) -> str:
        """Quote a database identifier (table/column) based on connection type"""
        self.validate_identifier(identifier)
        try:
            connection = self.get_connection(connection_id)
            db_type = connection['type'].lower()
            if 'mysql' in db_type or 'mariadb' in db_type:
                return f"`{identifier}`"
            # Default to double quotes for Postgres, SQLite, etc.
            return f'"{identifier}"'
        except Exception as e:
            logger.debug(f"quote_identifier fallback for {identifier}: {e}")
            # Default to standard quotes
            return f'"{identifier}"'

    async def connect(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Connect to a database and return connection info with retry logic for cold starts"""
        start_time = time.perf_counter()
        self.connection_counter += 1
        connection_id = f"conn_{self.connection_counter}"
        
        config['host'] = config.get('host', '').strip()
        config['database'] = config.get('database', '').strip()
        config['username'] = config.get('username', '').strip()

        db_type = config['db_type'].lower()
        host = config['host'].lower()

        if host == 'mock':
            raise ValueError("Mock database mode is no longer supported.")

        if 'neon.tech' in host:
            if db_type != 'neon':
                db_type = 'neon'
                config['db_type'] = 'neon'
                logger.info("Forced Neon SSL mode (sslmode=require) for host")
        max_retries = int(os.getenv("NEON_MAX_RETRIES", "3"))
        total_timeout = int(os.getenv("NEON_CONNECT_TIMEOUT", "180"))
        
        # Neon wake-up error messages
        NEON_WAKEUP_ERRORS = [
            "connection refused",
            "the database system is starting up",
            "ssl connection has been closed unexpectedly",
            "terminating connection due to administrator command"
        ]

        attempt = 0

        while attempt < max_retries:
            attempt += 1
            # escalating timeouts: 30s, 60s, 90s
            current_attempt_timeout = attempt * 30 
            
            try:
                logger.warning(f"🔌 Connection attempt {attempt}/{max_retries} to {config['database']} (timeout={current_attempt_timeout}s)...")
                async def _connect_wrapper():
                    # Pass the current attempt timeout for inner handlers
                    config['_current_timeout'] = current_attempt_timeout
                    if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                        return await self._connect_postgresql_async(config)
                    elif db_type == 'mysql':
                        return await self._connect_mysql_async(config)
                    elif db_type in ['mongodb', 'mongo']:
                        return await asyncio.to_thread(self._connect_mongodb_sync, config)
                    else:
                        raise ValueError(f"Unsupported database type: {db_type}")

                client = await asyncio.wait_for(_connect_wrapper(), timeout=float(total_timeout))
                
                self.connections[connection_id] = {
                    'id': connection_id,
                    'type': db_type,
                    'client': client,
                    'config': {
                        'host': config['host'],
                        'port': config['port'],
                        'database': config['database']
                    }
                }
                
                self.locks[connection_id] = asyncio.Lock()
                
                duration = time.perf_counter() - start_time
                logger.info(f"✅ DONE: Connected to {db_type} database: {config['database']} (Attempt {attempt} in {duration:.3f}s)")
                async def _background_schema_analysis():
                    try:
                        from app.services.schema_analyzer import schema_analyzer
                        await schema_analyzer.analyze_schema(connection_id)
                    except Exception as e:
                        logger.error(f"⚠️ Background schema analysis failed for {connection_id}: {e}")
                asyncio.create_task(_background_schema_analysis())
                
                return {'id': connection_id, 'type': db_type}

            except (asyncio.TimeoutError, Exception) as e:
                error_msg = str(e).lower()
                is_neon_wakeup = any(substring in error_msg for substring in NEON_WAKEUP_ERRORS)
                
                duration = time.perf_counter() - start_time
                if attempt < max_retries and (is_neon_wakeup or isinstance(e, asyncio.TimeoutError)):
                    # Exponential backoff: 2s, 5s
                    backoff = 2 if attempt == 1 else 5
                    logger.error(f"⏳ Neon DB is waking up (Attempt {attempt}/{max_retries} failed after {duration:.1f}s). Retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                    continue
                else:
                    logger.error(f"❌ FAIL: Final connection attempt {attempt} failed after {duration:.3f}s: {str(e)}")
                    if isinstance(e, asyncio.TimeoutError):
                        raise TimeoutError(f"Connection timeout after {duration:.1f}s. Database may be sleeping/paused.")
                    raise e

    async def _connect_postgresql_async(self, config: Dict[str, Any]):
        """Connect to PostgreSQL using asyncpg pool"""
        timeout = config.get('_current_timeout', 60)
        sslmode = 'require' if config.get('db_type', '').lower() in ['neon', 'neon_db'] else 'prefer'
        
        # In asyncpg, sslmode=require is achieved by passing ssl=True for default context
        import ssl
        ssl_ctx = ssl.create_default_context() if sslmode == 'require' else None
        if sslmode == 'require':
            # Neon uses valid TLS certs from trusted CAs — enforce full chain + hostname verification
            ssl_ctx.check_hostname = True
            ssl_ctx.verify_mode = ssl.CERT_REQUIRED
            
        pool = await asyncpg.create_pool(
            host=config['host'],
            port=config.get('port', 5432),
            user=config['username'],
            password=config['password'],
            database=config['database'],
            min_size=2,
            max_size=10,
            command_timeout=timeout,
            ssl=ssl_ctx
        )
        logger.info("✅ PostgreSQL async connection pool created successfully")
        return pool

    async def _connect_mysql_async(self, config: Dict[str, Any]):
        """Connect to MySQL using aiomysql pool"""
        pool = await aiomysql.create_pool(
            host=config['host'],
            port=config.get('port', 3306),
            user=config['username'],
            password=config['password'],
            db=config['database'],
            minsize=2,
            maxsize=10,
            connect_timeout=10,
            autocommit=True,
            charset='utf8mb4'
        )
        
        # Test connection and force UTF-8
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SET NAMES 'utf8mb4'")
                await cur.execute("SELECT NOW()")
                
        logger.info("✅ MySQL async connection pool created successfully")
        return pool

    def _connect_mongodb_sync(self, config: Dict[str, Any]):
        """Connect to MongoDB"""
        logger.warning("⚠️ [WARNING] MongoDB is using synchronous pymongo MongoClient! Replace with motor.")
        uri = f"mongodb://{config['username']}:{config['password']}@{config['host']}:{config.get('port', 27017)}/{config['database']}"
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000, # 5 second timeout for server selection
            connectTimeoutMS=5000         # 5 second timeout for connection
        )
        # Test connection
        client.admin.command('ping')
        return client

    def list_connections(self) -> List[Dict[str, Any]]:
        """List all active connections"""
        return [
            {
                'id': conn['id'],
                'type': conn['type'],
                'host': conn['config']['host'],
                'database': conn['config']['database']
            }
            for conn in self.connections.values()
        ]

    def get_connection(self, connection_id: str) -> Dict[str, Any]:
        """Get connection by ID with better error reporting"""
        if connection_id not in self.connections:
            available = list(self.connections.keys())
            logger.error(f"❌ Connection {connection_id} not found. Available: {available}")
            raise ValueError(f"Connection {connection_id} not found. Please connect first.")
        return self.connections[connection_id]
        
    def _convert_psycopg2_to_asyncpg_params(self, sql: str) -> str:
        """Helper to convert %s to $1, $2, etc. dynamically for backwards compatibility"""
        idx = 1
        while "%s" in sql:
            sql = sql.replace("%s", f"${idx}", 1)
            idx += 1
        return sql

    async def query(self, connection_id: str, sql: str, params: tuple = ()):
        """Execute an asynchronous query and return results directly from the pool"""
        start_time = time.perf_counter()
        
        try:
            connection = self.get_connection(connection_id)
            db_type = connection['type']
            client = connection['client']
            
            # [FIX] Check if pool is closed or closing
            if hasattr(client, 'is_closing') and client.is_closing():
                logger.error(f"❌ FAIL: Database pool for {connection_id} is in 'CLOSING' state. This usually means the backend is restarting or the connection was lost.")
                raise RuntimeError(f"Database pool for {connection_id} is closing or closed.")
            
            # [FIX] Validate parameters against placeholders to prevent cryptic asyncpg errors
            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                if ('$1' in sql or '%s' in sql) and not params:
                    logger.error(f"❌ FAIL: Query contains placeholders but no parameters were provided. SQL: {sql}")
                    raise ValueError("Query expects parameters but none were provided.")

            if hasattr(client, 'get_size') and hasattr(client, 'get_max_size'):
                logger.debug(f"Pool {connection_id} status: {client.get_size()}/{client.get_max_size()}")
            
            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                # Replace synchronous %s interpolators with asyncpg's positional $1, $2 params
                sql = self._convert_psycopg2_to_asyncpg_params(sql)
                async with connection['client'].acquire() as conn:
                    if params:
                        records = await conn.fetch(sql, *params)
                    else:
                        records = await conn.fetch(sql)
                    result = [dict(r) for r in records]
                    
            elif db_type == 'mysql':
                async with connection['client'].acquire() as conn:
                    async with conn.cursor(aiomysql.DictCursor) as cur:
                        if params:
                            await cur.execute(sql, params)
                        else:
                            await cur.execute(sql)
                        result = await cur.fetchall()
            
            elif db_type in ['mongodb', 'mongo']:
                # Maintain thread delegation strictly for non-refactored NoSQL
                # We do not have proper query parameters mapping here yet since we don't have SQL logic context.
                raise NotImplementedError("MongoDB native querying directly through pool not exposed.")
                
            duration = time.perf_counter() - start_time
            if duration > 0.5: # Log slow queries
                if "CREATE SCHEMA" not in sql and "neural_snapshots" not in sql:
                    logger.warning(f"🐢 Slow Query ({duration:.3f}s): {sql[:100]}...")
            return result
            
        except Exception as e:
            duration = time.perf_counter() - start_time
            logger.error(f"FAIL: Async Query Error after {duration:.3f}s: {str(e)}")
            raise

    async def close(self, connection_id: str):
        """Close a specific async pool"""
        if connection_id in self.connections:
            connection = self.connections[connection_id]
            try:
                if connection['type'] in ['postgresql', 'postgres', 'neon', 'neon_db', 'mysql']:
                    await connection['client'].close()
                elif connection['type'] in ['mongodb', 'mongo']:
                    connection['client'].close()
                
                del self.connections[connection_id]
                logger.info(f"🔌 Closed async connection pool: {connection_id}")
            except Exception as e:
                logger.info(f"Error closing async connection {connection_id}: {str(e)}")
    async def close_all(self):
        """Close all connections"""
        import traceback
        caller = "".join(traceback.format_stack()[-5:])
        logger.info(f"🛑 DatabaseConnector.close_all() called from:\n{caller}")
        logger.info("Closing all database connection pools...")
        for connection_id in list(self.connections.keys()):
            await self.close(connection_id)

# Global instance
db_connector = DatabaseConnector()
