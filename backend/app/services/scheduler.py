import logging
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.cron import CronTrigger  # type: ignore
import asyncpg
import os

logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler = AsyncIOScheduler()

async def get_db_conn():
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", 5432))
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME", "wezu_backend")
    
    if not db_user:
        return None
    
    try:
        return await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            database=db_name,
            ssl='require' if 'neon.tech' in db_host else None
        )
    except Exception as e:
        logger.error(f"Scheduler failed to connect to primary DB: {e}")
        return None

async def purge_expired_audit_logs():
    """
    Deletes rows from audit_log where timestamp < now() - 90 days.
    Also deletes expired refresh tokens from DB if stored there (None stored in DB currently).
    """
    try:
        conn = await get_db_conn()
        if not conn:
            logger.warning("Scheduler: No database connection available for purge.")
            return

        try:
            # Archive audit logs older than 90 days instead of physical deletion
            query = "UPDATE audit_log SET archived = true WHERE created_at < NOW() - INTERVAL '90 days' AND archived = false"
            result = await conn.execute(query)
            
            # result is a string like 'UPDATE 5'
            archived_count = int(result.split(" ")[1]) if result.startswith("UPDATE") else 0
            
            current_time = datetime.now(timezone.utc).isoformat()
            # Tokens are stored in memory and pruned by _prune_expired() in auth_api.py,
            # so we only report audit records archived here.
            logger.info(f"Archived {archived_count} audit records at {current_time}")
            
        finally:
            await conn.close()
            
    except Exception as e:
        logger.error(f"Error during scheduled purge_expired_audit_logs: {e}")

def start_scheduler():
    """Start the APScheduler."""
    if not scheduler.running:
        # Schedule it to run daily at 02:00 UTC using cron trigger
        scheduler.add_job(
            purge_expired_audit_logs,
            CronTrigger(hour=2, minute=0, timezone='UTC'),
            id='purge_audit_logs',
            replace_existing=True
        )
        scheduler.start()
        logger.info("APScheduler started.")

def stop_scheduler():
    """Gracefully stop the APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped.")
