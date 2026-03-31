import { useState, useEffect, useCallback, useRef } from 'react';

// Simple throttle implementation to avoid external dependencies
const throttle = (func, limit) => {
    let inThrottle;
    let lastFunc;
    let timeout;
    
    const throttled = (...args) => {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            timeout = setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    lastFunc();
                    lastFunc = null;
                }
            }, limit);
        } else {
            lastFunc = () => func.apply(this, args);
        }
    };

    throttled.cancel = () => {
        clearTimeout(timeout);
        inThrottle = false;
        lastFunc = null;
    };

    return throttled;
};

// Generates a random color for the persona
const generateColor = () => {
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316'];
    return colors[Math.floor(Math.random() * colors.length)];
};

// Generates a stable random name
const generateName = () => { adjs = ['Quantum', 'Lunar', 'Cosmic', 'Nebula', 'Stellar', 'Astral', 'Nexus', 'Cyber', 'Neon', 'Echo'];
    const nouns = ['Panda', 'Fox', 'Wolf', 'Owl', 'Hawk', 'Tiger', 'Bear', 'Lynx', 'Viper', 'Raven'];
    return `${adjs[Math.floor(Math.random() * adjs.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

export const useMultiplayer = (sendMessage, isConnected, appState) => {
    const [persona, setPersona] = useState(() => {
        const stored = localStorage.getItem('multiplayer_persona');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                // reset if parse fails
            }
        }

        const newPersona = {
            id: `usr_${Math.random().toString(36).substring(2, 9)}`,
            name: generateName(),
            color: generateColor()
        };
        localStorage.setItem('multiplayer_persona', JSON.stringify(newPersona));
        return newPersona;
    });

    const [activePeers, setActivePeers] = useState({});
    const cursorRef = useRef({ x: 0, y: 0 });

    // 1. Throttled Cursor Update (20fps / 50ms)
    const throttledSendCursor = useCallback(
        throttle((cursor) => {
            if (!isConnected) return;
            sendMessage({
                type: 'presence_update',
                user_id: persona.id,
                name: persona.name,
                color: persona.color,
                cursor: cursor,
                selected_node: typeof appState.selectedNodeId === 'object' ? appState.selectedNodeId?.id ?? null : appState.selectedNodeId,
                lens: appState.currentLens,
                timestamp: Date.now()
            });
        }, 50),
        [isConnected, sendMessage, persona, appState]
    );

    // 2. Track Mouse Movement
    useEffect(() => {
        const handleMouseMove = (e) => {
            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;
            cursorRef.current = { x, y };
            throttledSendCursor({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            throttledSendCursor.cancel();
        };
    }, [throttledSendCursor]);

    // Process incoming presence data
    const handlePresenceMessage = useCallback((data) => {
        if (!data || data.type !== 'presence_update') return;

        // Ignore our own messages reflected back
        if (data.user_id === persona.id) return;

        setActivePeers(prev => ({
            ...prev,
            [data.user_id]: {
                name: data.name,
                color: data.color,
                camera: data.camera,
                cursor: data.cursor, // Store remote cursor
                selected_node: data.selected_node,
                lens: data.lens,
                last_seen: Date.now()
            }
        }));
    }, [persona.id]);

    // Send presence heartbeat continually (Low frequency for generic state)
    useEffect(() => {
        if (!isConnected) return;

        const intervalId = setInterval(() => {
            let cameraState = null;
            if (appState.getCurrentCameraState) {
                cameraState = appState.getCurrentCameraState();
            }

            sendMessage({
                type: 'presence_update',
                user_id: persona.id,
                name: persona.name,
                color: persona.color,
                cursor: cursorRef.current, // Include last known cursor
                camera: cameraState,
                selected_node: typeof appState.selectedNodeId === 'object' ? appState.selectedNodeId?.id ?? null : appState.selectedNodeId,
                lens: appState.currentLens,
                timestamp: Date.now()
            });
        }, 2000); // Increased heartbeat interval since cursor updates handle real-time sync

        return () => clearInterval(intervalId);
    }, [isConnected, sendMessage, persona, appState]);

    // Cleanup stale peers
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setActivePeers(prev => {
                const next = { ...prev };
                let changed = false;
                for (const [id, peer] of Object.entries(next)) {
                    if (now - peer.last_seen > 10000) { // 10 seconds timeout
                        delete next[id];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return { persona, activePeers, handlePresenceMessage };
};
