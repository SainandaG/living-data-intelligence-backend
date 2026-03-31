import { ActionParams, ActionResult } from '../agentProtocol';
import { EventBus } from '../eventBus';

export class DataflowActionHandler {
  async handle(action: string, params: ActionParams): Promise<ActionResult> {
    if (action === 'graph.start_flow') {
      const nodes: string[] = Array.isArray(params.nodes)
        ? (params.nodes as string[])
        : [];
      if (params.target) nodes.push(String(params.target));
      if (params.table_name) nodes.push(String(params.table_name));
      EventBus.getInstance().emit('AGENT_START_FLOW', { nodes });
      return { success: true };
    }
    if (action === 'graph.stop_flow') {
      EventBus.getInstance().emit('AGENT_STOP_FLOW', {});
      return { success: true };
    }
    return { success: false, error: 'Unknown dataflow action' };
  }
}
