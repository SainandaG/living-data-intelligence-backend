"""
realtime_monitor.py — backward-compatibility shim.
All implementation lives in app/services/realtime/ package.
This file exists only so existing `from app.services.realtime_monitor import ...` calls keep working.
"""
from app.services.realtime.monitor import RealtimeMonitor, realtime_monitor

__all__ = ["RealtimeMonitor", "realtime_monitor"]
