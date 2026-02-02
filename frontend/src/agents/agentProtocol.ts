export type AgentState = 'idle' | 'listening' | 'processing' | 'executing' | 'error';

export interface AgentAction {
    type: string;
    payload: any;
    id?: string;
    timestamp?: number;
}

export interface ActionHandler {
    handle(action: string, params: any): Promise<any>;
    canHandle(action: string): boolean;
}

export interface AgentResponse {
    success: boolean;
    data?: any;
    error?: string;
}
