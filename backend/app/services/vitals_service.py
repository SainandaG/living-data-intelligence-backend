"""
Vitals Service - Platform Health Monitoring
-------------------------------------------
Tracks CPU, Memory, API latency, and Agent performance metrics.
"""

import os
import time
import psutil
import asyncio
from typing import Dict, Any, List
from datetime import datetime
from app.services.agent_state_manager import get_agent_state_manager

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
        Collect real-time system and agent metrics.
        """
        state_manager = get_agent_state_manager()
        
        # 1. CPU & Memory
        cpu_percent = self.process.cpu_percent()
        memory_info = self.process.memory_info()
        memory_mb = memory_info.rss / (1024 * 1024)
        
        # 2. Latency Stats
        avg_latency = sum(self.latency_samples) / len(self.latency_samples) if self.latency_samples else 0
        
        # 3. Agent States
        t0_state = state_manager.t0_state.value if hasattr(state_manager, 't0_state') else "UNKNOWN"
        t1_state = state_manager.t1_state.value if hasattr(state_manager, 't1_state') else "UNKNOWN"
        
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
                "queue_depth": len(state_manager.command_history) if hasattr(state_manager, 'command_history') else 0
            }
        }

# Global instance
vitals_service = VitalsService()
