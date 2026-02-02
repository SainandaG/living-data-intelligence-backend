/**
 * Command Definitions - Single Source of Truth
 * Used by:
 * - Backend: commands.json generation
 * - Frontend: CommandRegistry
 * - Validation: Protocol checks
 */

export interface CommandDefinition {
    intent: string;
    phrases: string[];
    action: string;
    handler: string;
    paramMapping: Record<string, string>;  // backend key -> frontend key
    examples: string[];
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
    // ============================================================================
    // GRAPH COMMANDS
    // ============================================================================
    {
        intent: 'highlight_node',
        phrases: [
            'highlight {table_name}',
            'focus on {table_name}',
            'zoom {table_name}',
            'zoom to {table_name}',
            'show me {table_name}',
            'find {table_name}',
            'center on {table_name}',
            'select {table_name}',
            'where is {table_name}'
        ],
        action: 'graph.highlight',
        handler: 'GraphActionHandler',
        paramMapping: {
            'table_name': 'table_name'
        },
        examples: [
            'highlight patient table',
            'show me orders',
            'focus on users'
        ]
    },

    {
        intent: 'zoom_cluster',
        phrases: [
            'zoom into {cluster_name}',
            'focus cluster {cluster_name}',
            'show cluster {cluster_name}',
            'go to cluster {cluster_name}',
            'drill into {cluster_name}'
        ],
        action: 'graph.zoom_cluster',
        handler: 'GraphActionHandler',
        paramMapping: {
            'cluster_name': 'cluster_name'
        },
        examples: [
            'zoom into revenue cluster',
            'focus cluster authentication'
        ]
    },

    {
        intent: 'start_flow',
        phrases: [
            'start data flow',
            'play transaction flow',
            'start flow',
            'begin animation',
            'show data moving',
            'activate particles',
            'transaction flow of {table_name}',
            'show flow for {table_name}',
            'flow of {table_name}',
            'start flow for {table_name}'
        ],
        action: 'graph.start_flow',
        handler: 'DataflowActionHandler',
        paramMapping: {
            'table_name': 'table_name'
        },
        examples: [
            'start data flow',
            'play transaction flow'
        ]
    },

    {
        intent: 'stop_flow',
        phrases: [
            'stop flow',
            'pause flow',
            'stop data flow',
            'pause animation',
            'deactivate particles',
            'freeze flow'
        ],
        action: 'graph.stop_flow',
        handler: 'DataflowActionHandler',
        paramMapping: {},
        examples: [
            'stop flow',
            'pause animation'
        ]
    },

    // ============================================================================
    // ANALYTICS COMMANDS
    // ============================================================================
    {
        intent: 'run_anomaly_detection',
        phrases: [
            'show anomalies',
            'detect anomalies',
            'find anomalies',
            'check for anomalies',
            'what is broken',
            'show errors',
            'are there any anomalies',
            'run health check'
        ],
        action: 'analytics.anomaly',
        handler: 'AnalyticsActionHandler',
        paramMapping: {},
        examples: ['show anomalies', 'run health check']
    },

    {
        intent: 'apply_clustering',
        phrases: [
            'apply clustering',
            'run clustering',
            'cluster tables',
            'organize tables',
            'group related tables',
            'run layout optimization'
        ],
        action: 'analytics.cluster',
        handler: 'AnalyticsActionHandler',
        paramMapping: {},
        examples: ['apply clustering', 'organize tables']
    },

    // ============================================================================
    // UI COMMANDS
    // ============================================================================
    {
        intent: 'show_schema',
        phrases: [
            'show schema',
            'display schema',
            'view database structure',
            'open schema view',
            'switch to schema'
        ],
        action: 'ui.show_schema',
        handler: 'UIActionHandler',
        paramMapping: {},
        examples: ['show schema', 'view database structure']
    },

    {
        intent: 'reset_view',
        phrases: [
            'reset view',
            'reset camera',
            'go back',
            'show all',
            'overview',
            'zoom out'
        ],
        action: 'graph.reset_view',
        handler: 'GraphActionHandler',
        paramMapping: {},
        examples: ['reset view', 'show all tables']
    },

    {
        intent: 'drill_down',
        phrases: [
            'drill down {table_name}',
            'inspect table {table_name}',
            'open detail for {table_name}',
            'show data for {table_name}',
            'analyze {table_name}',
            'view records for {table_name}',
            'go deep into {table_name}'
        ],
        action: 'ui.drill_down',
        handler: 'UIActionHandler', // Note: mapped to UIActionHandler or DrillDown depending on setup
        paramMapping: {
            'table_name': 'table_name'
        },
        examples: ['drill down users', 'inspect table payments']
    }
];

/**
 * Generate commands.json structure for backend
 */
export function generateCommandsJSON(): any {
    return {
        version: "1.0.0",
        commands: COMMAND_DEFINITIONS.map(def => ({
            id: def.intent,
            phrases: def.phrases,
            intent: def.intent,
            action: def.action,
            parameters: Object.fromEntries(
                Object.entries(def.paramMapping).map(([k, v]) => [
                    k,
                    { type: "string", required: false, description: `Mapped to ${v}` }
                ])
            ),
            examples: def.examples,
            description: `Auto-generated for ${def.intent}`
        })),
        metadata: {
            created: new Date().toISOString().split('T')[0],
            version: "1.0.0",
            total_commands: COMMAND_DEFINITIONS.length,
            description: "Auto-generated command registry"
        }
    };
}

/**
 * Generate CommandRegistry for frontend
 */
export function generateCommandRegistry(): Record<string, any> {
    const registry: Record<string, any> = {};

    COMMAND_DEFINITIONS.forEach(def => {
        registry[def.intent] = {
            action: def.action,
            handler: def.handler,
            paramMapping: def.paramMapping
        };
    });

    return registry;
}
