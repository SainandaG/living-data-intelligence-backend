"""
Database Seeder Service
Generates temporal data for testing and demos (Evolution Playback).
"""
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.services.db_connector import db_connector

class DatabaseSeeder:
    """
    Seeds database with tables and temporal data.
    """
    
    async def seed_database(self, connection_id: str) -> Dict[str, Any]:
        """Create schema and seed data for evolution playback."""
        print(f"🌱 Seeding database for connection: {connection_id}...")
        
        # Determine schema (Neon workaround: if public is locked, use 'evolution')
        self.schema = 'public'
        try:
            await db_connector.query(connection_id, "CREATE TABLE IF NOT EXISTS public._seeder_test (id int)")
            await db_connector.query(connection_id, "DROP TABLE public._seeder_test")
        except Exception:
            print("⚠️ Schema 'public' is restricted. Falling back to 'evolution' schema.")
            await db_connector.query(connection_id, "CREATE SCHEMA IF NOT EXISTS evolution")
            try:
                # Explicitly grant permissions to ensure access (Using permissive public grants for reliability)
                await db_connector.query(connection_id, "GRANT USAGE ON SCHEMA evolution TO public")
                await db_connector.query(connection_id, "GRANT SELECT ON ALL TABLES IN SCHEMA evolution TO public")
                await db_connector.query(connection_id, "ALTER DEFAULT PRIVILEGES IN SCHEMA evolution GRANT SELECT ON TABLES TO public")
                
                # Ensure owner retains full control
                await db_connector.query(connection_id, "GRANT ALL ON SCHEMA evolution TO neondb_owner")
                await db_connector.query(connection_id, "GRANT ALL ON ALL TABLES IN SCHEMA evolution TO neondb_owner")
            except Exception as e:
                print(f"⚠️ Failed to grant schema permissions: {e}")
            self.schema = 'evolution'

        # 1. Create Tables
        await self._create_tables(connection_id)
        
        # 2. Seed Data with Temporal Spacing
        await self._seed_users(connection_id, count=100)
        await self._seed_products(connection_id, count=20)
        await self._seed_orders(connection_id, count=500)
        await self._seed_transactions(connection_id, count=1000)
        
        print(f"✅ Seeding complete for {connection_id} using schema: {self.schema}")
        return {"success": True, "message": f"Database seeded successfully in schema '{self.schema}'"}

    async def _create_tables(self, connection_id: str):
        """Create the schema tables."""
        queries = [
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES {self.schema}.users(id),
                total_amount DECIMAL(10,2) NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.transactions (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES {self.schema}.orders(id),
                amount DECIMAL(10,2) NOT NULL,
                payment_method TEXT,
                status TEXT DEFAULT 'completed',
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        
        for sql in queries:
            try:
                await db_connector.query(connection_id, sql)
            except Exception as e:
                print(f"⚠️ Error creating table: {e}")

    async def _seed_users(self, connection_id: str, count: int):
        start_date = datetime.now() - timedelta(days=365)
        for i in range(count):
            reg_date = start_date + timedelta(days=random.randint(0, 60))
            sql = f'INSERT INTO {self.schema}.users (username, email, created_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING'
            await db_connector.query(connection_id, sql, (f"user_{i}", f"user_{i}@example.com", reg_date))

    async def _seed_products(self, connection_id: str, count: int):
        start_date = datetime.now() - timedelta(days=300)
        for i in range(count):
            add_date = start_date + timedelta(days=random.randint(0, 30))
            sql = f'INSERT INTO {self.schema}.products (name, price, created_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (f"Product {i}", random.uniform(10.0, 500.0), add_date))

    async def _seed_orders(self, connection_id: str, count: int):
        user_ids_resp = await db_connector.query(connection_id, f"SELECT id FROM {self.schema}.users")
        user_ids = [r['id'] for r in user_ids_resp]
        if not user_ids: return

        start_date = datetime.now() - timedelta(days=200)
        for i in range(count):
            order_date = start_date + timedelta(days=random.randint(0, 190))
            user_id = random.choice(user_ids)
            sql = f'INSERT INTO {self.schema}.orders (user_id, total_amount, created_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (user_id, random.uniform(20.0, 1000.0), order_date))

    async def _seed_transactions(self, connection_id: str, count: int):
        order_ids_resp = await db_connector.query(connection_id, f"SELECT id, total_amount FROM {self.schema}.orders")
        orders = [(r['id'], r['total_amount']) for r in order_ids_resp]
        if not orders: return

        start_date = datetime.now() - timedelta(days=100)
        for i in range(count):
            order_id, amount = random.choice(orders)
            tx_date = start_date + timedelta(days=random.randint(0, 95))
            sql = f'INSERT INTO {self.schema}.transactions (order_id, amount, recorded_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (order_id, amount, tx_date))

# Global instance
seeder = DatabaseSeeder()
