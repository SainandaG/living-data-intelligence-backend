from app.services.db_connector import db_connector
from app.services.ai_classifier import ai_classifier
from app.models.schemas import Schema, Table, Column, ForeignKey, Relationship
from typing import Dict, List, Any

class SchemaAnalyzer:
    async def analyze_schema(self, connection_id: str) -> Schema:
        """Analyze database schema"""
        connection = db_connector.get_connection(connection_id)
        db_type = connection['type']
        
        print(f"🔍 Analyzing schema for connection: {connection_id}")
        
        if db_type in ['postgresql', 'postgres']:
            schema = await self._analyze_postgresql(connection_id)
        elif db_type == 'mysql':
            schema = await self._analyze_mysql(connection_id)
        elif db_type in ['mongodb', 'mongo']:
            schema = await self._analyze_mongodb(connection_id)
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
        
        # Classify tables using AI
        schema = await ai_classifier.classify_tables(schema)
        
        print(f"✅ Schema analysis complete: {len(schema.tables)} tables found")
        return schema

    async def _analyze_postgresql(self, connection_id: str) -> Schema:
        """Analyze PostgreSQL schema"""
        # Get all tables
        tables_query = """
            SELECT table_name, table_schema
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """
        
        tables_data = await db_connector.query(connection_id, tables_query)
        connection = db_connector.get_connection(connection_id)
        
        schema = Schema(
            database=connection['config']['database'],
            tables=[],
            relationships=[]
        )
        
        for table_row in tables_data:
            table_name = table_row['table_name']
            
            # Get columns
            columns_query = """
                SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """
            columns_data = await db_connector.query(connection_id, columns_query, (table_name,))
            
            # Get primary keys
            pk_query = """
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = %s::regclass AND i.indisprimary;
            """
            pk_data = await db_connector.query(connection_id, pk_query, (table_name,))
            
            # Get foreign keys
            fk_query = """
                SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s;
            """
            fk_data = await db_connector.query(connection_id, fk_query, (table_name,))
            
            # Get row count
            count_query = f"SELECT COUNT(*) as count FROM {table_name}"
            count_result = await db_connector.query(connection_id, count_query)
            row_count = int(count_result[0]['count'])
            
            # Identify numeric columns
            numeric_types = ['integer', 'bigint', 'numeric', 'real', 'double precision', 'money', 'smallint']
            numeric_columns = [col['column_name'] for col in columns_data if col['data_type'] in numeric_types]
            
            # Build table object
            table = Table(
                name=table_name,
                schema=table_row['table_schema'],
                columns=[Column(
                    name=col['column_name'],
                    type=col['data_type'],
                    nullable=col['is_nullable'] == 'YES',
                    default=col['column_default'],
                    max_length=col['character_maximum_length']
                ) for col in columns_data],
                primary_keys=[pk['attname'] for pk in pk_data],
                foreign_keys=[ForeignKey(
                    column=fk['column_name'],
                    referenced_table=fk['foreign_table_name'],
                    referenced_column=fk['foreign_column_name']
                ) for fk in fk_data],
                row_count=row_count,
                numeric_columns=numeric_columns
            )
            
            schema.tables.append(table)
            
            # Add relationships
            for fk in fk_data:
                schema.relationships.append(Relationship(
                    from_table=table_name,
                    to_table=fk['foreign_table_name'],
                    from_column=fk['column_name'],
                    to_column=fk['foreign_column_name']
                ))
        
        return schema

    async def _analyze_mysql(self, connection_id: str) -> Schema:
        """Analyze MySQL schema"""
        connection = db_connector.get_connection(connection_id)
        database = connection['config']['database']
        
        tables_query = """
            SELECT TABLE_NAME as table_name
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s
            ORDER BY TABLE_NAME;
        """
        tables_data = await db_connector.query(connection_id, tables_query, (database,))
        
        schema = Schema(database=database, tables=[], relationships=[])
        
        for table_row in tables_data:
            table_name = table_row['table_name']
            
            columns_query = """
                SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type,
                       IS_NULLABLE as is_nullable, COLUMN_DEFAULT as column_default,
                       CHARACTER_MAXIMUM_LENGTH as character_maximum_length
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                ORDER BY ORDINAL_POSITION;
            """
            columns_data = await db_connector.query(connection_id, columns_query, (database, table_name))
            
            count_query = f"SELECT COUNT(*) as count FROM `{table_name}`"
            count_result = await db_connector.query(connection_id, count_query)
            row_count = int(count_result[0]['count'])
            
            numeric_types = ['int', 'bigint', 'decimal', 'float', 'double', 'smallint', 'tinyint']
            numeric_columns = [col['column_name'] for col in columns_data if col['data_type'] in numeric_types]
            
            table = Table(
                name=table_name,
                columns=[Column(
                    name=col['column_name'],
                    type=col['data_type'],
                    nullable=col['is_nullable'] == 'YES',
                    default=col['column_default'],
                    max_length=col['character_maximum_length']
                ) for col in columns_data],
                primary_keys=[],
                foreign_keys=[],
                row_count=row_count,
                numeric_columns=numeric_columns
            )
            
            schema.tables.append(table)
        
        return schema

    async def _analyze_mongodb(self, connection_id: str) -> Schema:
        """Analyze MongoDB schema"""
        connection = db_connector.get_connection(connection_id)
        client = connection['client']
        db = client[connection['config']['database']]
        
        collections = db.list_collection_names()
        
        schema = Schema(
            database=connection['config']['database'],
            tables=[],
            relationships=[]
        )
        
        for coll_name in collections:
            coll = db[coll_name]
            sample = coll.find_one()
            count = coll.count_documents({})
            
            columns = []
            numeric_columns = []
            
            if sample:
                for key, value in sample.items():
                    col_type = type(value).__name__
                    columns.append(Column(
                        name=key,
                        type=col_type,
                        nullable=True
                    ))
                    if isinstance(value, (int, float)):
                        numeric_columns.append(key)
            
            table = Table(
                name=coll_name,
                columns=columns,
                primary_keys=['_id'],
                foreign_keys=[],
                row_count=count,
                numeric_columns=numeric_columns
            )
            
            schema.tables.append(table)
        
        return schema

# Global instance
schema_analyzer = SchemaAnalyzer()
