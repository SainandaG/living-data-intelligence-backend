"""
Vitals Service - Platform Health Monitoring
-------------------------------------------
Tracks CPU, Memory, API latency, and Agent performance metrics.
"""

import os
import time
import logging
import psutil
from typing import Dict, Any, List
from datetime import datetime
from app.services.agent_state_manager import get_agent_state_manager

logger = logging.getLogger(__name__)

class VitalsService:
    def __init__(self):
        self.process = psutil.Process(os.getpid())
        self.start_time = time.time()
        self.latency_samples: List[float] = []
        self.max_samples = 100

    def record_latency(self, ms: float):
        """Record an API latency sample"""
        self.latency_samples.append(ms)
        if len(self.latency_samples) > self.max_samples:
            self.latency_samples.pop(0)

    async def get_system_vitals(self) -> Dict[str, Any]:
        """
        Collect real-time system and agent metrics with robust Windows error handling.
        """
        logger.debug("VitalsService: Starting collection...")
        # 1. CPU & Memory  psutil can raise AccessDenied or NoSuchProcess on Windows
        try:
            logger.debug("VitalsService: Fetching CPU...")
            cpu_percent = self.process.cpu_percent()
        except Exception:
            try:
                cpu_percent = psutil.cpu_percent(interval=None)
            except Exception:
                cpu_percent = 0.0

        try:
            logger.debug("VitalsService: Fetching Memory...")
            memory_info = self.process.memory_info()
            memory_mb = memory_info.rss / (1024 * 1024)
        except Exception:
            try:
                memory_mb = psutil.virtual_memory().used / (1024 * 1024)
            except Exception:
                memory_mb = 0.0

        # 2. Latency Stats
        logger.debug("VitalsService: Calculating Latency...")
        avg_latency = sum(self.latency_samples) / len(self.latency_samples) if self.latency_samples else 0

        # 3. Agent States
        logger.debug("VitalsService: Fetching Agent States...")
        try:
            state_manager = get_agent_state_manager()
            t0_raw = getattr(state_manager, 't0_state', None)
            t1_raw = getattr(state_manager, 't1_state', None)
            t0_state = t0_raw.value if hasattr(t0_raw, 'value') else str(t0_raw) if t0_raw else "UNKNOWN"
            t1_state = t1_raw.value if hasattr(t1_raw, 'value') else str(t1_raw) if t1_raw else "UNKNOWN"
            queue_depth = len(state_manager.command_history) if hasattr(state_manager, 'command_history') else 0
            logger.debug(f"VitalsService: Agent states - t0:{t0_state}, t1:{t1_state}, q:{queue_depth}")
        except Exception as e:
            logger.warning(f"VitalsService: Agent state fetch failed: {e}")
            t0_state, t1_state, queue_depth = "UNKNOWN", "UNKNOWN", 0

        # 4. Uptime
        uptime = int(time.time() - self.start_time)

        return {
            "timestamp": datetime.now().isoformat(),
            "status": "HEALTHY",
            "vitals": {
                "cpu_usage": round(cpu_percent, 1),
                "memory_usage_mb": round(memory_mb, 1),
                "avg_api_latency_ms": round(avg_latency, 1),
                "uptime_seconds": uptime
            },
            "agents": {
                "t0_agent": t0_state,
                "t1_agent": t1_state,
                "queue_depth": queue_depth
            }
        }

# Global instance
vitals_service = VitalsService()
