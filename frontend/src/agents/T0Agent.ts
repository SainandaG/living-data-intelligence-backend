// frontend/src/agents/T0Agent.ts

import { FEATURE_FLAGS } from '../config/features';

export type AgentState = 'idle' | 'listening' | 'processing' | 'dispatching' | 'error';

export class T0Agent {
    private static instance: T0Agent;
    private state: AgentState = 'idle';
    private listeners: ((state: AgentState) => void)[] = [];

    // Abstract existing logic or mock it if strictly class-based
    // Since React hooks can't be used in classes easily, this acts as a 
    // bridge/state-container or coordination layer.

    static getInstance(): T0Agent {
        if (!T0Agent.instance) {
            T0Agent.instance = new T0Agent();
        }
        return T0Agent.instance;
    }

    constructor() {
    }

    // State management
    getState(): AgentState {
        return this.state;
    }

    setState(newState: AgentState) {
        this.state = newState;
        this.notifyListeners();
    }

    subscribe(callback: (state: AgentState) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.state));
    }

    // Command Processing Interface
    async processCommand(text: string) {
        if (!FEATURE_FLAGS.ENABLE_AGENT_CLASSES) {
            logger.warn("Agent classes disabled, using legacy hook logic directly.");
            return;
        }

        this.setState('processing');

        // 1. First Pass: Local Fuzzy Matching (Command Registry)
        const registry = CommandRegistry.getInstance();
        const matched = registry.findCommand(text);

        if (matched) {
            EventBus.getInstance().emit('AGENT_DISPATCH', {
                intent: matched.id,
                action: matched.action,
                parameters: { original_text: text },
                confidence: 1.0,
                source: 'local_registry'
            });
            this.setState('idle');
            return;
        }

        // 2. Second Pass: Backend API (Placeholder logic)
        // In a full implementation, this calls /api/agent/intent

        setTimeout(() => {
            this.setState('idle');
        }, 1000);
    }
}

import { CommandRegistry } from './CommandRegistry';
import { EventBus } from './eventBus';
import { logger } from '../utils/logger';
