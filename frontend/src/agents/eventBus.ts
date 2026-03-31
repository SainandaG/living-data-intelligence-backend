import { logger } from '../utils/logger';

/** Generic event payload — callers narrow to their specific shape */
export type EventPayload = Record<string, unknown>;
type EventHandler = (payload: EventPayload) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventHandler[]> = new Map();

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)?.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) this.listeners.set(event, handlers.filter((h) => h !== handler));
  }

  emit(event: string, payload: EventPayload): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try { handler(payload); }
        catch (e) { logger.error(`Error in event handler for ${event}:`, e); }
      });
    }
  }
}
