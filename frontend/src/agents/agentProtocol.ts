/** Possible agent lifecycle states */
export type AgentState = 'idle' | 'listening' | 'processing' | 'executing' | 'error';

/** Generic typed payload for agent actions */
export type ActionParams = Record<string, unknown>;

/** Result returned by any action handler */
export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
  type?: string;
  target?: string;
  id?: string;
  [key: string]: unknown;
}

export interface AgentAction {
  type: string;
  payload: ActionParams;
  id?: string;
  timestamp?: number;
}

export interface ActionHandler {
  handle(action: string, params: ActionParams): Promise<ActionResult>;
  canHandle(action: string): boolean;
}

export interface AgentResponse {
  success: boolean;
  data?: ActionResult;
  error?: string;
}
