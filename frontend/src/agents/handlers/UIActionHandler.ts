import { ActionHandler } from '../agentProtocol';

export class UIActionHandler implements ActionHandler {

    canHandle(action: string): boolean {
        return action.startsWith('ui.');
    }

    async handle(action: string, params: any): Promise<any> {

        switch (action) {
            case 'ui.show_schema':
                return { success: true, type: 'navigation', target: 'schema' };
            case 'ui.drill_down':
                return { success: true, type: 'navigation', target: 'details', id: params.id };
            default:
                return { success: false, error: 'Unknown UI action' };
        }
    }
}
