
import { EventBus } from '../eventBus';

export class DataflowActionHandler {
    async handle(action: string, params: any) {
        if (action === 'graph.start_flow') {
            const nodes = params.nodes || [];
            if (params.target) nodes.push(params.target);
            if (params.table_name) nodes.push(params.table_name);

            console.log('[DataflowHandler] Starting flow for nodes:', nodes);
            EventBus.getInstance().emit('AGENT_START_FLOW', { nodes });
            return { success: true };
        }
        else if (action === 'graph.stop_flow') {
            EventBus.getInstance().emit('AGENT_STOP_FLOW', {});
            return { success: true };
        }

        return { success: false, error: 'Unknown dataflow action' };
    }
}
