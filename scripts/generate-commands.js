const fs = require('fs');
const path = require('path');

// Mocking the export for a simple JS execution
const COMMAND_DEFINITIONS = [
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
        paramMapping: { 'table_name': 'table_name' },
        examples: ['highlight patient table', 'show me orders']
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
        paramMapping: { 'cluster_name': 'cluster_name' },
        examples: ['zoom into revenue cluster']
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
        paramMapping: { 'table_name': 'table_name' },
        examples: ['start data flow', 'play transaction flow']
    },
    {
        intent: 'stop_flow',
        phrases: ['stop flow', 'pause flow', 'stop data flow', 'pause animation'],
        action: 'graph.stop_flow',
        handler: 'DataflowActionHandler',
        paramMapping: {},
        examples: ['stop flow']
    },
    {
        intent: 'run_anomaly_detection',
        phrases: ['show anomalies', 'detect anomalies', 'find anomalies', 'run health check'],
        action: 'analytics.anomaly',
        handler: 'AnalyticsActionHandler',
        paramMapping: {},
        examples: ['show anomalies']
    },
    {
        intent: 'apply_clustering',
        phrases: ['apply clustering', 'run clustering', 'cluster tables', 'organize tables'],
        action: 'analytics.cluster',
        handler: 'AnalyticsActionHandler',
        paramMapping: {},
        examples: ['apply clustering']
    },
    {
        intent: 'show_schema',
        phrases: ['show schema', 'display schema', 'view database structure'],
        action: 'ui.show_schema',
        handler: 'UIActionHandler',
        paramMapping: {},
        examples: ['show schema']
    },
    {
        intent: 'reset_view',
        phrases: ['reset view', 'reset camera', 'go back', 'overview'],
        action: 'graph.reset_view',
        handler: 'GraphActionHandler',
        paramMapping: {},
        examples: ['reset view']
    },
    {
        intent: 'drill_down',
        phrases: ['drill down {table_name}', 'inspect table {table_name}', 'open detail for {table_name}'],
        action: 'ui.drill_down',
        handler: 'UIActionHandler',
        paramMapping: { 'table_name': 'table_name' },
        examples: ['drill down users']
    }
];

function generateCommandsJSON() {
    return {
        version: "1.0.0",
        commands: COMMAND_DEFINITIONS.map(def => ({
            id: def.intent,
            phrases: def.phrases,
            intent: def.intent,
            action: def.action,
            parameters: def.paramMapping,
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

const commandsJSON = generateCommandsJSON();
const targetPath = path.join(__dirname, '../backend/config/commands.json');

// Ensure directory exists
const dir = path.dirname(targetPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(targetPath, JSON.stringify(commandsJSON, null, 4));
console.log(`✅ Successfully generated ${targetPath}`);
