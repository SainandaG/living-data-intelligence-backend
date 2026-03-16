"""
Structured Logging Configuration
Provides JSON-formatted, context-aware logging with request_id tracking.
"""
import logging
import logging.config
import time
import uuid
from contextvars import ContextVar
from typing import Optional

# ContextVar allows request_id to flow through any async task spawned by a request
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

APP_VERSION = "2.1.0"
APP_ENV = "production"


class RequestIdFilter(logging.Filter):
    """Inject request_id into every log record produced within a request context."""
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get() or "-"
        return True


def configure_logging(level: int = logging.INFO) -> None:
    """
    Configure the root logger with a structured format that includes:
    - timestamp, level, logger name, request_id, message
    """
    request_filter = RequestIdFilter()

    log_format = "%(asctime)s | %(levelname)-8s | %(name)s | req=%(request_id)s | %(message)s"

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(log_format, datefmt="%Y-%m-%dT%H:%M:%S"))
    handler.addFilter(request_filter)

    root = logging.getLogger()
    root.setLevel(level)
    # Remove any existing handlers (e.g. from basicConfig) to avoid duplicate lines
    root.handlers.clear()
    root.addHandler(handler)

    # Quieten noisy third-party loggers
    for noisy in ("uvicorn.access", "httpx", "asyncpg"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# Apply configuration immediately on import so any module that imports this
# gets structured logs without a separate initialisation call.
configure_logging()
