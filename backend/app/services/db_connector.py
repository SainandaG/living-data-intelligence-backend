import psycopg2
from psycopg2 import pool
import pymysql
from pymongo import MongoClient
from typing import Dict, Any, Optional, List
import asyncio
import time

class DatabaseConnector:
    def __init__(self):
        self.connections: Dict[str, Dict[str, Any]] = {}
        self.locks: Dict[str, asyncio.Lock] = {}
        self.connection_counter = 0

    async def connect(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Connect to a database and return connection info"""
        start_time = time.perf_counter()
        self.connection_counter += 1
        connection_id = f"conn_{self.connection_counter}"
        self.locks[connection_id] = asyncio.Lock()
        
        
        db_type = config['db_type'].lower()
        host = config.get('host', '').lower()
        
        with open("connection_debug.log", "a") as f:
            f.write(f"\n--- {time.ctime()} ---\n")
            f.write(f"Incoming Host: {host}, DB Type: {db_type}\n")
        
        # Auto-detect mock mode: if host is 'mock', use mock database regardless of db_type
        if host == 'mock':
            db_type = 'mock'
            print(f"[MOCK] Mock mode auto-detected (host='mock')")
            
        # Optimization: Neon pooler endpoints are often much slower/unstable than direct ones
        # and Neon ALWAYS requires SSL.
        if 'neon.tech' in host:
            if '-pooler' in host:
                new_host = host.replace('-pooler', '')
                config['host'] = new_host
                with open("connection_debug.log", "a") as f:
                    f.write(f"AUTO-FIX: Stripped -pooler. New Host: {new_host}\n")
                print(f"[NEON] Optimized Neon connection: Stripped -pooler suffix ({host} -> {new_host})")
            
            # Force db_type to neon for SSL requirement
            if db_type != 'neon':
                db_type = 'neon'
                config['db_type'] = 'neon'
                with open("connection_debug.log", "a") as f:
                    f.write(f"AUTO-FIX: Forced Neon DB type for SSL.\n")
                print(f"[SSL] Forced Neon SSL mode (sslmode=require) for {config['host']}")
        
        try:
            # Enforce application-level timeout
            async def _connect_wrapper():
                nonlocal db_type
                if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                    db_type = 'postgresql'
                    return await asyncio.to_thread(self._connect_postgresql_sync, config)
                elif db_type == 'mysql':
                    db_type = 'mysql'
                    return await asyncio.to_thread(self._connect_mysql_sync, config)
                elif db_type in ['mongodb', 'mongo']:
                    db_type = 'mongodb'
                    return await asyncio.to_thread(self._connect_mongodb_sync, config)
                elif db_type == 'mock':
                    return "MOCK_CLIENT"
                else:
                    raise ValueError(f"Unsupported database type: {db_type}")

            print(f"[CONNECT] Dispatching connection thread for {db_type} (Timeout: 110s)...")
            client = await asyncio.wait_for(_connect_wrapper(), timeout=110.0)
            
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
            
            duration = time.perf_counter() - start_time
            print(f"[SUCCESS] Connected to {db_type} database: {config['database']} (in {duration:.3f}s)")
            
            # CRITICAL: Background the schema analysis AFTER storing connection but BEFORE returning
            # This ensures the API responds immediately
            asyncio.create_task(self._background_schema_analysis_task(connection_id))
            
            return {'id': connection_id, 'type': db_type}
            
        except asyncio.TimeoutError:
            duration = time.perf_counter() - start_time
            error_msg = f"Connection timeout after {duration:.1f}s. This often happens if the database is hibernating/sleeping (common with Neon free tier) or blocked by a firewall. Please ensure the database is active and reachable."
            print(f"[ERROR] {error_msg}")
            raise TimeoutError(error_msg)
        except Exception as e:
            duration = time.perf_counter() - start_time
            print(f"[ERROR] Failed to connect to {db_type} after {duration:.3f}s: {str(e)}")
            raise

    async def _background_schema_analysis_task(self, connection_id: str):
        try:
            from app.services.schema_analyzer import schema_analyzer
            await schema_analyzer.analyze_schema(connection_id)
        except Exception as e:
            print(f" Background schema analysis failed for {connection_id}: {e}")

    def _connect_postgresql_sync(self, config: Dict[str, Any]):
        """Connect to PostgreSQL"""
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1, 10,
            host=config['host'],
            port=config.get('port', 5432),
            database=config['database'],
            user=config['username'],
            password=config['password'],
            connect_timeout=100, # Increased for high latency cloud databases
            sslmode='require' if config.get('db_type', '').lower() in ['neon', 'neon_db'] else 'prefer'
        )
        
        # Connection pool creation already validates connectivity
        # No need for additional test query that can cause timeouts
        print(f"[SUCCESS] PostgreSQL connection pool created successfully")
        
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
        lock = self.locks.get(connection_id)
        try:
            if lock:
                async with lock:
                    result = await asyncio.to_thread(self._query_sync, connection_id, sql, params)
            else:
                result = await asyncio.to_thread(self._query_sync, connection_id, sql, params)
            
            duration = time.perf_counter() - start_time
            if duration > 0.5: # Log slow queries
                print(f" Slow Query ({duration:.3f}s): {sql[:100]}...")
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
                retries = 2
                while retries > 0:
                    try:
                        conn = connection['client'].getconn()
                        # Check if connection is alive, if not, discard and get a new one
                        if conn.closed != 0:
                            connection['client'].putconn(conn, close=True)
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
                    except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                        if "closed" in str(e).lower() or "terminated" in str(e).lower():
                            print(f"[RETRY] Connection stale, retrying... ({retries} left)")
                            if conn:
                                connection['client'].putconn(conn, close=True)
                                conn = None
                            retries -= 1
                            if retries == 0: raise
                            continue
                        raise
                    finally:
                        if conn:
                            connection['client'].putconn(conn)
                        retries = 0 # Exit loop on success
                
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
                return self._get_mock_data(sql, params)
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
                print(f"[CLOSE] Closed connection: {connection_id}")
            except Exception as e:
                print(f"Error closing connection {connection_id}: {str(e)}")

    async def close_all(self):
        """Close all connections"""
        print("Closing all database connections...")
        for connection_id in list(self.connections.keys()):
            await self.close(connection_id)

    def _get_mock_data(self, sql: str, params: tuple):
        """Return simulated data for testing."""
        sql_lower = sql.lower()
        
        if "information_schema.tables" in sql_lower:
            return [
                {"table_name": "users", "table_schema": "public"},
                {"table_name": "orders", "table_schema": "public"},
                {"table_name": "products", "table_schema": "public"}
            ]
        elif "information_schema.columns" in sql_lower:
            return [
                {"table_name": "users", "column_name": "id", "data_type": "integer", "is_nullable": "NO", "column_default": None, "character_maximum_length": None},
                {"table_name": "users", "column_name": "created_at", "data_type": "timestamp", "is_nullable": "NO", "column_default": None, "character_maximum_length": None},
                {"table_name": "orders", "column_name": "id", "data_type": "integer", "is_nullable": "NO", "column_default": None, "character_maximum_length": None},
                {"table_name": "orders", "column_name": "created_at", "data_type": "timestamp", "is_nullable": "NO", "column_default": None, "character_maximum_length": None},
                {"table_name": "products", "column_name": "id", "data_type": "integer", "is_nullable": "NO", "column_default": None, "character_maximum_length": None},
                {"table_name": "products", "column_name": "created_at", "data_type": "timestamp", "is_nullable": "NO", "column_default": None, "character_maximum_length": None}
            ]
        elif "pg_class" in sql_lower:
            return [
                {"table_name": "users", "row_count": 1000},
                {"table_name": "orders", "row_count": 5000},
                {"table_name": "products", "row_count": 200}
            ]
        elif "min(\"created_at\")" in sql_lower or "min(created_at)" in sql_lower:
            # Simulate birth dates
            from datetime import datetime, timedelta
            if "from \"users\"" in sql_lower:
                return [{"birth_date": datetime.now() - timedelta(days=365)}]
            if "from \"orders\"" in sql_lower:
                return [{"birth_date": datetime.now() - timedelta(days=200)}]
            if "from \"products\"" in sql_lower:
                return [{"birth_date": datetime.now() - timedelta(days=300)}]
        
        return []

# Global instance
db_connector = DatabaseConnector()
