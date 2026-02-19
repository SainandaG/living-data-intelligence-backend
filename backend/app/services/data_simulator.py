
import asyncio
import logging
import random
from app.services.db_connector import db_connector

logger = logging.getLogger(__name__)

class DataSimulator:
    def __init__(self):
        self.running = False
        self.task = None

    async def start_simulation(self):
        """Start the background simulation loop"""
        if self.running:
            return
        
        self.running = True
        print("⚡ [DEBUG] DataSimulator.start_simulation() CALLED")
        logger.info("⚡ DataSimulator started. Updates every 60s.")
        self.task = asyncio.create_task(self._simulation_loop())

    async def stop_simulation(self):
        """Stop the background loop"""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 DataSimulator stopped.")

    async def _simulation_loop(self):
        """Main loop that updates data periodially"""
        # Initial Schema Fix (Auto-Heal)
        await self._ensure_schema()
        
        while self.running:
            try:
                await self._update_batteries()
            except Exception as e:
                logger.error(f"⚠️ Simulation Error: {e}")
            
            # Update every 60 seconds (Faster updates for demo)
            await asyncio.sleep(60)

    async def _ensure_schema(self):
        """Check and fix missing columns in key tables"""
        connections = db_connector.list_connections()
        for conn in connections:
            conn_id = conn['id']
            try:
                # 0. Legacy Column Fixes (Rename to standard)
                has_temp_c = await self._has_column(conn_id, 'batteries', 'temperature_c')
                has_volt_v = await self._has_column(conn_id, 'batteries', 'voltage_v')
                
                if has_temp_c:
                    logger.info(f"🛠️ Auto-Fixing Schema: Renaming temperature_c to temperature in {conn_id}")
                    await db_connector.query(conn_id, "ALTER TABLE batteries RENAME COLUMN temperature_c TO temperature")
                
                if has_volt_v:
                    logger.info(f"🛠️ Auto-Fixing Schema: Renaming voltage_v to voltage in {conn_id}")
                    await db_connector.query(conn_id, "ALTER TABLE batteries RENAME COLUMN voltage_v TO voltage")

                # 1. Batteries Table Fixes (Add missing if not present)
                has_soh = await self._has_column(conn_id, 'batteries', 'soh_percentage')
                has_report = await self._has_column(conn_id, 'batteries', 'last_reported_at')
                
                if not has_soh:
                    logger.info(f"🛠️ Auto-Fixing Schema: Adding soh_percentage to batteries in {conn_id}")
                    await db_connector.query(conn_id, "ALTER TABLE batteries ADD COLUMN IF NOT EXISTS soh_percentage DOUBLE PRECISION DEFAULT 100.0")
                
                if not has_report:
                    logger.info(f"🛠️ Auto-Fixing Schema: Adding last_reported_at to batteries in {conn_id}")
                    await db_connector.query(conn_id, "ALTER TABLE batteries ADD COLUMN IF NOT EXISTS last_reported_at TIMESTAMP DEFAULT NOW()")

    async def _has_column(self, connection_id, table, column):
        """Check if column exists"""
        q = f"SELECT 1 FROM information_schema.columns WHERE table_name='{table}' AND column_name='{column}'"
        res = await db_connector.query(connection_id, q)
        return len(res) > 0

    async def _update_batteries(self):
        """Update battery records with random fluctuations AND generate history"""
        connections = db_connector.list_connections()
        
        for conn in connections:
            conn_id = conn['id']
            try:
                # Get existing batteries
                q_batt = "SELECT id, temperature, voltage, soh_percentage FROM batteries LIMIT 50"
                batteries = await db_connector.query(conn_id, q_batt)
                
                if not batteries:
                    # Seed if empty?
                    continue

                for batt in batteries:
                    bid = batt['id']
                    # Current values or defaults
                    curr_temp = float(batt.get('temperature') or 35.0)
                    curr_volt = float(batt.get('voltage') or 48.0)
                    curr_soh = float(batt.get('soh_percentage') or 100.0)
                    
                    # 1. Random Walk Simulation
                    new_temp = max(20.0, min(65.0, curr_temp + (random.uniform(-1.0, 1.5)))) # Trend up slightly
                    new_volt = max(40.0, min(58.0, curr_volt + (random.uniform(-0.5, 0.5))))
                    
                    # SoH degradation: very slow, but occasional drops
                    degrade = 0.001 if random.random() > 0.9 else 0.0
                    new_soh = max(50.0, curr_soh - degrade)

                    # 2. Update Current State (Realtime Monitor Source)
                    upd_sql = f"""
                        UPDATE batteries 
                        SET temperature = {new_temp:.2f}, 
                            voltage = {new_volt:.2f}, 
                            soh_percentage = {new_soh:.2f},
                            last_reported_at = NOW()
                        WHERE id = {bid}
                    """
                    await db_connector.query(conn_id, upd_sql)
                    
                    # 3. Insert Telemetry History (Pattern Analyzer Source)
                    # Use 'telemetics_data' if it exists
                    # Schema: id, timestamp, battery_id, voltage, current, temperature, soc, soh...
                    # We'll just insert core fields
                    hist_sql = f"""
                        INSERT INTO telemetics_data (timestamp, battery_id, voltage, temperature, soh, received_at)
                        VALUES (NOW(), {bid}, {new_volt:.2f}, {new_temp:.2f}, {new_soh:.2f}, NOW())
                    """
                    try:
                        await db_connector.query(conn_id, hist_sql)
                    except Exception as e:
                        # Table might not match perfectly or exist, silently fail for now to keep loop running
                        # But log it once
                        pass
                        
                    # 4. Insert Health Log (Deep Diagnostics Source)
                    # Schema: id, battery_id, health_percentage, timestamp...
                    if random.random() > 0.8: # Log less frequently
                         log_sql = f"""
                            INSERT INTO batteryhealthlog (battery_id, health_percentage, timestamp)
                            VALUES ({bid}, {new_soh:.2f}, NOW())
                        """
                         try:
                            await db_connector.query(conn_id, log_sql)
                         except: pass

                logger.info(f"🔋 Simulated data for {len(batteries)} batteries in {conn_id}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Failed to simulate for {conn_id}: {e}")


data_simulator = DataSimulator()
