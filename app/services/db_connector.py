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
        
        try:
            # Enforce application-level timeout
            async def _connect_wrapper():
                if db_type in ['postgresql', 'postgres']:
                    return await asyncio.to_thread(self._connect_postgresql_sync, config)
                elif db_type == 'mysql':
                    return await asyncio.to_thread(self._connect_mysql_sync, config)
                elif db_type in ['mongodb', 'mongo']:
                    return await asyncio.to_thread(self._connect_mongodb_sync, config)
                else:
                    raise ValueError(f"Unsupported database type: {db_type}")

            client = await asyncio.wait_for(_connect_wrapper(), timeout=15.0)
            
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
            # Background the schema analysis to prevent connection timeouts
            from app.services.schema_analyzer import schema_analyzer
            asyncio.create_task(schema_analyzer.analyze_schema(connection_id))
            
            duration = time.perf_counter() - start_time
            print(f"✅ Connected to {db_type} database: {config['database']} (in {duration:.3f}s)")
            return {'id': connection_id, 'type': db_type}
            
        except Exception as e:
            duration = time.perf_counter() - start_time
            print(f"❌ Failed to connect to {db_type} after {duration:.3f}s: {str(e)}")
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
            connect_timeout=10 # 10 second timeout
        )
        
        # Test connection
        conn = connection_pool.getconn()
        cursor = conn.cursor()
        cursor.execute('SELECT NOW()')
        cursor.close()
        connection_pool.putconn(conn)
        
        return connection_pool

    def _connect_mysql_sync(self, config: Dict[str, Any]):
        """Connect to MySQL"""
        connection = pymysql.connect(
            host=config['host'],
            port=config.get('port', 3306),
            database=config['database'],
            user=config['username'],
            password=config['password'],
            connect_timeout=10 # 10 second timeout
        )
        
        # Test connection
        cursor = connection.cursor()
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
                print(f"🐢 Slow Query ({duration:.3f}s): {sql[:100]}...")
            return result
        except Exception as e:
            duration = time.perf_counter() - start_time
            print(f"❌ Query Error after {duration:.3f}s: {str(e)}")
            raise

    def _query_sync(self, connection_id: str, sql: str, params: tuple):
        """Synchronous query execution for use in thread pool"""
        connection = self.get_connection(connection_id)
        db_type = connection['type']
        
        try:
            if db_type in ['postgresql', 'postgres']:
                conn = connection['client'].getconn()
                cursor = conn.cursor()
                cursor.execute(sql, params)
                
                # Fetch column names
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                
                # Fetch all rows
                rows = cursor.fetchall()
                
                # Convert to list of dicts
                result = [dict(zip(columns, row)) for row in rows]
                
                cursor.close()
                connection['client'].putconn(conn)
                
                return result
                
            elif db_type == 'mysql':
                cursor = connection['client'].cursor(pymysql.cursors.DictCursor)
                cursor.execute(sql, params)
                result = cursor.fetchall()
                cursor.close()
                return result
                
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

# Global instance
db_connector = DatabaseConnector()
