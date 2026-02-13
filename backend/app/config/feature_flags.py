"""
Central Feature Flag Configuration
All new features default to FALSE for backward compatibility
"""

# Agent Enhancements
USE_ENHANCED_T0_AGENT = True   # ✅ Enhanced context awareness and multi-turn memory
USE_MODULAR_HANDLERS = True    # Separate T1 handler files
USE_AGENT_CONTEXT = True       # Multi-turn conversation context

# AI/ML Features
USE_NLP_V2 = False             # Temporarily disabled for stability (Rule/Groq fallback)
USE_GNN_INFERENCE = True       # Graph Neural Network predictions
USE_ADVANCED_EXPLAINABILITY = True  # Path tracing explanations

# Event Processing
USE_ADVANCED_EVENT_PROCESSING = True  # Privacy-preserving hashing
USE_EVENT_SAMPLING = True             # Statistical event sampling

# Visualization
USE_BACKEND_GLOW_CALC = True   # Server-side glow calculation
USE_NETWORKX_GLOW = True       # Use NetworkX for rigorous centrality metrics

# Performance
USE_BATCH_PROCESSING = True    # Batch API calls for large graphs

# Experimental
ENABLE_TIME_MACHINE = True     # Evolution/timeline features
ENABLE_SOUND_SYNTHESIS = True  # Advanced audio generation
USE_NEO4J = False              # Graph-native storage (requires external DB)

def get_enabled_features():
    """Return list of enabled features for debugging"""
    return {
        key: value for key, value in globals().items()
        if key.startswith('USE_') or key.startswith('ENABLE_')
    }
