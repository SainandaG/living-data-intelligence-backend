export const FEATURE_FLAGS = {
    // Agent System
    ENABLE_AGENT_CLASSES: false,
    ENABLE_TYPED_HANDLERS: false,
    ENABLE_EVENT_BUS: false,

    // Audio/Visual
    ENABLE_ADVANCED_AUDIO: false,
    ENABLE_SHADER_GLOW: false,

    // API
    USE_V2_ENDPOINTS: false,
    USE_BATCH_REQUESTS: false,

    // Debug
    ENABLE_AGENT_DEBUG_PANEL: false,
    ENABLE_PERFORMANCE_MONITORING: false
};

export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
    return FEATURE_FLAGS[feature];
}
