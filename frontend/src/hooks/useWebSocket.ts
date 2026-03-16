import { useState, useEffect, useCallback, useRef } from 'react';
import { useAsyncError } from './useAsyncError';

export type WSStatus = "connecting" | "connected" | "reconnecting" | "failed" | "closed";

interface ParsedMessage {
    type: string;
    data?: any;
    [key: string]: any;
}

export const useWebSocket = (url: string | null) => {
    const throwError = useAsyncError();
    const [status, setStatus] = useState<WSStatus>("closed");
    const [lastMessage, setLastMessage] = useState<ParsedMessage | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [dbReconnecting, setDbReconnecting] = useState(false);
    
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<any>(null);
    const dbReconnectingTimerRef = useRef<any>(null);
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
            console.log("WebSocket connected");
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
                    return; // Do this BEFORE dispatching to any state handler
                }

                // 2. Handle db_reconnecting
                if (data.type === "db_reconnecting") {
                    setDbReconnecting(true);
                    if (dbReconnectingTimerRef.current) clearTimeout(dbReconnectingTimerRef.current);
                    dbReconnectingTimerRef.current = setTimeout(() => setDbReconnecting(false), 30000);
                    return;
                }

                setLastMessage(data);
            } catch (e) {
                console.warn("Failed to parse WS message:", event.data);
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
                
                console.warn(`WS reconnect attempt ${nextAttempt}/${maxReconnectAttempts} in ${delay / 1000}s`);
                
                reconnectTimerRef.current = setTimeout(() => {
                    setReconnectAttempt(nextAttempt);
                }, delay);
            } else {
                console.error("WS reconnection failed after max attempts");
                setStatus("failed");
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
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

    const send = useCallback((payload: object) => {
        const message = JSON.stringify(payload);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(message);
        } else {
            // Queue message if not connected
            if (messageQueueRef.current.length >= maxQueueSize) {
                messageQueueRef.current.shift(); // Drop oldest
            }
            messageQueueRef.current.push(message);
            console.warn("WS disconnected. Message queued.");
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
