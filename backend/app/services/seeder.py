"""
Database Seeder Service
Generates temporal data for testing and demos (Evolution Playback).
"""
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.services.db_connector import db_connector

logger = logging.getLogger(__name__)

class DatabaseSeeder:
    """
    Seeds database with tables and temporal data.
    """
    
    async def seed_database(self, connection_id: str) -> Dict[str, Any]:
        """Create schema and seed data for evolution playback."""
        logger.info(f"Seeding database for connection: {connection_id}...")
        
        # Determine schema (Neon workaround: if public is locked, use 'evolution')
        self.schema = 'public'  # hardcoded — no user input
        try:
            await db_connector.query(connection_id, "CREATE TABLE IF NOT EXISTS public._seeder_test (id int)")
            await db_connector.query(connection_id, "DROP TABLE public._seeder_test")
        except Exception:
            logger.warning("Schema 'public' is restricted. Falling back to 'evolution' schema.")
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
                logger.warning(f"Failed to grant schema permissions: {e}")
            self.schema = 'evolution'  # hardcoded — no user input

        # Validate schema name to prevent injection if it ever changes
        db_connector.validate_identifier(self.schema)

        # Determine if MySQL
        conn_info = db_connector.get_connection(connection_id)
        db_type = conn_info.get('type', 'postgresql').lower()
        is_mysql = 'mysql' in db_type

        # 1. Create Tables
        await self._create_tables(connection_id)
        
        # 2. Seed Data with Temporal Spacing
        await self._seed_users(connection_id, count=100, is_mysql=is_mysql)
        await self._seed_products(connection_id, count=20, is_mysql=is_mysql)
        await self._seed_orders(connection_id, count=500, is_mysql=is_mysql)
        await self._seed_transactions(connection_id, count=1000, is_mysql=is_mysql)
        
        # WEZU Energy Seeding
        await self._seed_wezu_assets(connection_id, is_mysql=is_mysql)
        await self._seed_wezu_telemetry(connection_id, is_mysql=is_mysql)
        
        logger.info(f"Seeding complete for {connection_id} using schema: {self.schema}")
        return {"success": True, "message": f"Database seeded successfully in schema '{self.schema}'"}

    async def _create_tables(self, connection_id: str):
        """Create the schema tables."""
        conn_info = db_connector.get_connection(connection_id)
        db_type = conn_info.get('type', 'postgresql').lower()
        is_mysql = 'mysql' in db_type
        
        # Dialect transformations
        auto_inc = "SERIAL" if not is_mysql else "INT AUTO_INCREMENT"
        json_type = "JSONB" if not is_mysql else "JSON"
        tz_timestamp = "TIMESTAMP WITH TIME ZONE" if not is_mysql else "TIMESTAMP"
        
        queries = [
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.users (
                id {auto_inc} PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.products (
                id {auto_inc} PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                created_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.orders (
                id {auto_inc} PRIMARY KEY,
                user_id INTEGER,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.transactions (
                id {auto_inc} PRIMARY KEY,
                order_id INTEGER,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50),
                status VARCHAR(50) DEFAULT 'completed',
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.batteries (
                id {auto_inc} PRIMARY KEY,
                serial_number VARCHAR(100) UNIQUE NOT NULL,
                soh_percentage DECIMAL(5,2) DEFAULT 100.00,
                voltage DECIMAL(10,2),
                temperature DECIMAL(5,2),
                lifetime_revenue DECIMAL(15,2) DEFAULT 0.00,
                swap_variance DECIMAL(10,5) DEFAULT 0.00,
                last_reported_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stations (
                id {auto_inc} PRIMARY KEY,
                station_name VARCHAR(255) NOT NULL,
                location_lat DECIMAL(10,6),
                location_lng DECIMAL(10,6),
                inventory_level INTEGER DEFAULT 0,
                total_swaps INTEGER DEFAULT 0,
                status VARCHAR(50) DEFAULT 'active'
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.iot_devices (
                id {auto_inc} PRIMARY KEY,
                device_id VARCHAR(100) UNIQUE NOT NULL,
                firmware_version VARCHAR(50),
                signal_strength INTEGER
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.battery_health_log (
                id {auto_inc} PRIMARY KEY,
                battery_id INTEGER,
                soh_percentage DECIMAL(5,2),
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.telematics_data (
                id {auto_inc} PRIMARY KEY,
                battery_id INTEGER,
                voltage DECIMAL(10,2),
                current DECIMAL(10,2),
                temperature DECIMAL(5,2),
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.gps_tracking_log (
                id {auto_inc} PRIMARY KEY,
                battery_id INTEGER,
                lat DECIMAL(10,6),
                lng DECIMAL(10,6),
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.swap_transactions (
                id {auto_inc} PRIMARY KEY,
                battery_id INTEGER,
                station_id INTEGER,
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.warehouses (
                id {auto_inc} PRIMARY KEY,
                warehouse_name VARCHAR(255) NOT NULL,
                inventory_level INTEGER DEFAULT 0,
                location_lat DECIMAL(10,6),
                location_lng DECIMAL(10,6)
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.battery_lifecycle_event (
                id {auto_inc} PRIMARY KEY,
                battery_id INTEGER,
                event_type VARCHAR(100) NOT NULL,
                metadata {json_type},
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.rentals (
                id {auto_inc} PRIMARY KEY,
                user_id INTEGER,
                battery_id INTEGER,
                started_at {tz_timestamp},
                ended_at {tz_timestamp}
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.wallet_transactions (
                id {auto_inc} PRIMARY KEY,
                user_id INTEGER,
                amount DECIMAL(10,2),
                type VARCHAR(50),
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.rental_payments (
                id {auto_inc} PRIMARY KEY,
                rental_id INTEGER,
                amount DECIMAL(10,2),
                status VARCHAR(50)
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.kyc_records (
                id {auto_inc} PRIMARY KEY,
                user_id INTEGER,
                id_type VARCHAR(50),
                status VARCHAR(50)
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.biometric_data (
                id {auto_inc} PRIMARY KEY,
                user_id INTEGER,
                template_type VARCHAR(50),
                recorded_at {tz_timestamp} DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        
        for sql in queries:
            try:
                # Remove schema prefix if MySQL to avoid 'evolution.' database issues
                if is_mysql:
                    sql = sql.replace(f"{self.schema}.", "")
                await db_connector.query(connection_id, sql)
            except Exception as e:
                logger.warning(f"Error creating table: {e}")

    async def _seed_users(self, connection_id: str, count: int, is_mysql: bool = False):
        start_date = datetime.now() - timedelta(days=365)
        prefix = "" if is_mysql else f"{self.schema}."
        for i in range(count):
            reg_date = start_date + timedelta(days=random.randint(0, 60))
            if not is_mysql:
                sql = 'INSERT INTO ' + prefix + 'users (username, email, created_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING'
            else:
                sql = 'INSERT IGNORE INTO ' + prefix + 'users (username, email, created_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (f"user_{i}", f"user_{i}@example.com", reg_date))

    async def _seed_products(self, connection_id: str, count: int, is_mysql: bool = False):
        start_date = datetime.now() - timedelta(days=300)
        prefix = "" if is_mysql else f"{self.schema}."
        for i in range(count):
            add_date = start_date + timedelta(days=random.randint(0, 30))
            sql = 'INSERT INTO ' + prefix + 'products (name, price, created_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (f"Product {i}", random.uniform(10.0, 500.0), add_date))

    async def _seed_orders(self, connection_id: str, count: int, is_mysql: bool = False):
        prefix = "" if is_mysql else f"{self.schema}."
        # prefix is validated schema, table is literal
        user_ids_resp = await db_connector.query(connection_id, "SELECT id FROM " + prefix + "users")
        user_ids = [r['id'] for r in user_ids_resp]
        if not user_ids: return

        start_date = datetime.now() - timedelta(days=200)
        for i in range(count):
            order_date = start_date + timedelta(days=random.randint(0, 190))
            user_id = random.choice(user_ids)
            sql = 'INSERT INTO ' + prefix + 'orders (user_id, total_amount, created_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (user_id, random.uniform(20.0, 1000.0), order_date))

    async def _seed_transactions(self, connection_id: str, count: int, is_mysql: bool = False):
        prefix = "" if is_mysql else f"{self.schema}."
        # safe: literal table
        order_ids_resp = await db_connector.query(connection_id, "SELECT id, total_amount FROM " + prefix + "orders")
        orders = [(r['id'], r['total_amount']) for r in order_ids_resp]
        if not orders: return

        start_date = datetime.now() - timedelta(days=100)
        for i in range(count):
            order_id, amount = random.choice(orders)
            tx_date = start_date + timedelta(days=random.randint(0, 95))
            sql = 'INSERT INTO ' + prefix + 'transactions (order_id, amount, recorded_at) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (order_id, amount, tx_date))

    async def _seed_wezu_assets(self, connection_id: str, is_mysql: bool = False):
        """Seed WEZU-specific energy assets."""
        logger.info(f"Seeding WEZU Energy assets for {connection_id}...")
        prefix = "" if is_mysql else f"{self.schema}."
        
        # 1. Seed Batteries
        for i in range(15):
            soh = random.uniform(65.0, 100.0)
            revenue = random.uniform(5000, 50000)
            variance = random.uniform(0.01, 5.0)
            if not is_mysql:
                sql = 'INSERT INTO ' + prefix + 'batteries (serial_number, soh_percentage, voltage, temperature, lifetime_revenue, swap_variance) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING'
            else:
                sql = 'INSERT IGNORE INTO ' + prefix + 'batteries (serial_number, soh_percentage, voltage, temperature, lifetime_revenue, swap_variance) VALUES (%s, %s, %s, %s, %s, %s)'
            await db_connector.query(connection_id, sql, (f"BATT-WZ-{1000+i}", soh, random.uniform(48.0, 56.0), random.uniform(25.0, 45.0), revenue, variance))

        # 2. Seed Stations
        stations = ["E-Hub North", "GreenCharge West", "SolarStation Alpha", "WZ-Power Port 4"]
        for name in stations:
            total_swaps = random.randint(100, 1000)
            sql = 'INSERT INTO ' + self.schema + '.stations (station_name, inventory_level, location_lat, location_lng, total_swaps) VALUES (%s, %s, %s, %s, %s)'
            await db_connector.query(connection_id, sql, (name, random.randint(5, 20), 12.9 + random.random(), 77.5 + random.random(), total_swaps))

        # 3. Seed IoT Devices
        for i in range(10):
            if not is_mysql:
                sql = 'INSERT INTO ' + prefix + 'iot_devices (device_id, firmware_version, signal_strength) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING'
            else:
                sql = 'INSERT IGNORE INTO ' + prefix + 'iot_devices (device_id, firmware_version, signal_strength) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (f"IOT-WZ-{5000+i}", "v2.1.4", random.randint(-90, -30)))

    async def _seed_wezu_telemetry(self, connection_id: str, is_mysql: bool = False):
        """Seed longitudinal health logs for Grid Sentinel analysis."""
        prefix = "" if is_mysql else f"{self.schema}."
        battery_ids_resp = await db_connector.query(connection_id, "SELECT id FROM " + prefix + "batteries")
        batt_ids = [r['id'] for r in battery_ids_resp]
        if not batt_ids: return

        logger.info(f"Seeding telemetry logs for {len(batt_ids)} batteries...")
        start_date = datetime.now() - timedelta(days=30)

        for b_id in batt_ids:
            # 1. Health Log (Weekly snapshots)
            current_soh = 100.0
            for week in range(4):
                log_date = start_date + timedelta(weeks=week)
                # Simulate degradation
                current_soh -= random.uniform(0.1, 2.0)
                sql = 'INSERT INTO ' + prefix + 'battery_health_log (battery_id, soh_percentage, recorded_at) VALUES (%s, %s, %s)'
                await db_connector.query(connection_id, sql, (b_id, current_soh, log_date))

            # 2. Telematics (Daily snapshots)
            for day in range(30):
                log_date = start_date + timedelta(days=day)
                sql = 'INSERT INTO ' + prefix + 'telematics_data (battery_id, voltage, current, temperature, recorded_at) VALUES (%s, %s, %s, %s, %s)'
                await db_connector.query(connection_id, sql, (b_id, random.uniform(48.0, 54.0), random.uniform(2.0, 15.0), random.uniform(25.0, 45.0), log_date))

            # 3. GPS Snippet (Current)
            sql = 'INSERT INTO ' + prefix + 'gps_tracking_log (battery_id, lat, lng) VALUES (%s, %s, %s)'
            await db_connector.query(connection_id, sql, (b_id, 12.9 + random.random(), 77.5 + random.random()))

        # 4. Swap Transactions (Random history)
        station_ids_resp = await db_connector.query(connection_id, "SELECT id FROM " + prefix + "stations")
        station_ids = [r['id'] for r in station_ids_resp]
        if station_ids:
            for _ in range(50):
                sql = 'INSERT INTO ' + prefix + 'swap_transactions (battery_id, station_id, recorded_at) VALUES (%s, %s, %s)'
                await db_connector.query(connection_id, sql, (random.choice(batt_ids), random.choice(station_ids), datetime.now() - timedelta(hours=random.randint(0, 720))))

# Global instance
seeder = DatabaseSeeder()
