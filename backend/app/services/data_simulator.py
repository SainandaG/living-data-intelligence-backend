"""
Data Simulator

Generates realistic synthetic data events to simulate live database activity for demos.
"""

import asyncio
import logging
import os
import random
from app.services.db_connector import db_connector

logger = logging.getLogger(__name__)

# 
#  WEZU Data Simulator
#  Updates every 2 minutes using ONLY the tables that exist in Neon DB.
#
#  Confirmed existing tables (from check_all_tables.py):
#    batteries       (705 rows)  temperature, voltage, current_a, soh_percentage
#    stations         (50 rows)  rating, total_reviews, updated_at
#    telemetics_data  (0 rows)   battery_id, voltage, current, temperature, soc, soh
#    batteryhealthlog (0 rows)   battery_id, health_percentage, voltage, current, temperature
#    gps_tracking_log (0 rows)   battery_id, latitude, longitude, speed, timestamp
#
#  DEMO_MODE guard: set DEMO_MODE=true in the environment to enable simulation.
#  When DEMO_MODE is unset or false the simulator is a no-op so production
#  deployments never accidentally write synthetic rows to a live database.
# 

SIMULATION_INTERVAL_SECONDS = 120  # 2 minutes
_DEMO_MODE = os.getenv("DEMO_MODE", "false").strip().lower() == "true"


