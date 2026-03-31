/**
 * Agent Protocol - Shared Types
 * Synchronization between Frontend and Backend
 */

export enum AgentStatus {
    IDLE = 'idle',
    LISTENING = 'listening',
    PROCESSING = 'processing',
    DISPATCHING = 'dispatching',
    EXECUTING = 'executing',
    ERROR = 'error'
}

export interface AgentRequest {
    text: string;
    connectionId: string;
    userId?: string;
    timestamp: number;
    context?: string[];
    uiState?: {
        currentView: string;
        selectedNode?: string;
        availableTables: string[];
    };
}

export interface AgentResponse {
    success: boolean;
    commandId?: string;
    intent: string;
    action: string;
    parameters: Record<string, any>;
    confidence: number;
    method: string;
    reasoning?: string;
    processingTimeMs: number;
    error?: string;
    suggestions?: string[];
    alternatives?: string[];
    version: string;
}

export interface AgentStateUpdate {
    status: AgentStatus;
    lastIntent?: string;
    activeCommands: string[];
    timestamp: number;
}
