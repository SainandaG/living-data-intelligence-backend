import { ActionHandler, ActionParams, ActionResult } from '../agentProtocol';
import { logger } from '../../utils/logger';

type DispatchFn = (action: string, params: ActionParams) => void;

export class GraphActionHandler implements ActionHandler {
  private dispatch: DispatchFn | null;

  constructor(dispatch?: DispatchFn) {
    this.dispatch = dispatch ?? null;
  }

  canHandle(action: string): boolean {
    return action.startsWith('graph.');
  }

  async handle(action: string, params: ActionParams): Promise<ActionResult> {
    switch (action) {
      case 'graph.highlight':
        return this.handleHighlight(params);
      case 'graph.zoom_cluster':
        return this.handleZoom(params);
      default:
        logger.warn(`Unknown graph action: ${action}`);
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleHighlight(params: ActionParams): Promise<ActionResult> {
    return { success: true, message: `Highlighted ${params.table_name}` };
  }

  private async handleZoom(params: ActionParams): Promise<ActionResult> {
    return { success: true, message: `Zoomed to ${params.cluster_name}` };
  }
}