class DataSimulator:
    def __init__(self):
        self.running = False
        self.task = None
        self._cycle = 0

    async def start_simulation(self):
        """Start the background simulation loop.

        Only runs when DEMO_MODE=true is set in the environment.
        In production (DEMO_MODE unset / false) this is a deliberate no-op
        so synthetic rows are never written to a live database.
        """
        if not _DEMO_MODE:
            logger.info(
                "DataSimulator: DEMO_MODE is not enabled  simulation skipped. "
                "Set DEMO_MODE=true to activate."
            )
            return
        if self.running:
            return
        self.running = True
        logger.info("DataSimulator: DEMO_MODE enabled  starting simulation loop (interval: %ds).", SIMULATION_INTERVAL_SECONDS)
        self.task = asyncio.create_task(self._simulation_loop())

    async def stop_simulation(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info(" DataSimulator stopped.")

    # 
    #  Main Loop
    # 

    async def _simulation_loop(self):
        while self.running:
            self._cycle += 1
            logger.info(" [DataSimulator] Cycle #%d", self._cycle)
            logger.info(f" [DataSimulator] Cycle #{self._cycle}  updating WEZU tables")
            # Tables updated every 2 minutes:
            #   batteries        UPDATE temperature, voltage, current_a, soh_percentage
            #   telemetics_data  INSERT every battery (100%)
            #   batteryhealthlog INSERT 50% of batteries
            #   gps_tracking_log INSERT 30% of batteries
            #   stations         UPDATE rating, total_reviews

            try:
                await self._update_batteries()
            except Exception as e:
                logger.error("batteries update failed: %s", e)

            try:
                await self._update_stations()
            except Exception as e:
                logger.error("stations update failed: %s", e)

            logger.info(" Cycle #%d done. Sleeping %ds.", self._cycle, SIMULATION_INTERVAL_SECONDS)
            await asyncio.sleep(SIMULATION_INTERVAL_SECONDS)

    # 
    #  1. batteries
    #     Columns: id, temperature, voltage, current_a,
    #              soh_percentage, health_percentage, last_reported_at
    # 

    async def _update_batteries(self):
        for conn in db_connector.list_connections():
            conn_id = conn["id"]
            try:
                rows = await db_connector.query(
                    conn_id,
                    "SELECT id, temperature, voltage, current_a, soh_percentage, health_percentage, cycle_count "
                    "FROM batteries LIMIT 50"  # Reduced from all 705 to 50 per cycle to avoid blocking the event loop
                )
                if not rows:
                    continue

                updated = 0
                for b in rows:
                    bid   = b.get("id")
                    temp  = float(b.get("temperature") or 35.0)
                    volt  = float(b.get("voltage") or 48.0)
                    curr  = float(b.get("current_a") or 50.0)
                    soh   = float(b.get("soh_percentage") or b.get("health_percentage") or 100.0)
                    cycles = int(b.get("cycle_count") or 0)

                    # Random walk
                    new_temp = max(20.0, min(80.0, temp + random.uniform(-1.0, 1.5)))
                    new_volt = max(40.0, min(58.0, volt + random.uniform(-0.5, 0.5)))
                    new_curr = max(0.0,  min(100.0, curr + random.uniform(-3.0, 3.0)))
                    degrade  = 0.001 if random.random() > 0.9 else 0.0
                    new_soh  = max(20.0, soh - degrade)

                    #  PURPOSEFUL ANOMALY TRIGGER: 2% chance a battery rapidly overheats and degrades
                    # This will trigger the AI anomaly detector and drop the overall health score
                    if random.random() < 0.02:
                        new_temp = random.uniform(55.0, 75.0)  # Overheating!
                        new_soh = max(20.0, new_soh - random.uniform(5.0, 15.0)) # Rapid degradation!
                        logger.warning(f" Anomalous Battery Triggered: ID {bid}, Temp {new_temp:.1f}C, SoH {new_soh:.1f}%")

                    # Update batteries
                    await db_connector.query(conn_id, f"""
                        UPDATE batteries
                        SET temperature      = {new_temp:.2f},
                            voltage          = {new_volt:.2f},
                            current_a        = {new_curr:.2f},
                            soh_percentage   = {new_soh:.2f},
                            health_percentage = {new_soh:.2f},
                            last_reported_at = NOW(),
                            updated_at       = NOW()
                        WHERE id = {bid}
                    """)

                    # telemetics_data  INSERT every battery, every cycle (100%)
                    try:
                        soc = round(min(100.0, new_soh + random.uniform(-5, 5)), 2)
                        await db_connector.query(conn_id, f"""
                            INSERT INTO telemetics_data
                                (timestamp, battery_id, voltage, current, temperature, soc, soh, received_at)
                            VALUES (NOW(), {bid}, {new_volt:.2f}, {new_curr:.2f},
                                    {new_temp:.2f}, {soc}, {new_soh:.2f}, NOW())
                        """)
                    except Exception as e:
                        logger.debug(f"[data_simulator] Suppressed: {e}")

                    # batteryhealthlog  INSERT every battery (cycle_count + charge_percentage NOT NULL)
                    try:
                        await db_connector.query(conn_id, f"""
                            INSERT INTO batteryhealthlog
                                (battery_id, charge_percentage, health_percentage,
                                 voltage, current, temperature, cycle_count, timestamp)
                            VALUES ({bid}, {new_soh:.2f}, {new_soh:.2f},
                                    {new_volt:.2f}, {new_curr:.2f}, {new_temp:.2f},
                                    {cycles}, NOW())
                        """)
                    except Exception as e:
                        logger.debug(f"[data_simulator] Suppressed: {e}")

                    # gps_tracking_log  INSERT 30% of batteries
                    # Fetch active rental for this battery (if any)
                    if random.random() > 0.7:
                        try:
                            # Must have a valid rental_id
                            rent_res = await db_connector.query(conn_id, "SELECT id FROM rentals WHERE battery_id=$1 AND status='ACTIVE' LIMIT 1", (bid,))
                            if rent_res:
                                r_id = rent_res[0]['id']
                                lat   = round(random.uniform(8.0, 28.0), 6)
                                lon   = round(random.uniform(68.0, 88.0), 6)
                                speed = round(random.uniform(0.0, 80.0), 1)
                                await db_connector.query(conn_id, f"""
                                    INSERT INTO gps_tracking_log
                                        (rental_id, battery_id, latitude, longitude, speed,
                                         heading, accuracy, altitude,
                                         is_mock_location, provider, timestamp)
                                    VALUES ({r_id}, {bid}, {lat}, {lon}, {speed},
                                            0, 10.0, 0.0,
                                            false, 'GPS', NOW())
                                """)
                        except Exception as e:
                            logger.debug(f"Data simulator update failed: {e}")

                    updated += 1

                logger.info(" Batteries: %d updated in %s", updated, conn_id)

            except Exception as e:
                logger.warning("batteries sim failed for %s: %s", conn_id, e)

    # 
    #  2. stations
    #     Columns: id, rating, total_reviews, updated_at
    #     Simulate: slight rating drift, new reviews
    # 

    async def _update_stations(self):
        for conn in db_connector.list_connections():
            conn_id = conn["id"]
            try:
                rows = await db_connector.query(
                    conn_id,
                    "SELECT id, rating, total_reviews FROM stations LIMIT 50"
                )
                if not rows:
                    continue

                for s in rows:
                    sid     = s.get("id")
                    rating  = float(s.get("rating") or 4.0)
                    reviews = int(s.get("total_reviews") or 0)

                    # Simulate new reviews coming in (ensure it increases so the node grows!)
                    new_reviews = reviews + random.randint(1, 10)
                    # Weighted average with a new random review score
                    new_score   = round(random.uniform(3.5, 5.0), 1)
                    new_rating  = round(
                        (rating * reviews + new_score * (new_reviews - reviews))
                        / max(1, new_reviews), 2
                    )
                    new_rating  = max(1.0, min(5.0, new_rating))

                    await db_connector.query(conn_id, f"""
                        UPDATE stations
                        SET rating        = {new_rating},
                            total_reviews = {new_reviews},
                            updated_at    = NOW()
                        WHERE id = {sid}
                    """)

                logger.info(" Stations: %d updated in %s", len(rows), conn_id)
            except Exception as e:
                logger.warning("stations sim failed for %s: %s", conn_id, e)


# Singleton instance
data_simulator = DataSimulator()
