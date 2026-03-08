import { useState, useEffect, useCallback, useRef } from 'react';

export const useWebSocket = (url: string | null) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<any>(null);

    const connect = useCallback(() => {
        if (!url) return;
        if (socketRef.current?.readyState === WebSocket.OPEN) return;

        const socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onopen = () => {
            setIsConnected(true);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (e) {
                // Silently handle non-JSON messages
            }
        };

        socket.onclose = () => {
            setIsConnected(false);
            if (url) {
                reconnectTimeoutRef.current = setTimeout(connect, 3000);
            }
        };

        socket.onerror = () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, [url]);

    useEffect(() => {
        if (url) {
            connect();
        }
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [url, connect]);


    const sendMessage = useCallback((message: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(message));
        }
    }, []);

    return { isConnected, lastMessage, sendMessage };
};
