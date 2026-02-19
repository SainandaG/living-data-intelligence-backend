
import psycopg2
from psycopg2 import pool
import pymysql
from pymongo import MongoClient
from typing import Dict, Any, Optional, List
import asyncio
import time

class DatabaseConnector:
    def __init__(self):
        print(f"⚙️ DatabaseConnector initialized at {id(self)}")
        self.connections: Dict[str, Dict[str, Any]] = {}
        self.locks: Dict[str, asyncio.Lock] = {} # Locks for non-pooled DBs (MySQL)
        self.connection_counter = 0

    def quote_identifier(self, connection_id: str, identifier: str) -> str:
        """Quote a database identifier (table/column) based on connection type"""
        try:
            connection = self.get_connection(connection_id)
            db_type = connection['type'].lower()
            if 'mysql' in db_type or 'mariadb' in db_type:
                return f"`{identifier}`"
            # Default to double quotes for Postgres, SQLite, etc.
            return f'"{identifier}"'
        except Exception as e:
            # Silently default to standard quotes but log if possible
            return f'"{identifier}"'

    async def connect(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Connect to a database and return connection info"""
        start_time = time.perf_counter()
        self.connection_counter += 1
        connection_id = f"conn_{self.connection_counter}"
        
        
        config['host'] = config.get('host', '').strip()
        config['database'] = config.get('database', '').strip()
        config['username'] = config.get('username', '').strip()
        
        db_type = config['db_type'].lower()
        host = config['host'].lower()
        
        with open("connection_debug.log", "a") as f:
            f.write(f"\n--- {time.ctime()} ---\n")
            f.write(f"Incoming Host: {host}, DB Type: {db_type}\n")
        
        # Reject mock connections — mock mode has been removed
        if host == 'mock':
            raise ValueError("Mock database mode is no longer supported. Please provide a real database connection.")
            
        # Optimization: Neon ALWAYS requires SSL.
        if 'neon.tech' in host:
            # Force db_type to neon for SSL requirement
            if db_type != 'neon':
                db_type = 'neon'
                config['db_type'] = 'neon'
                with open("connection_debug.log", "a") as f:
                    f.write(f"AUTO-FIX: Forced Neon DB type for SSL.\n")
                print(f"🔒 Forced Neon SSL mode (sslmode=require) for {config['host']}")
        
        try:
            # Enforce application-level timeout
            async def _connect_wrapper():
                if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                    return await asyncio.to_thread(self._connect_postgresql_sync, config)
                elif db_type == 'mysql':
                    return await asyncio.to_thread(self._connect_mysql_sync, config)
                elif db_type in ['mongodb', 'mongo']:
                    return await asyncio.to_thread(self._connect_mongodb_sync, config)
                elif db_type == 'mock':
                    raise ValueError("Mock database mode is no longer supported. Please use a real database connection.")
                else:
                    raise ValueError(f"Unsupported database type: {db_type}")

            client = await asyncio.wait_for(_connect_wrapper(), timeout=120.0)
            
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
            
            # Initialize lock for this connection (Used for MySQL/Mongo)
            self.locks[connection_id] = asyncio.Lock()
            
            duration = time.perf_counter() - start_time
            print(f"DONE: Connected to {db_type} database: {config['database']} (in {duration:.3f}s)")
            
            # CRITICAL: Background the schema analysis AFTER storing connection but BEFORE returning
            # This ensures the API responds immediately
            async def _background_schema_analysis():
                try:
                    from app.services.schema_analyzer import schema_analyzer
                    await schema_analyzer.analyze_schema(connection_id)
                except Exception as e:
                    print(f"⚠️ Background schema analysis failed for {connection_id}: {e}")
            
            asyncio.create_task(_background_schema_analysis())
            
            return {'id': connection_id, 'type': db_type}
            
        except asyncio.TimeoutError:
            duration = time.perf_counter() - start_time
            error_msg = f"Connection timeout after {duration:.1f}s. Database may be sleeping/paused (common with Neon free tier). Please wake it up in your cloud console or try again in 30 seconds."
            print(f"FAIL: {error_msg}")
            raise TimeoutError(error_msg)
        except Exception as e:
            duration = time.perf_counter() - start_time
            print(f"FAIL: Failed to connect to {db_type} after {duration:.3f}s: {str(e)}")
            raise

    def _connect_postgresql_sync(self, config: Dict[str, Any]):
        """Connect to PostgreSQL"""
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1, 10,
            host=config['host'],
            port=config.get('port', 5432),
            database=config['database'],
            user=config['username'],
            password=config['password'],
            connect_timeout=60, # Increased for high latency cloud databases
            sslmode='require' if config.get('db_type', '').lower() in ['neon', 'neon_db'] else 'prefer'
        )
        
        # Connection pool creation already validates connectivity
        # No need for additional test query that can cause timeouts
        print(f"✅ PostgreSQL connection pool created successfully")
        
        return connection_pool

    def _connect_mysql_sync(self, config: Dict[str, Any]):
        """Connect to MySQL"""
        connection = pymysql.connect(
            host=config['host'],
            port=config.get('port', 3306),
            database=config['database'],
            user=config['username'],
            password=config['password'],
            connect_timeout=10, # 10 second timeout
            charset='utf8mb4'
        )
        
        
        # Test connection and force UTF-8
        cursor = connection.cursor()
        cursor.execute("SET NAMES 'utf8mb4'")
        cursor.execute('SELECT NOW()')
        cursor.close()
        
        return connection

    def _connect_mongodb_sync(self, config: Dict[str, Any]):
        """Connect to MongoDB"""
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
        """Get connection by ID"""
        if connection_id not in self.connections:
            raise ValueError(f"Connection {connection_id} not found")
        return self.connections[connection_id]

    async def query(self, connection_id: str, sql: str, params: tuple = ()):
        """Execute a query and return results with concurrency control"""
        start_time = time.perf_counter()
        
        try:
            # Restore locking for MySQL/Mongo (Not Thread Safe)
            # Postgres uses a pool, so it doesn't need this lock.
            conn = self.connections.get(connection_id)
            if conn and conn['type'] in ['mysql', 'mariadb', 'mongodb', 'mongo']:
                async with self.locks[connection_id]:
                    result = await asyncio.to_thread(self._query_sync, connection_id, sql, params)
            else:
                # Postgres (Pooled) - Run in parallel
                result = await asyncio.to_thread(self._query_sync, connection_id, sql, params)
            
            duration = time.perf_counter() - start_time
            if duration > 0.5: # Log slow queries
                # Suppress expected background schema ops
                if "CREATE SCHEMA" not in sql and "neural_snapshots" not in sql:
                    print(f"🐢 Slow Query ({duration:.3f}s): {sql[:100]}...")
            return result
        except Exception as e:
            duration = time.perf_counter() - start_time
            print(f"FAIL: Query Error after {duration:.3f}s: {str(e)}")
            with open("query_error.log", "a") as f:
                f.write(f"--- ERROR ---\nSQL: {sql}\nERROR: {str(e)}\n")
            raise

    def _query_sync(self, connection_id: str, sql: str, params: tuple):
        """Synchronous query execution for use in thread pool"""
        connection = self.get_connection(connection_id)
        db_type = connection['type']
        
        try:
            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                conn = None
                try:
                    conn = connection['client'].getconn()
                    conn.set_session(autocommit=True)
                    cursor = conn.cursor()
                    if not params:
                        cursor.execute(sql)
                    else:
                        cursor.execute(sql, params)
                    
                    if cursor.description:
                        columns = [desc[0] for desc in cursor.description]
                        rows = cursor.fetchall()
                        result = [dict(zip(columns, row)) for row in rows]
                    else:
                        result = []
                    cursor.close()
                    return result
                finally:
                    if conn:
                        connection['client'].putconn(conn)
                
            elif db_type == 'mysql':
                cursor = connection['client'].cursor(pymysql.cursors.DictCursor)
                # If no params, execute directly to avoid % formatting issues
                if not params:
                    cursor.execute(sql)
                else:
                    cursor.execute(sql, params)
                result = cursor.fetchall()
                cursor.close()
                return result
                
            elif db_type == 'mock':
                raise ValueError("Mock database mode is no longer supported.")
            else:
                raise ValueError(f"Query not supported for {db_type}")
        except Exception as e:
            print(f"Query error: {e}")
            raise

    async def close(self, connection_id: str):
        """Close a specific connection"""
        if connection_id in self.connections:
            connection = self.connections[connection_id]
            try:
                if connection['type'] in ['postgresql', 'postgres']:
                    connection['client'].closeall()
                elif connection['type'] == 'mysql':
                    connection['client'].close()
                elif connection['type'] in ['mongodb', 'mongo']:
                    connection['client'].close()
                
                del self.connections[connection_id]
                print(f"🔌 Closed connection: {connection_id}")
            except Exception as e:
                print(f"Error closing connection {connection_id}: {str(e)}")

    async def close_all(self):
        """Close all connections"""
        print("Closing all database connections...")
        for connection_id in list(self.connections.keys()):
            await self.close(connection_id)

    # _get_mock_data has been removed — mock mode is no longer supported

# Global instance
db_connector = DatabaseConnector()
