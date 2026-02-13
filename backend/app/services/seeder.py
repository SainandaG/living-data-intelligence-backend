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
        
        # WEZU Energy Seeding
        await self._seed_wezu_assets(connection_id)
        await self._seed_wezu_telemetry(connection_id)
        
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
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.batteries (
                id SERIAL PRIMARY KEY,
                serial_number TEXT UNIQUE NOT NULL,
                soh_percentage DECIMAL(5,2) DEFAULT 100.00,
                voltage DECIMAL(10,2),
                temperature DECIMAL(5,2),
                lifetime_revenue DECIMAL(15,2) DEFAULT 0.00,
                swap_variance DECIMAL(10,5) DEFAULT 0.00,
                last_reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stations (
                id SERIAL PRIMARY KEY,
                station_name TEXT NOT NULL,
                location_lat DECIMAL(10,6),
                location_lng DECIMAL(10,6),
                inventory_level INTEGER DEFAULT 0,
                total_swaps INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active'
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.iot_devices (
                id SERIAL PRIMARY KEY,
                device_id TEXT UNIQUE NOT NULL,
                firmware_version TEXT,
                signal_strength INTEGER
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.battery_health_log (
                id SERIAL PRIMARY KEY,
                battery_id INTEGER REFERENCES {self.schema}.batteries(id),
                soh_percentage DECIMAL(5,2),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.telematics_data (
                id SERIAL PRIMARY KEY,
                battery_id INTEGER REFERENCES {self.schema}.batteries(id),
                voltage DECIMAL(10,2),
                current DECIMAL(10,2),
                temperature DECIMAL(5,2),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.gps_tracking_log (
                id SERIAL PRIMARY KEY,
                battery_id INTEGER REFERENCES {self.schema}.batteries(id),
                lat DECIMAL(10,6),
                lng DECIMAL(10,6),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.swap_transactions (
                id SERIAL PRIMARY KEY,
                battery_id INTEGER REFERENCES {self.schema}.batteries(id),
                station_id INTEGER REFERENCES {self.schema}.stations(id),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.warehouses (
                id SERIAL PRIMARY KEY,
                warehouse_name TEXT NOT NULL,
                inventory_level INTEGER DEFAULT 0,
                location_lat DECIMAL(10,6),
                location_lng DECIMAL(10,6)
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.battery_lifecycle_event (
                id SERIAL PRIMARY KEY,
                battery_id INTEGER REFERENCES {self.schema}.batteries(id),
                event_type TEXT NOT NULL,
                metadata JSONB,
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.rentals (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES {self.schema}.users(id),
                battery_id INTEGER REFERENCES {self.schema}.batteries(id),
                started_at TIMESTAMP WITH TIME ZONE,
                ended_at TIMESTAMP WITH TIME ZONE
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.wallet_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES {self.schema}.users(id),
                amount DECIMAL(10,2),
                type TEXT,
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.rental_payments (
                id SERIAL PRIMARY KEY,
                rental_id INTEGER REFERENCES {self.schema}.rentals(id),
                amount DECIMAL(10,2),
                status TEXT
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.kyc_records (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES {self.schema}.users(id),
                id_type TEXT,
                status TEXT
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.biometric_data (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES {self.schema}.users(id),
                template_type TEXT,
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

    async def _seed_wezu_assets(self, connection_id: str):
        """Seed WEZU-specific energy assets."""
        print(f"⚡ Seeding WEZU Energy assets for {connection_id}...")
        
        # 1. Seed Batteries
        for i in range(15):
            soh = random.uniform(65.0, 100.0)
            revenue = random.uniform(5000, 50000)
            variance = random.uniform(0.01, 5.0)
            sql = f'INSERT INTO {self.schema}.batteries (serial_number, soh_percentage, voltage, temperature, lifetime_revenue, swap_variance) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING'
            await db_connector.query(connection_id, sql, (f"BATT-WZ-{1000+i}", soh, random.uniform(48.0, 56.0), random.uniform(25.0, 45.0), revenue, variance))

        # 2. Seed Stations
        stations = ["E-Hub North", "GreenCharge West", "SolarStation Alpha", "WZ-Power Port 4"]
        for name in stations:
            total_swaps = random.randint(100, 1000)
            sql = f'INSERT INTO {self.schema}.stations (station_name, inventory_level, location_lat, location_lng, total_swaps) VALUES (%s, %s, %s, %s, %s)'
            await db_connector.query(connection_id, sql, (name, random.randint(5, 20), 12.9 + random.random(), 77.5 + random.random(), total_swaps))

        # 3. Seed IoT Devices
        for i in range(10):
            sql = f'INSERT INTO {self.schema}.iot_devices (device_id, firmware_version, signal_strength) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING'
            await db_connector.query(connection_id, sql, (f"IOT-WZ-{5000+i}", "v2.1.4", random.randint(-90, -30)))

    async def _seed_wezu_telemetry(self, connection_id: str):
        """Seed longitudinal health logs for Grid Sentinel analysis."""
        battery_ids_resp = await db_connector.query(connection_id, f"SELECT id FROM {self.schema}.batteries")
        batt_ids = [r['id'] for r in battery_ids_resp]
        if not batt_ids: return

        print(f"📈 Seeding telemetry logs for {len(batt_ids)} batteries...")
        start_date = datetime.now() - timedelta(days=30)

        for b_id in batt_ids:
            # 1. Health Log (Weekly snapshots)
            current_soh = 100.0
            for week in range(4):
                log_date = start_date + timedelta(weeks=week)
                # Simulate degradation
                current_soh -= random.uniform(0.1, 2.0)
                sql = f'INSERT INTO {self.schema}.battery_health_log (battery_id, soh_percentage, recorded_at) VALUES (%s, %s, %s)'
                await db_connector.query(connection_id, sql, (b_id, current_soh, log_date))

            # 2. Telematics (Daily snapshots)
            for day in range(30):
                log_date = start_date + timedelta(days=day)
                sql = f'INSERT INTO {self.schema}.telematics_data (battery_id, voltage, current, temperature, recorded_at) VALUES (%s, %s, %s, %s, %s)'
                await db_connector.query(connection_id, sql, (b_id, random.uniform(48.0, 54.0), random.uniform(2.0, 15.0), random.uniform(25.0, 45.0), log_date))

            # 3. GPS Snippet (Current)
            sql = f'INSERT INTO {self.schema}.gps_tracking_log (battery_id, lat, lng) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (b_id, 12.9 + random.random(), 77.5 + random.random()))

        # 4. Swap Transactions (Random history)
        station_ids_resp = await db_connector.query(connection_id, f"SELECT id FROM {self.schema}.stations")
        station_ids = [r['id'] for r in station_ids_resp]
        if station_ids:
            for _ in range(50):
                sql = f'INSERT INTO {self.schema}.swap_transactions (battery_id, station_id, recorded_at) VALUES (%s, %s, %s)'
                await db_connector.query(connection_id, sql, (random.choice(batt_ids), random.choice(station_ids), datetime.now() - timedelta(hours=random.randint(0, 720))))

# Global instance
seeder = DatabaseSeeder()
