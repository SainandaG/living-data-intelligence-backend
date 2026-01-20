import asyncio
from app.services.db_connector import db_connector
from app.services.ai_classifier import ai_classifier
from app.models.schemas import Schema, Table, Column, ForeignKey, Relationship
from typing import Dict, List, Any

class SchemaAnalyzer:
    def __init__(self):
        self.analysis_results: Dict[str, Schema] = {}

    def get_analysis_result(self, connection_id: str) -> Schema:
        """Get cached analysis result"""
        return self.analysis_results.get(connection_id)

    async def analyze_schema(self, connection_id: str) -> Schema:
        """Analyze database schema"""
        connection = db_connector.get_connection(connection_id)
        db_type = connection['type']
        
        print(f"🔍 Analyzing schema for connection: {connection_id}")
        
        if db_type in ['postgresql', 'postgres', 'neon', 'neon_db', 'mock']:
            schema = await self._analyze_postgresql(connection_id)
        elif db_type == 'mysql':
            schema = await self._analyze_mysql(connection_id)
        elif db_type in ['mongodb', 'mongo']:
            schema = await self._analyze_mongodb(connection_id)
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
        
        # 1. Fast Initial Classification (Heuristic)
        # This ensures the schema has some meta-data immediately
        schema = ai_classifier._heuristic_classify(schema)
        
        # Cache the result
        self.analysis_results[connection_id] = schema
        
        # 2. Parallel AI & agent tasks
        # Background slow Gemini classification
        asyncio.create_task(self._background_classification(schema))
        
        # Trigger Agentic AI Analysis for Neural Core seeding
        from app.services.agent_service import agent_service
        try:
            schema_dict = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
            asyncio.create_task(agent_service.analyze_new_connection(schema_dict))
        except Exception as e:
            print(f"⚠️ Agent seeding failed: {e}")
            
        print(f"✅ Fast Schema analysis complete: {len(schema.tables)} tables mapped")
        return schema

    async def _background_classification(self, schema: Schema):
        """Run deep AI classification in background"""
        try:
            print("🧠 Background: Starting deep AI classification...")
            await ai_classifier.classify_tables(schema)
            print("🧠 Background: AI classification complete.")
        except Exception as e:
            print(f"⚠️ Background classification failed: {e}")

    async def _analyze_postgresql(self, connection_id: str) -> Schema:
        """Analyze PostgreSQL schema using bulk queries for performance"""
        connection = db_connector.get_connection(connection_id)
        schema_name = 'public' # Default to public, could be config-driven
        
        # 1. Get all tables
        tables_query = """
            SELECT table_name, table_schema
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """
        tables_data = await db_connector.query(connection_id, tables_query)
        
        # 2. Bulk fetch columns
        columns_query = """
            SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_name, ordinal_position;
        """
        all_columns = await db_connector.query(connection_id, columns_query)
        
        # 3. Bulk fetch PKs
        pk_query = """
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu 
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY' 
              AND tc.table_schema NOT IN ('pg_catalog', 'information_schema');
        """
        all_pks = await db_connector.query(connection_id, pk_query)
        
        # 4. Bulk fetch FKs
        fk_query = """
            SELECT kcu.table_name, kcu.column_name, 
                   ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu 
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu 
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema NOT IN ('pg_catalog', 'information_schema');
        """
        all_fks = await db_connector.query(connection_id, fk_query)
        
        # 5. Fast row-count estimates (O(1) lookup vs O(N) scan)
        count_query = """
            SELECT relname as table_name, reltuples::bigint as row_count
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND c.relkind = 'r';
        """
        all_counts = await db_connector.query(connection_id, count_query)
        
        # Group data for easy lookup
        col_map = {}
        for c in all_columns:
            t = c['table_name']
            if t not in col_map: col_map[t] = []
            col_map[t].append(c)
            
        pk_map = {}
        for p in all_pks:
            t = p['table_name']
            if t not in pk_map: pk_map[t] = []
            pk_map[t].append(p['column_name'])
            
        fk_map = {}
        for f in all_fks:
            t = f['table_name']
            if t not in fk_map: fk_map[t] = []
            fk_map[t].append(f)
            
        count_map = {r['table_name']: r['row_count'] for r in all_counts}

        # Build schema
        schema = Schema(
            database=connection['config']['database'],
            tables=[],
            relationships=[]
        )
        
        numeric_types = ['integer', 'bigint', 'numeric', 'real', 'double precision', 'money', 'smallint']
        
        for table_row in tables_data:
            table_name = table_row['table_name']
            t_cols = col_map.get(table_name, [])
            t_pks = pk_map.get(table_name, [])
            t_fks = fk_map.get(table_name, [])
            t_row_count = count_map.get(table_name, 0)
            
            table_obj = Table(
                name=table_name,
                schema_name=table_row['table_schema'],
                columns=[Column(
                    name=col['column_name'],
                    type=col['data_type'],
                    nullable=col['is_nullable'] == 'YES',
                    default=col['column_default'],
                    max_length=col['character_maximum_length'],
                    is_pk=col['column_name'] in t_pks,
                    is_fk=col['column_name'] in [f['column_name'] for f in t_fks]
                ) for col in t_cols],
                primary_keys=t_pks,
                foreign_keys=[ForeignKey(
                    column=fk['column_name'],
                    referenced_table=fk['foreign_table_name'],
                    referenced_column=fk['foreign_column_name']
                ) for fk in t_fks],
                row_count=t_row_count,
                numeric_columns=[col['column_name'] for col in t_cols if col['data_type'] in numeric_types]
            )
            
            schema.tables.append(table_obj)
            
            for fk in t_fks:
                schema.relationships.append(Relationship(
                    from_table=table_name,
                    to_table=fk['foreign_table_name'],
                    from_column=fk['column_name'],
                    to_column=fk['foreign_column_name']
                ))
                
        return schema

    async def _analyze_mysql(self, connection_id: str) -> Schema:
        """Analyze MySQL schema using bulk queries for performance"""
        connection = db_connector.get_connection(connection_id)
        database = connection['config']['database']
        
        # 1. Get all tables and counts in one go
        tables_query = """
            SELECT TABLE_NAME as table_name, TABLE_ROWS as row_count
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s
            ORDER BY TABLE_NAME;
        """
        tables_data = await db_connector.query(connection_id, tables_query, (database,))
        
        # 2. Bulk fetch columns
        columns_query = """
            SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, DATA_TYPE as data_type,
                   IS_NULLABLE as is_nullable, COLUMN_DEFAULT as column_default,
                   CHARACTER_MAXIMUM_LENGTH as character_maximum_length
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s
            ORDER BY TABLE_NAME, ORDINAL_POSITION;
        """
        all_columns = await db_connector.query(connection_id, columns_query, (database,))
        
        # 3. Bulk fetch PKs and FKs
        kcu_query = """
            SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, 
                   CONSTRAINT_NAME as constraint_name,
                   REFERENCED_TABLE_NAME as referenced_table,
                   REFERENCED_COLUMN_NAME as referenced_column
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = %s;
        """
        all_kcu = await db_connector.query(connection_id, kcu_query, (database,))
        
        # Group data
        col_map = {}
        for c in all_columns:
            t = c['table_name']
            if t not in col_map: col_map[t] = []
            col_map[t].append(c)
            
        pk_map = {}
        fk_map = {}
        for k in all_kcu:
            t = k['table_name']
            if k['constraint_name'] == 'PRIMARY':
                if t not in pk_map: pk_map[t] = []
                pk_map[t].append(k['column_name'])
            elif k['referenced_table']:
                if t not in fk_map: fk_map[t] = []
                fk_map[t].append(k)
        
        schema = Schema(database=database, tables=[], relationships=[])
        numeric_types = ['int', 'bigint', 'decimal', 'float', 'double', 'smallint', 'tinyint']
        
        for table_row in tables_data:
            table_name = table_row['table_name']
            t_cols = col_map.get(table_name, [])
            t_pks = pk_map.get(table_name, [])
            t_fks = fk_map.get(table_name, [])
            
            table_obj = Table(
                name=table_name,
                columns=[Column(
                    name=col['column_name'],
                    type=col['data_type'],
                    nullable=col['is_nullable'] == 'YES',
                    default=col['column_default'],
                    max_length=col['character_maximum_length'],
                    is_pk=col['column_name'] in t_pks,
                    is_fk=col['column_name'] in [f['column_name'] for f in t_fks]
                ) for col in t_cols],
                primary_keys=t_pks,
                foreign_keys=[ForeignKey(
                    column=fk['column_name'],
                    referenced_table=fk['referenced_table'],
                    referenced_column=fk['referenced_column']
                ) for fk in t_fks],
                row_count=table_row['row_count'] or 0,
                numeric_columns=[col['column_name'] for col in t_cols if col['data_type'] in numeric_types]
            )
            
            schema.tables.append(table_obj)
            
            for fk in t_fks:
                schema.relationships.append(Relationship(
                    from_table=table_name,
                    to_table=fk['referenced_table'],
                    from_column=fk['column_name'],
                    to_column=fk['referenced_column']
                ))
                
        return schema

    async def _analyze_mongodb(self, connection_id: str) -> Schema:
        """Analyze MongoDB schema (remains sequential for now as sampling is needed per collection)"""
        connection = db_connector.get_connection(connection_id)
        client = connection['client']
        database_name = connection['config']['database']
        db = client[database_name]
        
        collections = await asyncio.to_thread(db.list_collection_names)
        
        schema = Schema(database=database_name, tables=[], relationships=[])
        
        for coll_name in collections:
            # For Mongo, we need to sample to get "columns" (fields)
            coll = db[coll_name]
            count = await asyncio.to_thread(coll.count_documents, {})
            sample = await asyncio.to_thread(list, coll.find().limit(5))
            
            fields = {}
            for doc in sample:
                for k, v in doc.items():
                    fields[k] = type(v).__name__
            
            numeric_columns = [k for k, v in fields.items() if v in ['int', 'float']]
            
            table = Table(
                name=coll_name,
                columns=[Column(
                    name=f, 
                    type=t, 
                    is_pk=(f == "_id"),
                    nullable=True
                ) for f, t in fields.items()],
                primary_keys=["_id"],
                foreign_keys=[],
                row_count=count,
                numeric_columns=numeric_columns
            )
            
            schema.tables.append(table)
        
        return schema

# Global instance
schema_analyzer = SchemaAnalyzer()
