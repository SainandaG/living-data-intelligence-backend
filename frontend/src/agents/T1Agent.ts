
import { EventBus } from './eventBus';
import { FEATURE_FLAGS } from '../config/features';
import { DataflowActionHandler } from './handlers/DataflowActionHandler';
import { GraphActionHandler } from './handlers/GraphActionHandler';

export class T1Agent {
    private static instance: T1Agent;
    private dataflowHandler: DataflowActionHandler;
    private graphHandler: GraphActionHandler;

    static getInstance(): T1Agent {
        if (!T1Agent.instance) {
            T1Agent.instance = new T1Agent();
        }
        return T1Agent.instance;
    }

    constructor() {
        this.dataflowHandler = new DataflowActionHandler();
        this.graphHandler = new GraphActionHandler();

        if (FEATURE_FLAGS.ENABLE_AGENT_CLASSES) {
            EventBus.getInstance().on('AGENT_DISPATCH', (payload) => {
                console.log("[T1] Received Dispatch Event:", payload);
                this.executeAction(payload.action, payload.parameters);
            });
            console.log("✅ T1Agent Class Initialized (Listening for events)");
        }
    }

    async executeAction(action: string, params: any) {
        if (!FEATURE_FLAGS.ENABLE_AGENT_CLASSES) return;

        console.log(`[T1] Executing action: ${action}`, params);

        try {
            if (action.startsWith('graph.start_flow') || action.startsWith('graph.stop_flow')) {
                // Delegate to Dataflow Handler with standardized signature
                await this.dataflowHandler.handle(action, params);
            }
            else if (action.startsWith('graph.')) {
                await this.graphHandler.handle(action, params);
            }

            // Notify completion
            EventBus.getInstance().emit('AGENT_EXECUTION_COMPLETE', { action, status: 'success' });

            // Notify UI overlay
            EventBus.getInstance().emit('EXECUTE_ACTION', { action, params });

        } catch (e) {
            console.error(`[T1] Execution Failed: ${e}`);
            EventBus.getInstance().emit('AGENT_EXECUTION_COMPLETE', { action, status: 'error', error: e });
        }
    }
}
