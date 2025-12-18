import psycopg2
from psycopg2 import pool
import pymysql
from pymongo import MongoClient
from typing import Dict, Any, Optional
import asyncio

class DatabaseConnector:
    def __init__(self):
        self.connections: Dict[str, Dict[str, Any]] = {}
        self.connection_counter = 0

    async def connect(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Connect to a database and return connection info"""
        self.connection_counter += 1
        connection_id = f"conn_{self.connection_counter}"
        
        db_type = config['db_type'].lower()
        
        try:
            if db_type in ['postgresql', 'postgres']:
                client = await self._connect_postgresql(config)
            elif db_type == 'mysql':
                client = await self._connect_mysql(config)
            elif db_type in ['mongodb', 'mongo']:
                client = await self._connect_mongodb(config)
            else:
                raise ValueError(f"Unsupported database type: {db_type}")
            
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
            
            print(f"✅ Connected to {db_type} database: {config['database']}")
            return {'id': connection_id, 'type': db_type}
            
        except Exception as e:
            print(f"❌ Failed to connect to {db_type}: {str(e)}")
            raise

    async def _connect_postgresql(self, config: Dict[str, Any]):
        """Connect to PostgreSQL"""
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1, 10,
            host=config['host'],
            port=config.get('port', 5432),
            database=config['database'],
            user=config['username'],
            password=config['password']
        )
        
        # Test connection
        conn = connection_pool.getconn()
        cursor = conn.cursor()
        cursor.execute('SELECT NOW()')
        cursor.close()
        connection_pool.putconn(conn)
        
        return connection_pool

    async def _connect_mysql(self, config: Dict[str, Any]):
        """Connect to MySQL"""
        connection = pymysql.connect(
            host=config['host'],
            port=config.get('port', 3306),
            database=config['database'],
            user=config['username'],
            password=config['password']
        )
        
        # Test connection
        cursor = connection.cursor()
        cursor.execute('SELECT NOW()')
        cursor.close()
        
        return connection

    async def _connect_mongodb(self, config: Dict[str, Any]):
        """Connect to MongoDB"""
        uri = f"mongodb://{config['username']}:{config['password']}@{config['host']}:{config.get('port', 27017)}/{config['database']}"
        client = MongoClient(uri)
        
        # Test connection
        client.admin.command('ping')
        
        return client

    def get_connection(self, connection_id: str) -> Dict[str, Any]:
        """Get connection by ID"""
        if connection_id not in self.connections:
            raise ValueError(f"Connection {connection_id} not found")
        return self.connections[connection_id]

    async def query(self, connection_id: str, sql: str, params: tuple = ()):
        """Execute a query and return results"""
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
            print(f"Query error on {connection_id}: {str(e)}")
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
