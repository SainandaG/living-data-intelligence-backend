"""
Central Feature Flag Configuration

Every flag is readable from an environment variable of the same name so that
flags can be toggled at deploy-time without a code change.

  export USE_GNN_INFERENCE=true   # enable PyTorch GNN at runtime
  export USE_NLP_V2=true          # re-enable NLP v2 when stable

Values are case-insensitive: "true"/"1"/"yes" → True, anything else → False.
"""
import os


def _flag(name: str, default: bool) -> bool:
    """Read a boolean feature flag from the environment with a hardcoded default."""
    raw = os.getenv(name, "").strip().lower()
    if raw in ("true", "1", "yes"):
        return True
    if raw in ("false", "0", "no"):
        return False
    return default


# Agent Enhancements
USE_ENHANCED_T0_AGENT = _flag("USE_ENHANCED_T0_AGENT", True)
USE_MODULAR_HANDLERS  = _flag("USE_MODULAR_HANDLERS", True)
USE_AGENT_CONTEXT     = _flag("USE_AGENT_CONTEXT", True)

# AI/ML Features
USE_NLP_V2               = _flag("USE_NLP_V2", False)           # disabled for stability
USE_GNN_INFERENCE        = _flag("USE_GNN_INFERENCE", False)    # requires PyTorch (~2 GB)
USE_ADVANCED_EXPLAINABILITY = _flag("USE_ADVANCED_EXPLAINABILITY", True)

# Event Processing
USE_ADVANCED_EVENT_PROCESSING = _flag("USE_ADVANCED_EVENT_PROCESSING", True)
USE_EVENT_SAMPLING            = _flag("USE_EVENT_SAMPLING", True)

# Visualization
USE_BACKEND_GLOW_CALC = _flag("USE_BACKEND_GLOW_CALC", True)
USE_NETWORKX_GLOW     = _flag("USE_NETWORKX_GLOW", True)

# Performance
USE_BATCH_PROCESSING = _flag("USE_BATCH_PROCESSING", True)

# Experimental
ENABLE_TIME_MACHINE   = _flag("ENABLE_TIME_MACHINE", True)
ENABLE_SOUND_SYNTHESIS = _flag("ENABLE_SOUND_SYNTHESIS", True)
USE_NEO4J             = _flag("USE_NEO4J", False)


def get_enabled_features() -> dict:
    """Return all feature flags and their current values."""
    return {
        "USE_ENHANCED_T0_AGENT": USE_ENHANCED_T0_AGENT,
        "USE_MODULAR_HANDLERS": USE_MODULAR_HANDLERS,
        "USE_AGENT_CONTEXT": USE_AGENT_CONTEXT,
        "USE_NLP_V2": USE_NLP_V2,
        "USE_GNN_INFERENCE": USE_GNN_INFERENCE,
        "USE_ADVANCED_EXPLAINABILITY": USE_ADVANCED_EXPLAINABILITY,
        "USE_ADVANCED_EVENT_PROCESSING": USE_ADVANCED_EVENT_PROCESSING,
        "USE_EVENT_SAMPLING": USE_EVENT_SAMPLING,
        "USE_BACKEND_GLOW_CALC": USE_BACKEND_GLOW_CALC,
        "USE_NETWORKX_GLOW": USE_NETWORKX_GLOW,
        "USE_BATCH_PROCESSING": USE_BATCH_PROCESSING,
        "ENABLE_TIME_MACHINE": ENABLE_TIME_MACHINE,
        "ENABLE_SOUND_SYNTHESIS": ENABLE_SOUND_SYNTHESIS,
        "USE_NEO4J": USE_NEO4J,
    }
