import { ActionHandler, ActionParams, ActionResult } from '../agentProtocol';

export class UIActionHandler implements ActionHandler {
  canHandle(action: string): boolean {
    return action.startsWith('ui.');
  }

  async handle(action: string, params: ActionParams): Promise<ActionResult> {
    switch (action) {
      case 'ui.show_schema':
        return { success: true, type: 'navigation', target: 'schema' };
      case 'ui.drill_down':
        return { success: true, type: 'navigation', target: 'details', id: String(params.id ?? '') };
      default:
        return { success: false, error: 'Unknown UI action' };
    }
  }
}
