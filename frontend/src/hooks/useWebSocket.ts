import { useState, useEffect, useCallback, useRef } from 'react';
import { useAsyncError } from './useAsyncError';
import { logger } from '../utils/logger';

export type WSStatus = "connecting" | "connected" | "reconnecting" | "failed" | "closed";

interface ParsedMessage {
    type: string;
    data?: unknown;
    [key: string]: unknown;
}

export const useWebSocket = (url: string | null) => {
    const throwError = useAsyncError();
    const [status, setStatus] = useState<WSStatus>("closed");
    const [lastMessage, setLastMessage] = useState<ParsedMessage | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [dbReconnecting, setDbReconnecting] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dbReconnectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messageQueueRef = useRef<string[]>([]);
    const maxReconnectAttempts = 10;
    const maxQueueSize = 50;

    const connect = useCallback(() => {
        if (!url) return;

        // Clean up any existing connection/timers
        if (socketRef.current) {
            socketRef.current.onclose = null;
            socketRef.current.close();
        }
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        const authToken = localStorage.getItem('token');
        const wsUrlWithToken = authToken ? `${url}${url.includes('?') ? '&' : '?'}token=${authToken}` : url;

        const socket = new WebSocket(wsUrlWithToken);
        socketRef.current = socket;

        if (reconnectAttempt > 0) {
            setStatus("reconnecting");
        } else {
            setStatus("connecting");
        }

        socket.onopen = () => {
            logger.debug("WebSocket connected");
            setStatus("connected");
            setReconnectAttempt(0);

            // Flush message queue
            while (messageQueueRef.current.length > 0) {
                const msg = messageQueueRef.current.shift();
                if (msg) socket.send(msg);
            }
        };

        socket.onmessage = (event) => {
            try {
                const data: ParsedMessage = JSON.parse(event.data);

                // 1. ADD pong response to server ping
                if (data.type === "ping") {
                    socket.send(JSON.stringify({ type: "pong" }));
                    return;
                }

                // 2. Handle db_reconnecting
                if (data.type === "db_reconnecting") {
                    setDbReconnecting(true);
                    if (dbReconnectingTimerRef.current) clearTimeout(dbReconnectingTimerRef.current);
                    dbReconnectingTimerRef.current = setTimeout(() => setDbReconnecting(false), 30000);
                    return;
                }

                // 3. RBAC: role assigned to this specific user by an admin
                if (data.type === "role_update") {
                    // Lazily import to avoid circular deps at module load time
                    import('../stores/authStore').then(({ useAuthStore }) => {
                        const newRole = data.role as string;
                        const newPermissions = (data.permissions as Record<string, unknown>) || {};
                        useAuthStore.getState().applyRoleUpdate(newRole, newPermissions);
                        logger.info(`[RBAC] Role updated in real-time → ${newRole}`);
                    }).catch((e) => logger.error('[RBAC] Failed to apply role_update:', e));
                    return;
                }

                // 4. RBAC: permission set for the user's role was edited in Role Factory
                if (data.type === "permissions_update") {
                    import('../stores/authStore').then(({ useAuthStore }) => {
                        const changedRole = data.role as string;
                        useAuthStore.getState().applyPermissionsUpdate(changedRole);
                        logger.info(`[RBAC] Permissions updated in real-time for role=${changedRole}`);
                    }).catch((e) => logger.error('[RBAC] Failed to apply permissions_update:', e));
                    return;
                }

                setLastMessage(data);
            } catch (e) {
                logger.warn("Failed to parse WS message:", event.data);
                if (e instanceof Error) throwError(e);
            }
        };

        socket.onclose = (event) => {
            // If it was a clean close from our side, don't reconnect
            if (event.code === 1000 && event.reason === "component unmounted") {
                setStatus("closed");
                return;
            }

            setStatus("reconnecting");

            if (reconnectAttempt < maxReconnectAttempts) {
                const delay = Math.min(Math.pow(2, reconnectAttempt) * 1000, 30000);
                const nextAttempt = reconnectAttempt + 1;

                logger.warn(`WS reconnect attempt ${nextAttempt}/${maxReconnectAttempts} in ${delay / 1000}s`);

                reconnectTimerRef.current = setTimeout(() => {
                    setReconnectAttempt(nextAttempt);
                }, delay);
            } else {
                logger.error("WS reconnection failed after max attempts");
                setStatus("failed");
            }
        };

        socket.onerror = (error) => {
            logger.error("WebSocket error:", error);
            socket.close();
        };
    }, [url, reconnectAttempt]);

    useEffect(() => {
        if (url) {
            connect();
        }
    }, [url, reconnectAttempt]); // Re-run when url or reconnectAttempt changes

    useEffect(() => {
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (dbReconnectingTimerRef.current) clearTimeout(dbReconnectingTimerRef.current);
            if (socketRef.current) {
                socketRef.current.onclose = null; // prevent reconnect firing after unmount
                socketRef.current.close(1000, "component unmounted");
                socketRef.current = null;
            }
        };
    }, []);

    const safeStringify = (payload: object): string => {
        const seen = new WeakSet();
        return JSON.stringify(payload, (_key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return undefined;
                seen.add(value);
            }
            return value;
        });
    };

    const send = useCallback((payload: object) => {
        const message = safeStringify(payload);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(message);
        } else {
            // Queue message if not connected
            if (messageQueueRef.current.length >= maxQueueSize) {
                messageQueueRef.current.shift(); // Drop oldest
            }
            messageQueueRef.current.push(message);
            logger.warn("WS disconnected. Message queued.");
        }
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close(1000, "manual disconnect");
        }
    }, []);

    return {
        status,
        lastMessage,
        send,
        reconnectAttempt,
        dbReconnecting,
        disconnect
    };
};